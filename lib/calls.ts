/**
 * Booking a paid call, on the creator's own Stripe account.
 *
 * A buyer picks a time, the time is held while they pay, and it becomes
 * theirs once Stripe says the payment went through. Three sources decide
 * whether a time is free, and all three are consulted every time:
 *
 *   - holds: a time somebody is paying for right now, kept for as long as a
 *     Stripe checkout stays open, then released by itself;
 *   - bookings we wrote down when a buyer came back from paying;
 *   - the creator's own Stripe account, which is the ledger. A buyer who paid
 *     and closed the tab before coming back still blocks the time, because
 *     the paid checkout is read from Stripe.
 *
 * Every hold and booking is one seat: a one-to-one call has one per time, a
 * group call up to fifty, a dated live session up to five hundred (the rules
 * are in lib/call-setup.ts). The same booking can be seen twice — written
 * down here and read from Stripe — so seats are counted by checkout session,
 * once each.
 *
 * Emails go out once per booking — to the buyer and to the creator — each
 * with a calendar file, so the call is in both calendars without anybody
 * connecting anything. The buyer's has a link to move the booking to another
 * time themselves (moveBooking), within the creator's notice and at most
 * MAX_MOVES times; the reminders a day and an hour before are sent by the
 * mail job (lib/call-reminders.ts).
 *
 * A fourth source applies to weekly hours only: the creator's own calendars,
 * when they have pasted their private calendar addresses in the studio
 * (lib/calendar-sync.ts). A time they are busy there is not offered, and a
 * calendar that cannot be read takes nothing away — the bookings go on
 * without it. Dated sessions are never hidden by it: the creator put them on
 * that date themselves, so the studio shows the clash instead.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { HOLD_SECONDS, checkoutClosesAt, onAccount } from "@/lib/stripe-account";
import { applyTax } from "@/lib/tax";
import { inTheCurrencyShown, isSettled, onlyInstantMethods } from "@/lib/instant-pay";
import { type Answer, applyCheckoutFields, readAnswers } from "@/lib/checkout-fields";
import type { Product, Store } from "@/lib/store";
import {
  type Busy,
  type CallSetup,
  KEEP_PAST_SESSION_DAYS,
  MAX_MOVES,
  isBookable,
  isTimeZone,
  lengthAt,
  movableUntil,
  openSessions,
  openSlots,
  readableTime,
  roomFor,
  seatsTaken,
  zoneName,
} from "@/lib/call-setup";
import { planCheck, planReminders, readMoves, unplanReminders, writeMove } from "@/lib/call-records";
import { calendarBusy } from "@/lib/calendar-sync";
import { fold, icsText, icsTime } from "@/lib/ics-write";
import { emitEvent } from "@/lib/webhooks";

/** How far back Stripe is read for paid bookings. Longer than any horizon. */
const LOOKBACK_DAYS = 120;
const MAX_PAGES = 5;

/**
 * One seat, as written down here: its start and end, until when a hold lasts
 * (0 for a booking), the checkout session, and the product. Entries written
 * before group calls are filed under their start and carry no `s` or `p`.
 */
type Entry = { s?: number; e: number; until: number; session?: string; p?: string };

const busyKey = (callsId: string) => `nl:call:busy:${callsId}`;
// One lock for the whole diary, not one per start time: two call products,
// or two overlapping stretches of hours, can offer different starts that
// overlap, and both buyers must not pass the check at once. The same lock
// stops two buyers taking the last seat of a group call, and a buyer moving
// into a time while another books it.
const lockKey = (callsId: string) => `nl:call:lock:${callsId}`;
const confirmedKey = (session: string) => `nl:call:confirmed:${session}`;

function readEntries(flat: string[]): { field: string; entry: Entry }[] {
  const out: { field: string; entry: Entry }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    try {
      out.push({ field: flat[i], entry: JSON.parse(flat[i + 1]) as Entry });
    } catch {
      out.push({ field: flat[i], entry: { e: NaN, until: -1 } });
    }
  }
  return out;
}

async function heldAndBooked(callsId: string, now: number): Promise<Busy[]> {
  const [raw] = await redisPipeline([["HGETALL", busyKey(callsId)]]);
  const flat = Array.isArray(raw) ? (raw as string[]) : [];
  const busy: Busy[] = [];
  const stale: string[] = [];
  for (const { field, entry } of readEntries(flat)) {
    if (entry.until === -1 || (entry.until !== 0 && entry.until < now)) {
      stale.push(field);
      continue;
    }
    const start = typeof entry.s === "number" ? entry.s : Number(field);
    if (!Number.isFinite(start) || !Number.isFinite(entry.e)) continue;
    busy.push({ start, end: entry.e, product: entry.p, session: entry.session });
  }
  // Holds that ran out are tidied as they are noticed.
  if (stale.length) await redisPipeline([["HDEL", busyKey(callsId), ...stale]]).catch(() => {});
  return busy;
}

