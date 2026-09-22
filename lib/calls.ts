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
 * Emails go out once per booking — to the buyer and to the creator — each
 * with a calendar file, so the call is in both calendars without anybody
 * connecting anything.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { onAccount } from "@/lib/stripe-account";
import { applyTax } from "@/lib/tax";
import type { Product, Store } from "@/lib/store";
import {
  type Busy,
  type CallSetup,
  isOpenSlot,
  isTimeZone,
  openSlots,
  readableTime,
  zoneName,
} from "@/lib/call-setup";

/** How long a time is held while the buyer is on Stripe's page. */
export const HOLD_SECONDS = 31 * 60;

/** How far back Stripe is read for paid bookings. Longer than any horizon. */
const LOOKBACK_DAYS = 120;
const MAX_PAGES = 5;

type Entry = { e: number; until: number; session?: string };

const busyKey = (callsId: string) => `nl:call:busy:${callsId}`;
const lockKey = (callsId: string, start: number) => `nl:call:lock:${callsId}:${start}`;
const confirmedKey = (session: string) => `nl:call:confirmed:${session}`;

async function heldAndBooked(callsId: string, now: number): Promise<Busy[]> {
  const [raw] = await redisPipeline([["HGETALL", busyKey(callsId)]]);
  const flat = Array.isArray(raw) ? (raw as string[]) : [];
  const busy: Busy[] = [];
  const stale: string[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const start = Number(flat[i]);
    try {
      const entry = JSON.parse(flat[i + 1]) as Entry;
      if (entry.until !== 0 && entry.until < now) {
        stale.push(flat[i]);
        continue;
      }
      if (Number.isFinite(start) && Number.isFinite(entry.e)) busy.push({ start, end: entry.e });
    } catch {
      stale.push(flat[i]);
    }
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
  customer_details?: { email?: unknown } | null;
  created?: unknown;
};

/** Paid calls, read from the creator's own Stripe account. */
export async function paidCalls(store: Store): Promise<
  { session: string; start: number; end: number; product: string; title: string; email: string | null; buyerTz: string }[]
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
      if (row.status !== "complete" || row.payment_status !== "paid") continue;
      const start = Number(meta.start);
      const end = Number(meta.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const email = row.customer_details?.email;
      found.push({
        session: typeof row.id === "string" ? row.id : "",
        start,
        end,
        product: meta.product ?? "",
        title: meta.title ?? "",
        email: typeof email === "string" && email ? email : null,
        buyerTz: isTimeZone(meta.tz) ? meta.tz : "UTC",
      });
    }
    if (list.has_more !== true || rows.length === 0) break;
    const last = rows[rows.length - 1];
    after = typeof last.id === "string" ? last.id : "";
    if (!after) break;
  }
  return found;
}

type PaidCall = Awaited<ReturnType<typeof paidCalls>>[number];

/** Everything that makes a time unavailable, and the paid calls behind it. */
async function readBusy(store: Store, now: number): Promise<{ busy: Busy[]; paid: PaidCall[] }> {
  const local = store.callsId && isRedisConfigured() ? await heldAndBooked(store.callsId, now) : [];
  let paid: PaidCall[] = [];
  try {
    paid = await paidCalls(store);
  } catch (error) {
    // Without Stripe's answer a paid time could be offered twice. Refusing to
    // show any time is the safe failure; the caller treats the throw as that.
    console.error("reading paid calls failed", error);
    throw error;
  }
  return { busy: [...local, ...paid.map((c) => ({ start: c.start, end: c.end }))], paid };
}

/** Everything that makes a time unavailable in this store, right now. */
export async function busyTimes(store: Store, now = Date.now()): Promise<Busy[]> {
  return (await readBusy(store, now)).busy;
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
  let field: string | null = null;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    try {
      const entry = JSON.parse(flat[i + 1]) as Entry;
      if (entry.session === session && entry.until !== 0) field = flat[i];
    } catch {
      // A broken entry is tidied elsewhere.
    }
  }
  if (!field) return;
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
  await redisPipeline([["HDEL", busyKey(store.callsId), field]]);
}

/**
 * Sends the booking emails for paid calls whose buyer never came back.
 *
 * A buyer who pays and closes the tab before Stripe sends them back would
 * otherwise leave both inboxes empty. Every time the paid calls are read from
 * Stripe anyway — the booking page and the studio — any that were never
 * confirmed are confirmed now. confirmBooking is guarded, so this never sends
 * the same pair twice.
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
      buyerTz: call.buyerTz,
      origin,
    }).catch((error) => console.error("catching up a booking failed", error));
  }
}

/** Whether a product can be booked right now. */
export function isCallProduct(product: Product): product is Product & { call: CallSetup } {
  return product.call !== null;
}

export type HoldResult =
  | { ok: true; url: string; session: string }
  | { ok: false; reason: "taken" | "invalid" | "unavailable" | "error" };

/**
 * Holds a time and opens a checkout for it, on the creator's account.
 *
 * The time is checked again here, against fresh data, because a page that
 * listed it a minute ago may be out of date. A short lock around the check
 * and the hold stops two buyers from winning the same time at once.
 */
