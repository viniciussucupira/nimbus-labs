/**
 * A buyer getting back what they bought, at any time, without an account.
 *
 * The link on the thanks page works for three days, which is what stops a
 * leaked link from becoming a free copy for everyone. The cost of that is a
 * buyer who closes the tab, changes phone or comes back a month later and no
 * longer has what they paid for — and who blames the creator, not us.
 *
 * So the buyer types the address they paid with, and we email that address a
 * link to a page that lists everything it bought from this store, each with
 * its download or its link. Only whoever reads that inbox gets in, which is
 * the protection an account gives, without a password to invent or for us to
 * keep.
 *
 * Nothing is written down about purchases here. The list is asked of the
 * creator's own Stripe account every time, which is the record of who paid
 * for what; a refunded sale is left off, because Stripe says so, not because
 * we remembered. A membership that stopped stays on the list with nothing to
 * open and the way to renew, so its former member is told what happened
 * rather than finding it quietly gone (lib/membership-access.ts).
 *
 * Like cancelling a membership, this works whatever state the creator's own
 * Nimbus subscription is in: somebody paid for that file, and they get it.
 */
import { createHash, randomBytes } from "node:crypto";
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, normaliseEmail } from "@/lib/auth";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount, platformKey } from "@/lib/stripe-account";
import { isSettled } from "@/lib/instant-pay";
import type { ProductFile } from "@/lib/product-file";
import { isLive, soldAMembership } from "@/lib/membership-access";
import { refundedInFull } from "@/lib/refunds";
import type { Listing, Store } from "@/lib/store";
import { listingFinder, readListings, sellsAny, sellsThings } from "@/lib/catalog";
import { paidCalls } from "@/lib/calls";
import { roomsFor } from "@/lib/call-rooms";
import type { CallSetup } from "@/lib/call-setup";
import { bundleFromMeta } from "@/lib/bundle-rules";
import { IMPORTED_REFERENCE, importedFor, importedReference } from "@/lib/imported-purchases";

/** How long the emailed link opens the list. */
export const ORDERS_LINK_SECONDS = 24 * 60 * 60;
export const ORDERS_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
/** The most purchases one list shows, newest first. */
export const MAX_LISTED = 40;

const IP_LIMIT = 10;
const ADDRESS_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60 * 60;
const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
const INTENT_ID_PATTERN = /^pi_[A-Za-z0-9]{10,200}$/;
const CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]{6,64}$/;

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const tokenKey = (token: string) => `nl:orders:link:${sha(`nimbus-orders:${token}`).slice(0, 40)}`;
const ipKey = (ip: string, handle: string) => `nl:rl:orders:ip:${sha(`nimbus-orders-ip:${ip}:${handle}`).slice(0, 32)}`;
const addressKey = (email: string) => `nl:rl:orders:addr:${sha(`nimbus-orders-addr:${email}`).slice(0, 32)}`;

/** One thing a buyer can open again. */
export type Delivery = {
  title: string;
  file: ProductFile | null;
  link: string | null;
};

/** One product of a bundle on the list of purchases, with what it hands over. */
export type PurchaseLine = {
  productId: string;
  title: string;
  delivery: Delivery | null;
  /** A course opens on its own page. */
  courseProduct: string | null;
};

/** What a bundle on the list hands over, and how many of its products the store no longer has. */
export type PurchaseItems = { lines: PurchaseLine[]; missing: number };

export type Purchase = {
  /**
   * The Checkout Session, or the one-click payment, that paid for it — or,
   * for something brought over from another platform, an "imp_" reference
   * of its own (lib/imported-purchases.ts).
   */
  reference: string;
  /**
   * "sale" is a checkout; "upsell" is what was added in one click after it;
   * "imported" was brought over by the creator from another platform, with
   * no payment here.
   */
  kind: "sale" | "upsell" | "imported";
  title: string;
  /** The price option chosen, when the product has several. */
  option: string | null;
  paidAt: number;
  /** A membership, still being paid for. */
  member: boolean;
  /**
   * A membership that has ended. It hands nothing over any more; the page
   * says so and offers the way back.
   */
  ended: boolean;
  /** The product bought, and the one ticked at checkout, as the store lists them. */
  productId: string;
  bumpId: string | null;
  /** A course opens on its own page rather than as a download. */
  courseProduct: string | null;
  main: Delivery | null;
  /** The product ticked at checkout, delivered with it. */
  bump: Delivery | null;
  /** When the product is a bundle: its products, from the list on the order. */
  items: PurchaseItems | null;
  /** When the product ticked at checkout is a bundle: its products. */
  bumpItems: PurchaseItems | null;
};