type SessionRow = {
  id?: unknown;
  status?: unknown;
  payment_status?: unknown;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: unknown; name?: unknown } | null;
  created?: unknown;
  custom_fields?: unknown;
};

/**
 * Paid calls, read from the creator's own Stripe account, each at the time
 * it is booked for now: a booking its buyer moved is at its new time.
 */
export async function paidCalls(store: Store): Promise<
  {
    session: string;
    start: number;
    end: number;
    product: string;
    title: string;
    email: string | null;
    /** The name the buyer gave Stripe, when they gave one. */
    name: string | null;
    buyerTz: string;
    /** How many times its buyer has moved it. */
    moves: number;
    /** What the buyer answered to the creator's questions at checkout. */
    answers: Answer[];
  }[]
> {
  if (!store.stripeAccountId) return [];
  const handles = new Set([store.handle, ...store.previousHandles]);
  const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86400;
  const found: Awaited<ReturnType<typeof paidCalls>> = [];
  let after = "";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const list = (await onAccount(
      "GET",
      store.stripeAccountId,
      `/checkout/sessions?limit=100&created[gte]=${since}${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`,
    )) as { data?: unknown; has_more?: unknown };
    const rows = Array.isArray(list.data) ? (list.data as SessionRow[]) : [];
    for (const row of rows) {
      const meta = row.metadata ?? {};
      if (meta.kind !== "call" || !handles.has(meta.store ?? "")) continue;
      if (!isSettled(row)) continue;
      const start = Number(meta.start);
      const end = Number(meta.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const email = row.customer_details?.email;
      const name = row.customer_details?.name;
      found.push({
        session: typeof row.id === "string" ? row.id : "",
        start,
        end,
        product: meta.product ?? "",
        title: meta.title ?? "",
        email: typeof email === "string" && email ? email : null,
        name: typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null,
        buyerTz: isTimeZone(meta.tz) ? meta.tz : "UTC",
        moves: 0,
        answers: readAnswers(row),
      });
    }
    if (list.has_more !== true || rows.length === 0) break;
    const last = rows[rows.length - 1];
    after = typeof last.id === "string" ? last.id : "";
    if (!after) break;
  }
  const moves = await readMoves(found.map((call) => call.session));
  return found.map((call) => {
    const move = moves.get(call.session);
    return move ? { ...call, start: move.s, end: move.e, moves: move.n } : call;
  });
}

export type PaidCall = Awaited<ReturnType<typeof paidCalls>>[number];

/**
 * Everything that makes a seat or a time unavailable, the paid calls behind
 * it, and the times the creator's own calendars say they are busy.
 */
async function readBusy(store: Store, now: number): Promise<{ busy: Busy[]; paid: PaidCall[]; blocked: Busy[] }> {
  const local = store.callsId && isRedisConfigured() ? await heldAndBooked(store.callsId, now) : [];
  let paid: PaidCall[] = [];
  // Read alongside Stripe, and never a reason to fail: a calendar that does
  // not answer blocks nothing.
  const calendar = store.products.some((p) => p.call?.kind === "weekly")
    ? calendarBusy(store, now).catch(() => ({ busy: [] as Busy[] }))
    : Promise.resolve({ busy: [] as Busy[] });
  try {
    paid = await paidCalls(store);
  } catch (error) {
    // Without Stripe's answer a paid time could be offered twice. Refusing to
    // show any time is the safe failure; the caller treats the throw as that.
    console.error("reading paid calls failed", error);
    throw error;
  }
  // Stripe's copy wins over ours: it is the ledger, and it is read with any
  // move applied. Each checkout session is one seat, however often it is seen.
  const fromStripe = new Set(paid.map((c) => c.session).filter(Boolean));
  const busy: Busy[] = [
    ...local.filter((b) => !b.session || !fromStripe.has(b.session)),
    ...paid.map((c) => ({ start: c.start, end: c.end, product: c.product, session: c.session })),
  ];
  return { busy, paid, blocked: (await calendar).busy };
}

/** Every seat taken or held in this store, right now. */
export async function busyTimes(store: Store, now = Date.now()): Promise<Busy[]> {
  return (await readBusy(store, now)).busy;
}

/**
 * The creator's dated sessions still to come, as time they are not free for
 * a weekly call. A session keeps its time whether or not anybody booked it:
 * the creator put it in their diary.
 */
function sessionTimes(store: Store, now: number): Busy[] {
  const out: Busy[] = [];
  for (const product of store.products) {
    if (!product.call || product.call.kind !== "live") continue;
    for (const session of product.call.sessions) {
      const end = session.start + session.minutes * 60_000;
      if (end > now) out.push({ start: session.start, end, product: product.id });
    }
  }
  return out;
}