export async function holdAndCheckout(input: {
  store: Store;
  product: Product & { call: CallSetup };
  start: number;
  buyerTz: string;
  origin: string;
}): Promise<HoldResult> {
  const { store, product, start, origin } = input;
  const setup = product.call;
  if (!store.stripeAccountId || !store.callsId || !isRedisConfigured()) return { ok: false, reason: "unavailable" };
  const now = Date.now();
  const end = start + setup.minutes * 60_000;
  const buyerTz = isTimeZone(input.buyerTz) ? input.buyerTz : setup.tz;

  const lock = lockKey(store.callsId, start);
  const [got] = await redisPipeline([["SET", lock, String(now), "NX", "EX", 15]]);
  if (got === null) {
    const [held] = await redisPipeline([["GET", lock]]);
    // A lock left behind by a request that died is taken over after 15 seconds.
    if (typeof held === "string" && now - Number(held) < 15_000) return { ok: false, reason: "taken" };
    await redisPipeline([["SET", lock, String(now), "EX", 15]]);
  }

  try {
    let busy: Busy[];
    try {
      busy = await busyTimes(store, now);
    } catch {
      return { ok: false, reason: "error" };
    }
    if (!isOpenSlot(setup, now, busy, start)) return { ok: false, reason: "taken" };

    const until = now + HOLD_SECONDS * 1000;
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
      // Stripe will not keep a checkout open for less than half an hour, and
      // the hold lasts a minute longer, so the time is never released while
      // the page that pays for it is still open.
      expires_at: String(Math.floor(now / 1000) + 30 * 60),
      success_url: `${origin}/@${store.handle}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/@${store.handle}/book/${product.id}`,
    });
    if (product.summary) body.set("line_items[0][price_data][product_data][description]", product.summary);
    if (store.hasDiscounts) body.set("allow_promotion_codes", "true");
    applyTax(store, body);

    const session = await onAccount("POST", store.stripeAccountId, "/checkout/sessions", body);
    if (typeof session.url !== "string" || !session.url || typeof session.id !== "string") {
      return { ok: false, reason: "error" };
    }
    const entry: Entry = { e: end, until, session: session.id };
    await redisPipeline([["HSET", busyKey(store.callsId), String(start), JSON.stringify(entry)]]);
    return { ok: true, url: session.url, session: session.id };
  } catch (error) {
    console.error("holding a call failed", error);
    return { ok: false, reason: "error" };
  } finally {
    await redisPipeline([["DEL", lock]]).catch(() => {});
  }
}

/**
 * Every open time for a call product, or null when it cannot be read, and
 * the paid calls read on the way, for catchUpBookings.
 */
export async function slotsForProduct(store: Store, product: Product & { call: CallSetup }) {
  try {
    const now = Date.now();
    const { busy, paid } = await readBusy(store, now);
    return { days: openSlots(product.call, now, busy), paid };
  } catch {
    return null;
  }
}

// ---- Calendar files ------------------------------------------------------

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsTime(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Folds a line at 75 bytes, as the calendar format requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const char of line) {
    const next = current + char;
    if (new TextEncoder().encode(next).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

/** A calendar file for one booked call. */
export function callInvite(input: {
  uid: string;
  start: number;
  end: number;
  title: string;
  storeName: string;
  room: string | null;
  note: string;
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

// ---- Confirming a booking ------------------------------------------------

function displayName(name: string): string {
  return name.replace(/["\\<>\r\n]/g, "").trim().slice(0, 60) || "A store";
}

function senderAddress(): string {
  const match = NIMBUS_FROM.match(/<([^>]+)>/);
  return (match ? match[1] : NIMBUS_FROM).trim();
}

/**
 * Writes the booking down and sends the two emails, once.
 *
 * Called when the buyer comes back from paying. The session id is checked
 * against Stripe before this is reached, and the write is guarded so a page
 * refreshed ten times sends one pair of emails.
 */
export async function confirmBooking(input: {
  store: Store;
  product: Product & { call: CallSetup };
  session: string;
  start: number;
  end: number;
  buyerEmail: string | null;
  buyerTz: string;
  origin: string;
}): Promise<void> {
  const { store, product, session, start, end, buyerEmail, origin } = input;
  if (!isRedisConfigured() || !store.callsId) return;
  const [fresh] = await redisPipeline([["SET", confirmedKey(session), "1", "NX"]]);
  if (fresh === null) return;

  const entry: Entry = { e: end, until: 0, session };
  await redisPipeline([["HSET", busyKey(store.callsId), String(start), JSON.stringify(entry)]]);
  if (!isSenderConfigured()) return;

  const setup = product.call;
  const buyerTz = isTimeZone(input.buyerTz) ? input.buyerTz : setup.tz;
  const room = setup.room;
  const invite = (note: string) =>
    Buffer.from(
      callInvite({ uid: session, start, end, title: product.title, storeName: store.name, room, note }),
    ).toString("base64");
  const from = `"${displayName(store.name)} via Nimbus Labs" <${senderAddress()}>`;
  const minutes = setup.minutes;

  if (buyerEmail) {
    await sendEmail({
      from,
      to: buyerEmail,
      subject: `Booked: ${product.title} with ${store.name}`,
      text: [
        `Your call with ${store.name} is booked.`,
        "",
        `${product.title}, ${minutes} minutes`,
        `${readableTime(start, buyerTz)} (${zoneName(start, buyerTz)})`,
        "",
        room
          ? `Join here at that time: ${room}`
          : `${store.name} will send you the link to join before the call.`,
        "",
        "The calendar file attached adds it to your calendar.",
        `To move or cancel the call, reply to this email; the reply goes to ${store.name}.`,
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
      `${readableTime(start, setup.tz)} (${zoneName(start, setup.tz)}, your time zone)`,
      "",
      room
        ? `They were given your meeting link: ${room}`
        : `You have not set a meeting link, so send them one before the call${buyerEmail ? ` at ${buyerEmail}` : ""}.`,
      "",
      "The calendar file attached adds it to your calendar. Every booking is also in your studio, under Upcoming calls.",
    ].join("\n"),
    ...(buyerEmail ? { replyTo: buyerEmail } : {}),
    attachments: [{ filename: "call.ics", content: invite(`With ${buyerEmail ?? "your buyer"}.${room ? ` Join: ${room}` : ""}`) }],
  });
}