/** The products of a list on an order, each with what it hands over now. */
async function linesOf(find: (id: string | undefined) => Promise<Listing | null>, ids: string[]): Promise<PurchaseItems | null> {
  if (ids.length === 0) return null;
  const lines: PurchaseLine[] = [];
  let missing = 0;
  for (const id of ids) {
    const item = await find(id);
    if (!item) {
      missing += 1;
      continue;
    }
    const delivery = item.options.length === 0 && (item.file || item.link) ? { title: item.title, file: item.file, link: item.link } : null;
    lines.push({ productId: item.id, title: item.title, delivery, courseProduct: item.course ? item.id : null });
  }
  return { lines, missing };
}

/**
 * Whether this store's buyers can be offered this at all: its sales are on a
 * Stripe account we can read, or it brought buyers over from another
 * platform (lib/imported-purchases.ts), who have no Stripe sale to look up.
 */
export function canRecover(store: Store): boolean {
  const stripe = Boolean(store.stripeAccountId) && platformKey() !== null;
  return (stripe || store.pastBuyers) && isRedisConfigured() && isSenderConfigured();
}

/**
 * What an emailed link is tied to: the Stripe account the purchases are on,
 * or, for a store that has only buyers brought over, the store itself. A link
 * stops working when that changes.
 */
function grantAccount(store: Store): string {
  return store.stripeAccountId ?? `imports:${store.statsId ?? ""}`;
}

/** One booked call still to come, as the buyer's list shows it. */
export type BookedCall = {
  /** The checkout session that paid for it: the key to its calendar file and its move page. */
  session: string;
  productId: string;
  title: string;
  start: number;
  end: number;
  /** The buyer's own time zone, as they booked in it. */
  buyerTz: string;
  moves: number;
  setup: CallSetup;
  /** Where to join: the room made for it, the creator's own link, or null when they send one. */
  room: string | null;
};

/**
 * The calls this address booked here that have not ended yet, soonest
 * first, each with where to join. Read from the creator's Stripe account, the
 * ledger, with any move applied.
 */
export async function callsFor(store: Store, email: string): Promise<BookedCall[]> {
  if (!store.stripeAccountId || !sellsAny(store, "call")) return [];
  const who = normaliseEmail(email);
  const now = Date.now();
  const mine = (await paidCalls(store))
    .filter((call) => call.email !== null && normaliseEmail(call.email) === who && call.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_LISTED);
  if (mine.length === 0) return [];
  const listings = await readListings(store, mine.map((call) => call.product));
  const known = mine.flatMap((call) => {
    const setup = listings.find((p) => p.id === call.product)?.call;
    return setup ? [{ call, setup, title: listings.find((p) => p.id === call.product)!.title }] : [];
  });
  const rooms = await roomsFor(
    store.callsId,
    known.map(({ call, setup }) => ({ product: call.product, setup, session: call.session, start: call.start, end: call.end })),
  );
  return known.map(({ call, setup, title }, i) => ({
    session: call.session,
    productId: call.product,
    title,
    start: call.start,
    end: call.end,
    buyerTz: call.buyerTz,
    moves: call.moves,
    setup,
    room: rooms[i],
  }));
}

/** Whether the store sells anything a buyer would come back for: a thing, or a call to join. */
export function sellsDeliverables(store: Store): boolean {
  return sellsThings(store) || sellsAny(store, "call");
}

function deliveryOf(product: Listing, optionId: string | undefined): { delivery: Delivery | null; option: string | null } {
  if (product.options.length > 0) {
    const option = product.options.find((o) => o.id === optionId) ?? null;
    if (!option) return { delivery: null, option: null };
    const delivery = option.file || option.link ? { title: product.title, file: option.file, link: option.link } : null;
    return { delivery, option: option.label };
  }
  const delivery = product.file || product.link ? { title: product.title, file: product.file, link: product.link } : null;
  return { delivery, option: null };
}

type Row = Record<string, unknown>;
type Listed = { data?: unknown };

function rows(listed: Listed): Row[] {
  return Array.isArray(listed.data) ? (listed.data as Row[]) : [];
}

/** Whether Stripe says this charge was given back in full: the shared rule (lib/refunds.ts). */
const refunded = refundedInFull;

/**
 * Everything this address paid this store for that can be handed over again,
 * newest first, read from the creator's own Stripe account.
 */