/**
 * What a product is checked against: its seats, and for weekly hours the
 * creator's dated sessions and the busy times of their own calendars too.
 */
function against(store: Store, product: Product & { call: CallSetup }, busy: Busy[], now: number, blocked: Busy[] = []): Busy[] {
  return product.call.kind === "weekly" ? [...busy, ...sessionTimes(store, now), ...blocked] : busy;
}

/**
 * Lets a buyer who went back from Stripe's page pick again.
 *
 * Their browser remembers the checkout it opened. When it asks for another
 * time in the same store, that checkout is closed at Stripe first — so it can
 * never be paid as well — and only then is its time let go. A checkout that
 * was paid in the meantime cannot be closed, and its time stays booked.
 */
export async function releaseOwnHold(store: Store, session: string): Promise<void> {
  if (!store.stripeAccountId || !store.callsId || !isRedisConfigured()) return;
  if (!/^cs_(test|live)_[A-Za-z0-9]{8,200}$/.test(session)) return;
  const [raw] = await redisPipeline([["HGETALL", busyKey(store.callsId)]]);
  const flat = Array.isArray(raw) ? (raw as string[]) : [];
  const fields = readEntries(flat)
    .filter(({ entry }) => entry.session === session && entry.until !== 0)
    .map(({ field }) => field);
  if (!fields.length) return;
  try {
    const closed = await onAccount(
      "POST",
      store.stripeAccountId,
      `/checkout/sessions/${encodeURIComponent(session)}/expire`,
      new URLSearchParams(),
    );
    if (closed.status !== "expired") return;
  } catch {
    // Paid, or already closed by Stripe: either way the hold is left alone and
    // runs out by itself if nobody paid.
    return;
  }
  await redisPipeline([["HDEL", busyKey(store.callsId), ...fields]]);
}

/**
 * Sends the booking emails for paid calls whose buyer never came back.
 *
 * A buyer who pays and closes the tab before Stripe sends them back would
 * otherwise leave both inboxes empty. Every time the paid calls are read from
 * Stripe anyway — the booking page and the studio — any that were never
 * confirmed are confirmed now, and the mail job looks at every checkout once
 * it has closed (lib/call-reminders.ts). confirmBooking is guarded, so this
 * never sends the same pair twice.
 */
export async function catchUpBookings(store: Store, paid: PaidCall[], origin: string): Promise<void> {
  if (!isRedisConfigured() || !store.callsId) return;
  const now = Date.now();
  const due = paid.filter((c) => c.session && c.end > now).slice(0, 20);
  if (!due.length) return;
  const seen = await redisPipeline(due.map((c) => ["EXISTS", confirmedKey(c.session)]));
  for (let i = 0; i < due.length; i += 1) {
    if (Number(seen[i]) === 1) continue;
    const call = due[i];
    const product = store.products.find((item) => item.id === call.product);
    if (!product || !isCallProduct(product)) continue;
    await confirmBooking({
      store,
      product,
      session: call.session,
      start: call.start,
      end: call.end,
      buyerEmail: call.email,
      buyerName: call.name,
      buyerTz: call.buyerTz,
      moves: call.moves,
      answers: call.answers,
      origin,
    }).catch((error) => console.error("catching up a booking failed", error));
  }
}

/** Whether a product can be booked right now. */
export function isCallProduct(product: Product): product is Product & { call: CallSetup } {
  return product.call !== null;
}

/** Whether a booking was already confirmed, so the mail job knows to leave it. */
export async function isConfirmed(session: string): Promise<boolean> {
  const [seen] = await redisPipeline([["EXISTS", confirmedKey(session)]]);
  return Number(seen) === 1;
}

// ---- Saving a product's setup --------------------------------------------

export type ChangeProblem = "past" | "upcoming" | "booked" | "booked_seats" | "kind" | "error";

/**
 * Checks a new setup against what buyers already hold, and tidies it.
 *
 * Whatever a buyer paid for stays as it was sold: a dated session somebody
 * booked keeps its date, time and length, and keeps at least as many seats
 * as are taken; a product with bookings still to come keeps its kind. The
 * meeting link and everything else can change. Sessions long over are let
 * go, and a new or changed session has to be in the future. Stripe is only
 * asked when a change could touch a booking.
 */