export async function purchasesFor(store: Store, email: string): Promise<Purchase[]> {
  const account = store.stripeAccountId;
  if (!account && !store.pastBuyers) return [];
  const handles = new Set([store.handle, ...store.previousHandles]);
  const find = listingFinder(store);
  const found = new Map<string, Purchase>();
  const customers = new Set<string>();

  // Stripe keeps the address as it was typed at checkout.
  const variants = account ? [...new Set([email.trim(), normaliseEmail(email)])] : [];
  for (const variant of variants) {
    const query = new URLSearchParams({ "customer_details[email]": variant, status: "complete", limit: "100" });
    query.append("expand[]", "data.subscription");
    query.append("expand[]", "data.payment_intent.latest_charge");
    const listed = (await onAccount("GET", account as string, `/checkout/sessions?${query}`)) as Listed;
    for (const session of rows(listed)) {
      const id = typeof session.id === "string" ? session.id : "";
      if (!SESSION_ID_PATTERN.test(id) || found.has(id)) continue;
      const meta = (session.metadata ?? {}) as Record<string, string>;
      if (!handles.has(meta.store ?? "")) continue;
      if (!isSettled(session)) continue;
      if (meta.kind === "call") continue;
      const product = await find(meta.product);
      if (!product || product.call) continue;
      if (refunded(session.payment_intent)) continue;

      // A membership hands its thing over while it is being paid for.
      const member = soldAMembership(product, { mode: session.mode, metadata: meta });
      if (member) {
        const sub = session.subscription as { status?: unknown } | null;
        if (!sub || typeof sub !== "object" || !isLive(sub.status)) {
          found.set(id, {
            reference: id,
            kind: "sale",
            title: product.title,
            option: null,
            paidAt: typeof session.created === "number" ? session.created : 0,
            member: false,
            ended: true,
            productId: product.id,
            bumpId: null,
            courseProduct: null,
            main: null,
            bump: null,
            items: null,
            bumpItems: null,
          });
          continue;
        }
      }

      const { delivery, option } = deliveryOf(product, meta.option);
      const added = meta.bump ? await find(meta.bump) : null;
      const bump = added && (added.file || added.link) ? { title: added.title, file: added.file, link: added.link } : null;
      const courseProduct = product.course ? product.id : null;
      // A bundle, bought or ticked: its products, from the list on the order.
      const items = await linesOf(find, bundleFromMeta(meta, "bundle"));
      const bumpItems = added ? await linesOf(find, bundleFromMeta(meta, "bump_bundle")) : null;
      if (!delivery && !bump && !courseProduct && !items && !bumpItems) continue;

      if (typeof session.customer === "string" && CUSTOMER_PATTERN.test(session.customer)) customers.add(session.customer);
      found.set(id, {
        reference: id,
        kind: "sale",
        title: product.title,
        option,
        paidAt: typeof session.created === "number" ? session.created : 0,
        member,
        ended: false,
        productId: product.id,
        bumpId: (bump || bumpItems) && added ? added.id : null,
        courseProduct,
        main: courseProduct ? null : delivery,
        bump,
        items,
        bumpItems,
      });
    }
  }

  // What was added in one click after paying is its own payment, made for
  // the customer the checkout created.
  for (const customer of account ? [...customers].slice(0, 10) : []) {
    const query = new URLSearchParams({ customer, limit: "50" });
    query.append("expand[]", "data.latest_charge");
    const listed = (await onAccount("GET", account as string, `/payment_intents?${query}`)) as Listed;
    for (const intent of rows(listed)) {
      const id = typeof intent.id === "string" ? intent.id : "";
      if (!INTENT_ID_PATTERN.test(id) || found.has(id)) continue;
      const meta = (intent.metadata ?? {}) as Record<string, string>;
      if (meta.kind !== "upsell" || !handles.has(meta.store ?? "")) continue;
      if (intent.status !== "succeeded" || refunded(intent)) continue;
      const product = await find(meta.product);
      const items = product ? await linesOf(find, bundleFromMeta(meta, "bundle")) : null;
      if (!product || !(product.file || product.link || items)) continue;
      found.set(id, {
        reference: id,
        kind: "upsell",
        title: product.title,
        option: null,
        paidAt: typeof intent.created === "number" ? intent.created : 0,
        member: false,
        ended: false,
        productId: product.id,
        bumpId: null,
        courseProduct: null,
        main: product.file || product.link ? { title: product.title, file: product.file, link: product.link } : null,
        bump: null,
        items,
        bumpItems: null,
      });
    }
  }

  // Brought over from another platform by the creator: no payment here, so
  // nothing on Stripe to read, and shown as exactly that.
  if (store.pastBuyers && store.statsId) {
    for (const given of await importedFor(store, email)) {
      const product = await find(given.productId);
      if (!product) continue;
      const reference = importedReference(store.statsId, email, product.id);
      const { delivery } = deliveryOf(product, undefined);
      const items = given.items?.length ? await linesOf(find, given.items) : null;
      const courseProduct = product.course ? product.id : null;
      if (!delivery && !courseProduct && !items) continue;
      found.set(reference, {
        reference,
        kind: "imported",
        title: product.title,
        option: null,
        paidAt: given.at,
        member: false,
        ended: false,
        productId: product.id,
        bumpId: null,
        courseProduct,
        main: courseProduct ? null : delivery,
        bump: null,
        items,
        bumpItems: null,
      });
    }
  }

  // An ended membership is shown once, and not at all when the same address
  // has joined again since: the running one is what they have.
  const all = [...found.values()].sort((a, b) => b.paidAt - a.paidAt);
  const running = new Set(all.filter((p) => p.member).map((p) => p.productId));
  const shownEnded = new Set<string>();
  const kept = all.filter((p) => {
    if (!p.ended) return true;
    if (running.has(p.productId) || shownEnded.has(p.productId)) return false;
    shownEnded.add(p.productId);
    return true;
  });
  return kept.slice(0, MAX_LISTED);
}