export async function checkCallChange(
  store: Store,
  productId: string,
  next: CallSetup,
  now = Date.now(),
): Promise<CallSetup | ChangeProblem> {
  const before = store.products.find((p) => p.id === productId)?.call ?? null;
  const was = before && before.kind === "live" ? before.sessions : [];
  const byId = new Map(was.map((s) => [s.id, s]));

  let setup = next;
  if (next.kind === "live") {
    const keepFrom = now - KEEP_PAST_SESSION_DAYS * 86_400_000;
    const sessions = next.sessions.filter((s) => s.start + s.minutes * 60_000 > keepFrom);
    for (const session of sessions) {
      if (session.start > now) continue;
      const old = byId.get(session.id);
      if (!old || old.start !== session.start || old.minutes !== session.minutes) return "past";
    }
    if (!sessions.some((s) => s.start > now)) return "upcoming";
    setup = { ...next, sessions, minutes: sessions[0].minutes };
  }

  const switching = before !== null && before.kind !== setup.kind;
  const touched = was.filter((old) => {
    if (old.start + old.minutes * 60_000 <= now) return false;
    const kept = setup.kind === "live" ? setup.sessions.find((s) => s.id === old.id) : undefined;
    return !kept || kept.start !== old.start || kept.minutes !== old.minutes || kept.seats < old.seats;
  });
  if (!switching && touched.length === 0) return setup;

  let busy: Busy[];
  try {
    busy = await busyTimes(store, now);
  } catch {
    return "error";
  }
  if (switching && busy.some((b) => b.product === productId && b.end > now)) return "kind";
  for (const old of touched) {
    const taken = seatsTaken(busy, productId, old.start);
    if (taken === 0) continue;
    const kept = setup.kind === "live" ? setup.sessions.find((s) => s.id === old.id) : undefined;
    if (!kept || kept.start !== old.start || kept.minutes !== old.minutes) return "booked";
    if (kept.seats < taken) return "booked_seats";
  }
  return setup;
}

// ---- The lock around a check and a write ---------------------------------

async function takeLock(callsId: string): Promise<boolean> {
  const lock = lockKey(callsId);
  // Another buyer of this store may be picking a time right now. They hold
  // the lock for a second or two, so wait for it rather than turn this one
  // away over a time nobody took.
  let got: unknown = null;
  for (let attempt = 0; attempt < 12 && got === null; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 250));
    [got] = await redisPipeline([["SET", lock, String(Date.now()), "NX", "EX", 15]]);
  }
  if (got === null) {
    const [held] = await redisPipeline([["GET", lock]]);
    // A lock left behind by a request that died is taken over after 15 seconds.
    if (typeof held === "string" && Date.now() - Number(held) < 15_000) return false;
    await redisPipeline([["SET", lock, String(Date.now()), "EX", 15]]);
  }
  return true;
}

async function dropLock(callsId: string): Promise<void> {
  await redisPipeline([["DEL", lockKey(callsId)]]).catch(() => {});
}

export type HoldResult =
  | { ok: true; url: string; session: string }
  | { ok: false; reason: "taken" | "invalid" | "unavailable" | "error" };

/**
 * Holds a seat and opens a checkout for it, on the creator's account.
 *
 * The time is checked again here, against fresh data, because a page that
 * listed it a minute ago may be out of date. A short lock around the check
 * and the hold stops two buyers from winning the same seat at once — the
 * only seat of a one-to-one call, or the last of a group call.
 */
export async function holdAndCheckout(input: {
  store: Store;
  product: Product & { call: CallSetup };
  start: number;
  buyerTz: string;
  origin: string;
  /** The affiliate whose link the buyer followed, and the share it earns. */
  via?: { aff: string; rate: number } | null;
}): Promise<HoldResult> {
  const { store, product, start, origin } = input;
  const setup = product.call;
  if (!store.stripeAccountId || !store.callsId || !isRedisConfigured()) return { ok: false, reason: "unavailable" };
  const length = lengthAt(setup, start);
  // A dated session the creator has since taken off.
  if (length === null) return { ok: false, reason: "taken" };
  const end = start + length;
  const buyerTz = isTimeZone(input.buyerTz) ? input.buyerTz : setup.tz;

  if (!(await takeLock(store.callsId))) return { ok: false, reason: "taken" };

  try {
    // Read once the lock is ours, so the check is about this moment.
    const now = Date.now();
    let busy: Busy[];
    try {
      const read = await readBusy(store, now);
      busy = against(store, product, read.busy, now, read.blocked);
    } catch {
      return { ok: false, reason: "error" };
    }
    if (!isBookable(setup, now, busy, start, product.id)) return { ok: false, reason: "taken" };

    // Said in the buyer's own time zone: they are the one reading Stripe's page.
    const when = `${readableTime(start, buyerTz)} (${zoneName(start, buyerTz)})`;
    const name = `${product.title} \u2014 ${when}`;
    const body = new URLSearchParams({
      mode: "payment",
      locale: "en",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(product.priceCents),
      "line_items[0][price_data][product_data][name]": name.slice(0, 250),
      "metadata[store]": store.handle,
      "metadata[product]": product.id,
      "metadata[title]": name.slice(0, 480),
      "metadata[kind]": "call",
      "metadata[start]": String(start),
      "metadata[end]": String(end),
      "metadata[tz]": buyerTz,
      "payment_intent_data[metadata][store]": store.handle,
      "payment_intent_data[metadata][product]": product.id,
      "payment_intent_data[metadata][kind]": "call",
      "payment_intent_data[metadata][start]": String(start),
      success_url: `${origin}/@${store.handle}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/@${store.handle}/book/${product.id}`,
    });
    if (product.summary) body.set("line_items[0][price_data][product_data][description]", product.summary);
    if (store.hasDiscounts) body.set("allow_promotion_codes", "true");
    // Sent by an affiliate: credited to them, at today's share (lib/affiliates.ts).
    if (input.via) {
      body.set("metadata[via]", input.via.aff);
      body.set("metadata[via_rate]", String(input.via.rate));
      body.set("payment_intent_data[metadata][via]", input.via.aff);
    }
    // What the creator wants to know before the call, asked before paying.
    applyCheckoutFields(body, product.fields);
    applyTax(store, body);
    onlyInstantMethods(body);
    inTheCurrencyShown(body);
    // Stripe will not keep a checkout open for less than half an hour, counted
    // from when it makes it, so the closing time is set at the last moment;
    // the hold is counted from after, and lasts a minute longer, so the time
    // is never released while the page that pays for it is still open.
    body.set("expires_at", String(checkoutClosesAt()));

    const session = await onAccount("POST", store.stripeAccountId, "/checkout/sessions", body);
    if (typeof session.url !== "string" || !session.url || typeof session.id !== "string") {
      return { ok: false, reason: "error" };
    }
    const until = Date.now() + HOLD_SECONDS * 1000;
    const entry: Entry = { s: start, e: end, until, session: session.id, p: product.id };
    await redisPipeline([["HSET", busyKey(store.callsId), session.id, JSON.stringify(entry)]]);
    // Once the checkout can no longer be open, the mail job looks at it: a
    // buyer who paid and never came back is confirmed then.
    await planCheck(store.callsId, store.handle, session.id, start, until + 60_000).catch((error) =>
      console.error("planning a booking check failed", error),
    );
    return { ok: true, url: session.url, session: session.id };
  } catch (error) {
    console.error("holding a call failed", error);
    return { ok: false, reason: "error" };
  } finally {
    await dropLock(store.callsId);
  }
}

export type Offer = {
  /** Weekly hours: open times, by the creator's day. */
  days: ReturnType<typeof openSlots>;
  /** Group calls: seats left at each open time, by start. */
  left: Record<string, number>;
  /** Dated sessions still on sale. */
  sessions: ReturnType<typeof openSessions>;
};

function offerFrom(
  store: Store,
  product: Product & { call: CallSetup },
  now: number,
  seats: Busy[],
  blocked: Busy[],
): Offer {
  const setup = product.call;
  if (setup.kind === "live") return { days: [], left: {}, sessions: openSessions(setup, now, seats, product.id) };
  const days = openSlots(setup, now, against(store, product, seats, now, blocked), product.id);
  const left: Record<string, number> = {};
  if (setup.seats > 1) {
    for (const day of days) {
      for (const start of day.starts) left[String(start)] = setup.seats - seatsTaken(seats, product.id, start);
    }
  }
  return { days, left, sessions: [] };
}

/**
 * Every open time or session for a call product, or null when it cannot be
 * read, and the paid calls read on the way, for catchUpBookings.
 */
export async function slotsForProduct(store: Store, product: Product & { call: CallSetup }) {
  try {
    const now = Date.now();
    const { busy, paid, blocked } = await readBusy(store, now);
    return { ...offerFrom(store, product, now, busy, blocked), paid };
  } catch {
    return null;
  }
}

/**
 * The times a booking may move to: everything open, counted as if its own
 * seat were already free — so a one-hour call can move half an hour later —
 * and never the time it already has.
 */
export async function slotsForMove(
  store: Store,
  product: Product & { call: CallSetup },
  session: string,
  current: number,
): Promise<Offer | null> {
  try {
    const now = Date.now();
    const { busy, blocked } = await readBusy(store, now);
    const offer = offerFrom(store, product, now, busy.filter((b) => b.session !== session), blocked);
    return {
      days: offer.days
        .map((day) => ({ ...day, starts: day.starts.filter((start) => start !== current) }))
        .filter((day) => day.starts.length > 0),
      left: offer.left,
      sessions: offer.sessions.filter((s) => s.start !== current),
    };
  } catch {
    return null;
  }
}

// ---- Moving a booking ------------------------------------------------------

/** Where a buyer moves their booking. The checkout session is the key, as on the thanks page. */
export function moveLink(origin: string, store: Store, productId: string, session: string): string {
  return `${origin}/@${store.handle}/book/${productId}?move=${encodeURIComponent(session)}`;
}

/**
 * Whether a booking at `start` may still be moved by its buyer: before the
 * creator's notice runs out, fewer than MAX_MOVES times, and — for a dated
 * session — only when there is another session to go to.
 */