async function within(key: string, limit: number): Promise<boolean> {
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", RATE_WINDOW_SECONDS, "NX"],
    ["INCR", key],
  ]);
  return Number(count) <= limit;
}

/** A name that can sit inside the quotes of an email's From line. */
function displayName(name: string): string {
  return name.replace(/["\\<>\r\n]/g, "").trim().slice(0, 60) || "A store";
}

function senderAddress(): string {
  const match = NIMBUS_FROM.match(/<([^>]+)>/);
  return (match ? match[1] : NIMBUS_FROM).trim();
}

type Grant = {
  /** The connected account the purchases are on. */
  a: string;
  /** The address that proved it reads its own inbox. */
  e: string;
};

export type OrdersRequest = "sent" | "email" | "limited" | "unavailable" | "error";

/**
 * Emails a way back to what the address bought here.
 *
 * "sent" is the answer whether or not anything was found, and nothing is sent
 * to an address that bought nothing, so this cannot be used to learn who is a
 * customer of whom, or to fill a stranger's inbox.
 */
export async function requestOrdersLink(input: {
  store: Store;
  email: string;
  ip: string;
  origin: string;
}): Promise<OrdersRequest> {
  const { store, ip, origin } = input;
  const raw = input.email.trim();
  if (!raw || raw.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(raw)) return "email";
  const email = normaliseEmail(raw);
  if (!canRecover(store)) return "unavailable";

  if (!(await within(ipKey(ip, store.handle), IP_LIMIT))) return "limited";
  if (!(await within(addressKey(email), ADDRESS_LIMIT))) return "limited";

  const [purchases, calls] = await Promise.all([purchasesFor(store, raw), callsFor(store, raw)]);
  if (purchases.length === 0 && calls.length === 0) return "sent";

  const token = randomBytes(32).toString("hex");
  // Kept as typed: Stripe matches the address as it was written at checkout.
  const grant: Grant = { a: grantAccount(store), e: raw };
  await redisPipeline([["SET", tokenKey(token), JSON.stringify(grant), "EX", ORDERS_LINK_SECONDS]]);

  const name = store.name;
  const count = purchases.length + calls.length;
  const link = `${origin}/@${store.handle}/orders?token=${token}`;
  const sent = await sendEmail({
    from: `"${displayName(name)} via Nimbus Labs" <${senderAddress()}>`,
    to: email,
    subject: `What you bought from ${name}`,
    text: [
      `You asked for what you bought from ${name}. ${count === 1 ? "Here it is" : `Here are all ${count}`}, ready to open again:`,
      "",
      link,
      "",
      "The link works for 24 hours, on any device. After that, ask again from the store and a new one comes straight away.",
      "",
      "If you did not ask for this, ignore this email; nothing happens unless the link is opened.",
      "",
      purchases.some((p) => p.kind === "imported")
        ? `Sent by Nimbus Labs on behalf of ${name}. What you bought here was charged by ${name} on their own Stripe account; what ${name} brought over from another platform was not charged again.`
        : `Sent by Nimbus Labs on behalf of ${name}. Every purchase was charged by ${name} on their own Stripe account.`,
    ].join("\n"),
  });
  return sent ? "sent" : "error";
}

/** The address a live link was issued to, for this store only. */
export async function ordersGrant(store: Store, token: string): Promise<string | null> {
  if (!ORDERS_TOKEN_PATTERN.test(token) || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", tokenKey(token)]]);
  if (typeof raw !== "string" || !raw) return null;
  try {
    const grant = JSON.parse(raw) as Partial<Grant>;
    if (grant.a !== grantAccount(store) || typeof grant.e !== "string" || !grant.e) return null;
    return grant.e;
  } catch {
    return null;
  }
}

/**
 * The one purchase a download asks for, when the link's address paid for it.
 * Read again from Stripe, so a refund made a minute ago is already honoured.
 */
export async function findPurchase(store: Store, token: string, reference: string): Promise<Purchase | null> {
  if (reference.startsWith("imp_") && !IMPORTED_REFERENCE.test(reference)) return null;
  const email = await ordersGrant(store, token);
  if (!email) return null;
  const purchases = await purchasesFor(store, email);
  return purchases.find((p) => p.reference === reference) ?? null;
}