export function canMove(setup: CallSetup, start: number, moves: number, now = Date.now()): boolean {
  return whyNotMove(setup, start, moves, now) === null;
}

/** Why a booking cannot be moved any more, or null when it can. */
export function whyNotMove(
  setup: CallSetup,
  start: number,
  moves: number,
  now = Date.now(),
): "limit" | "late" | "nowhere" | null {
  if (moves >= MAX_MOVES) return "limit";
  if (now > movableUntil(setup, start)) return "late";
  if (setup.kind === "live") {
    const closes = setup.noticeHours * 3600_000;
    if (!setup.sessions.some((s) => s.start !== start && s.start - closes > now)) return "nowhere";
  }
  return null;
}

export type MoveResult =
  | { ok: true; start: number; end: number; moves: number }
  | { ok: false; reason: "late" | "limit" | "same" | "taken" | "unavailable" | "error" };

/**
 * Moves a paid booking to another open time, for its buyer.
 *
 * `booked` is the booking as Stripe has it, read by the caller from the
 * checkout session. The move record is read again inside the lock, so two
 * tabs moving the same booking at once cannot both count as the first move,
 * and the new time is checked the way a new booking is. The old seat is let
 * go in the same step, and both people are told, with a new calendar file.
 */
export async function moveBooking(input: {
  store: Store;
  product: Product & { call: CallSetup };
  session: string;
  booked: { start: number; end: number; email: string | null; buyerTz: string };
  start: number;
  origin: string;
}): Promise<MoveResult> {
  const { store, product, session, start, origin } = input;
  const setup = product.call;
  if (!store.callsId || !isRedisConfigured()) return { ok: false, reason: "unavailable" };
  const length = lengthAt(setup, start);
  if (length === null) return { ok: false, reason: "taken" };
  const end = start + length;
  const callsId = store.callsId;

  if (!(await takeLock(callsId))) return { ok: false, reason: "taken" };
  let from: { start: number; end: number; moves: number };
  try {
    const now = Date.now();
    const recorded = (await readMoves([session])).get(session);
    from = recorded
      ? { start: recorded.s, end: recorded.e, moves: recorded.n }
      : { start: input.booked.start, end: input.booked.end, moves: 0 };
    if (from.moves >= MAX_MOVES) return { ok: false, reason: "limit" };
    if (now > movableUntil(setup, from.start)) return { ok: false, reason: "late" };
    if (start === from.start) return { ok: false, reason: "same" };

    let busy: Busy[];
    let blocked: Busy[];
    try {
      ({ busy, blocked } = await readBusy(store, now));
    } catch {
      return { ok: false, reason: "error" };
    }
    const others = against(store, product, busy.filter((b) => b.session !== session), now, blocked);
    if (!isBookable(setup, now, others, start, product.id)) return { ok: false, reason: "taken" };

    await writeMove(session, { s: start, e: end, n: from.moves + 1 });
    // The seat moves in the diary too: whatever was written under this
    // checkout — a hold, a booking, one filed by its start before group calls
    // — gives way to one entry at the new time.
    const [raw] = await redisPipeline([["HGETALL", busyKey(callsId)]]);
    const old = readEntries(Array.isArray(raw) ? (raw as string[]) : [])
      .filter(({ field, entry }) => entry.session === session && field !== session)
      .map(({ field }) => field);
    const entry: Entry = { s: start, e: end, until: 0, session, p: product.id };
    await redisPipeline([
      ...(old.length ? [["HDEL", busyKey(callsId), ...old]] : []),
      ["HSET", busyKey(callsId), session, JSON.stringify(entry)],
      // Moved before it was ever confirmed: the move email says it all, and
      // no "Booked" email for the old time follows it.
      ["SET", confirmedKey(session), "1", "NX"],
    ]);
  } catch (error) {
    console.error("moving a booking failed", error);
    return { ok: false, reason: "error" };
  } finally {
    await dropLock(callsId);
  }

  const moves = from.moves + 1;
  try {
    await unplanReminders(callsId, store.handle, session, from.start);
    await planReminders(callsId, store.handle, session, start);
  } catch (error) {
    console.error("planning reminders after a move failed", error);
  }
  await tellMoved({ store, product, session, from, start, end, moves, email: input.booked.email, buyerTz: input.booked.buyerTz, origin }).catch(
    (error) => console.error("sending the move emails failed", error),
  );
  await emitEvent(store, "call.moved", `${session}|${moves}`, {
    checkout_session: session,
    product: { id: product.id, title: product.title },
    from: { start: new Date(from.start).toISOString(), end: new Date(from.end).toISOString() },
    to: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
    moves,
    buyer: { email: input.booked.email, timezone: input.booked.buyerTz },
  }).catch((error) => console.error("queueing the call.moved webhook failed", error));
  return { ok: true, start, end, moves };
}

async function tellMoved(input: {
  store: Store;
  product: Product & { call: CallSetup };
  session: string;
  from: { start: number; end: number };
  start: number;
  end: number;
  moves: number;
  email: string | null;
  buyerTz: string;
  origin: string;
}): Promise<void> {
  if (!isSenderConfigured()) return;
  const { store, product, session, from, start, end, moves, email, origin } = input;
  const setup = product.call;
  const buyerTz = isTimeZone(input.buyerTz) ? input.buyerTz : setup.tz;
  const room = roomFor(setup, start);
  const invite = (note: string) =>
    Buffer.from(
      callInvite({ uid: session, start, end, title: product.title, storeName: store.name, room, note, sequence: moves }),
    ).toString("base64");
  const at = (ms: number, tz: string) => `${readableTime(ms, tz)} (${zoneName(ms, tz)})`;

  if (email) {
    const again = canMove(setup, start, moves);
    await sendEmail({
      from: storeSender(store),
      to: email,
      subject: `Moved: ${product.title} with ${store.name}`,
      text: [
        `Your booking with ${store.name} has moved.`,
        "",
        `${product.title}, ${Math.round((end - start) / 60_000)} minutes`,
        `Now: ${at(start, buyerTz)}`,
        `Was: ${at(from.start, buyerTz)}`,
        "",
        room ? `Join here at the new time: ${room}` : `${store.name} will send you the link to join before the call.`,
        "",
        "The calendar file attached has the new time. If your calendar still shows the old one as well, delete the old one.",
        again
          ? `To move it again: ${moveLink(origin, store, product.id, session)} (you can move a booking ${MAX_MOVES} times in all).`
          : `This booking cannot be moved again from the link. To change it, reply to this email; the reply goes to ${store.name}.`,
        `To cancel, reply to this email; the reply goes to ${store.name}.`,
      ].join("\n"),
      replyTo: store.email,
      attachments: [{ filename: "call.ics", content: invite(room ? `Join: ${room}` : `${store.name} will send the link to join.`) }],
    });
  }

  await sendEmail({
    from: `"Nimbus Labs" <${senderAddress()}>`,
    to: store.email,
    subject: `Moved: ${product.title}, now ${readableTime(start, setup.tz)}`,
    text: [
      `${email ?? "A buyer"} moved their booking of ${product.title}.`,
      "",
      `Now: ${at(start, setup.tz)}, your time zone`,
      `Was: ${at(from.start, setup.tz)}`,
      "",
      "The old time is free again for somebody else. The calendar file attached has the new time; delete the old event from your calendar if it is still there.",
      "Every booking is also in your studio, under Upcoming calls.",
    ].join("\n"),
    ...(email ? { replyTo: email } : {}),
    attachments: [{ filename: "call.ics", content: invite(`With ${email ?? "your buyer"}.${room ? ` Join: ${room}` : ""}`) }],
  });
}

// ---- Calendar files ------------------------------------------------------

/**
 * A calendar file for one booked call. A moved booking keeps its event id
 * and counts up `sequence`, which is how a calendar knows the new file is the
 * same event at a new time.
 */
export function callInvite(input: {
  uid: string;
  start: number;
  end: number;
  title: string;
  storeName: string;
  room: string | null;
  note: string;
  sequence?: number;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nimbus Labs//Paid calls//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@nimbuslabsai.com`,
    `DTSTAMP:${icsTime(Date.now())}`,
    `SEQUENCE:${input.sequence ?? 0}`,
    `DTSTART:${icsTime(input.start)}`,
    `DTEND:${icsTime(input.end)}`,
    `SUMMARY:${icsText(`${input.title} with ${input.storeName}`)}`,
    `DESCRIPTION:${icsText(input.note)}`,
    ...(input.room ? [`LOCATION:${icsText(input.room)}`, `URL:${input.room}`] : []),
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`${input.title} in 15 minutes`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Where a calendar file for a booking can be fetched again, from an email. */
export function icsLink(origin: string, store: Store, session: string): string {
  return `${origin}/api/store/ics?handle=${encodeURIComponent(store.handle)}&session_id=${encodeURIComponent(session)}`;
}

// ---- Confirming a booking ------------------------------------------------

function displayName(name: string): string {
  return name.replace(/["\\<>\r\n]/g, "").trim().slice(0, 60) || "A store";
}

export function senderAddress(): string {
  const match = NIMBUS_FROM.match(/<([^>]+)>/);
  return (match ? match[1] : NIMBUS_FROM).trim();
}

/** The From line of an email a buyer gets about a creator's call. */
export function storeSender(store: Store): string {
  return `"${displayName(store.name)} via Nimbus Labs" <${senderAddress()}>`;
}

/**
 * Writes the booking down and sends the two emails, once.
 *
 * Called when the buyer comes back from paying. The session id is checked
 * against Stripe before this is reached, and the write is guarded so a page
 * refreshed ten times sends one pair of emails. The reminders a day and an
 * hour before are planned here too.
 */
export async function confirmBooking(input: {
  store: Store;
  product: Product & { call: CallSetup };
  session: string;
  start: number;
  end: number;
  buyerEmail: string | null;
  /** The name the buyer gave Stripe, for the creator's webhooks. */
  buyerName?: string | null;
  buyerTz: string;
  /** How many times it was moved before this, when that is known. */
  moves?: number;
  /** The buyer's answers to the creator's questions, told to the creator. */
  answers?: Answer[];
  origin: string;
}): Promise<void> {
  const { store, product, session, start, end, buyerEmail, origin } = input;
  if (!isRedisConfigured() || !store.callsId) return;
  const [fresh] = await redisPipeline([["SET", confirmedKey(session), "1", "NX"]]);
  if (fresh === null) return;

  const entry: Entry = { s: start, e: end, until: 0, session, p: product.id };
  await redisPipeline([["HSET", busyKey(store.callsId), session, JSON.stringify(entry)]]);
  await planReminders(store.callsId, store.handle, session, start).catch((error) =>
    console.error("planning call reminders failed", error),
  );
  await emitEvent(store, "call.booked", session, {
    checkout_session: session,
    product: { id: product.id, title: product.title },
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    kind: product.call.kind === "live" ? "live_session" : product.call.seats > 1 ? "group_call" : "call",
    buyer: { email: buyerEmail, name: input.buyerName ?? null, timezone: input.buyerTz },
    answers: (input.answers ?? []).map((answer) => ({ question: answer.label, answer: answer.value })),
  }).catch((error) => console.error("queueing the call.booked webhook failed", error));
  if (!isSenderConfigured()) return;

  const setup = product.call;
  const buyerTz = isTimeZone(input.buyerTz) ? input.buyerTz : setup.tz;
  const room = roomFor(setup, start);
  const invite = (note: string) =>
    Buffer.from(
      callInvite({ uid: session, start, end, title: product.title, storeName: store.name, room, note, sequence: input.moves ?? 0 }),
    ).toString("base64");
  const minutes = Math.round((end - start) / 60_000);
  const what = setup.kind === "live" ? "Your seat" : setup.seats > 1 ? "Your place in the group call" : "Your call";

  if (buyerEmail) {
    await sendEmail({
      from: storeSender(store),
      to: buyerEmail,
      subject: `Booked: ${product.title} with ${store.name}`,
      text: [
        `${what} with ${store.name} is booked.`,
        "",
        `${product.title}, ${minutes} minutes`,
        `${readableTime(start, buyerTz)} (${zoneName(start, buyerTz)})`,
        "",
        room
          ? `Join here at that time: ${room}`
          : `${store.name} will send you the link to join before the call.`,
        "",
        "The calendar file attached adds it to your calendar. You will get a reminder a day before and an hour before.",
        ...(canMove(setup, start, input.moves ?? 0)
          ? [
              `To move it to another time yourself, up to ${Math.max(setup.noticeHours, 1)} ${Math.max(setup.noticeHours, 1) === 1 ? "hour" : "hours"} before it starts: ${moveLink(origin, store, product.id, session)}`,
            ]
          : []),
        `To cancel, reply to this email; the reply goes to ${store.name}.`,
        "",
        `Your booking: ${origin}/@${store.handle}`,
      ].join("\n"),
      // Replies reach the creator, which the studio tells them before they
      // offer a single call.
      replyTo: store.email,
      attachments: [{ filename: "call.ics", content: invite(room ? `Join: ${room}` : `${store.name} will send the link to join.`) }],
    });
  }

  await sendEmail({
    from: `"Nimbus Labs" <${senderAddress()}>`,
    to: store.email,
    subject: `New booking: ${product.title}, ${readableTime(start, setup.tz)}`,
    text: [
      `${buyerEmail ?? "A buyer"} booked ${product.title} (${minutes} minutes) and paid on your Stripe account.`,
      "",
      ...(input.answers?.length
        ? ["What they answered before paying:", ...input.answers.map((answer) => `${answer.label}: ${answer.value}`), ""]
        : []),
      `${readableTime(start, setup.tz)} (${zoneName(start, setup.tz)}, your time zone)`,
      "",
      room
        ? `They were given your meeting link: ${room}`
        : `You have not set a meeting link, so send them one before the call${buyerEmail ? ` at ${buyerEmail}` : ""}.`,
      "",
      "The calendar file attached adds it to your calendar. Every booking is also in your studio, under Upcoming calls, and you get a reminder with everyone booked a day and an hour before.",
    ].join("\n"),
    ...(buyerEmail ? { replyTo: buyerEmail } : {}),
    attachments: [{ filename: "call.ics", content: invite(`With ${buyerEmail ?? "your buyer"}.${room ? ` Join: ${room}` : ""}`) }],
  });
}
