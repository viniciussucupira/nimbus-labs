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
 * for what; a refunded sale and a membership that stopped are left off,
 * because Stripe says so, not because we remembered.
 *
 * Like cancelling a membership, this works whatever state the creator's own
 * Nimbus subscription is in: somebody paid for that file, and they get it.
 */
import { createHash, randomBytes } from "node:crypto";
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, normaliseEmail } from "@/lib/auth";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount, platformKey } from "@/lib/stripe-account";
import type { ProductFile } from "@/lib/product-file";
import type { Product, Store } from "@/lib/store";

/** How long the emailed link opens the list. */
export const ORDERS_LINK_SECONDS = 24 * 60 * 60;
export const ORDERS_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
/** The most purchases one list shows, newest first. */
export const MAX_LISTED = 40;

const IP_LIMIT = 10;
const ADDRESS_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60 * 60;
const LIVE = new Set(["active", "trialing", "past_due"]);
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

export type Purchase = {
  /** The Checkout Session, or the one-click payment, that paid for it. */
  reference: string;
  /** "sale" is a checkout; "upsell" is what was added in one click after it. */
  kind: "sale" | "upsell";
  title: string;
  /** The price option chosen, when the product has several. */
  option: string | null;
  paidAt: number;
  /** A membership, still being paid for. */
  member: boolean;
  /** A course opens on its own page rather than as a download. */
  courseProduct: string | null;
  main: Delivery | null;
  /** The product ticked at checkout, delivered with it. */
  bump: Delivery | null;
};

/** Whether this store's buyers can be offered this at all. */
export function canRecover(store: Store): boolean {
  return (
    Boolean(store.stripeAccountId) &&
    platformKey() !== null &&
    isRedisConfigured() &&
    isSenderConfigured()
  );
}

/** Whether the store sells anything a buyer would come back for. */
export function sellsDeliverables(store: Store): boolean {
  return store.products.some((p) => p.priceCents > 0 && !p.call);
}

function deliveryOf(product: Product, optionId: string | undefined): { delivery: Delivery | null; option: string | null } {
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

/** Whether Stripe says this charge was given back in full. */
function refunded(intent: unknown): boolean {
  if (!intent || typeof intent !== "object") return false;
  const charge = (intent as { latest_charge?: unknown }).latest_charge;
  return Boolean(charge && typeof charge === "object" && (charge as { refunded?: unknown }).refunded === true);
}

/**
 * Everything this address paid this store for that can be handed over again,
 * newest first, read from the creator's own Stripe account.
 */
export async function purchasesFor(store: Store, email: string): Promise<Purchase[]> {
  const account = store.stripeAccountId;
  if (!account) return [];
  const handles = new Set([store.handle, ...store.previousHandles]);
  const found = new Map<string, Purchase>();
  const customers = new Set<string>();

  // Stripe keeps the address as it was typed at checkout.
  const variants = [...new Set([email.trim(), normaliseEmail(email)])];
  for (const variant of variants) {
    const query = new URLSearchParams({ "customer_details[email]": variant, status: "complete", limit: "100" });
    query.append("expand[]", "data.subscription");
    query.append("expand[]", "data.payment_intent.latest_charge");
    const listed = (await onAccount("GET", account, `/checkout/sessions?${query}`)) as Listed;
    for (const session of rows(listed)) {
      const id = typeof session.id === "string" ? session.id : "";
      if (!SESSION_ID_PATTERN.test(id) || found.has(id)) continue;
      const meta = (session.metadata ?? {}) as Record<string, string>;
      if (!handles.has(meta.store ?? "")) continue;
      if (session.payment_status !== "paid") continue;
      if (meta.kind === "call") continue;
      const product = store.products.find((p) => p.id === meta.product);
      if (!product || product.call) continue;
      if (refunded(session.payment_intent)) continue;

      // A membership hands its thing over while it is being paid for.
      const member = session.mode === "subscription" && meta.kind !== "plan";
      if (member) {
        const sub = session.subscription as { status?: unknown } | null;
        if (!sub || typeof sub !== "object" || typeof sub.status !== "string" || !LIVE.has(sub.status)) continue;
      }

      const { delivery, option } = deliveryOf(product, meta.option);
      const added = meta.bump ? store.products.find((p) => p.id === meta.bump) ?? null : null;
      const bump = added && (added.file || added.link) ? { title: added.title, file: added.file, link: added.link } : null;
      const courseProduct = product.course ? product.id : null;
      if (!delivery && !bump && !courseProduct) continue;

      if (typeof session.customer === "string" && CUSTOMER_PATTERN.test(session.customer)) customers.add(session.customer);
      found.set(id, {
        reference: id,
        kind: "sale",
        title: product.title,
        option,
        paidAt: typeof session.created === "number" ? session.created : 0,
        member,
        courseProduct,
        main: courseProduct ? null : delivery,
        bump,
      });
    }
  }

  // What was added in one click after paying is its own payment, made for
  // the customer the checkout created.
  for (const customer of [...customers].slice(0, 10)) {
    const query = new URLSearchParams({ customer, limit: "50" });
    query.append("expand[]", "data.latest_charge");
    const listed = (await onAccount("GET", account, `/payment_intents?${query}`)) as Listed;
    for (const intent of rows(listed)) {
      const id = typeof intent.id === "string" ? intent.id : "";
      if (!INTENT_ID_PATTERN.test(id) || found.has(id)) continue;
      const meta = (intent.metadata ?? {}) as Record<string, string>;
      if (meta.kind !== "upsell" || !handles.has(meta.store ?? "")) continue;
      if (intent.status !== "succeeded" || refunded(intent)) continue;
      const product = store.products.find((p) => p.id === meta.product);
      if (!product || !(product.file || product.link)) continue;
      found.set(id, {
        reference: id,
        kind: "upsell",
        title: product.title,
        option: null,
        paidAt: typeof intent.created === "number" ? intent.created : 0,
        member: false,
        courseProduct: null,
        main: { title: product.title, file: product.file, link: product.link },
        bump: null,
      });
    }
  }

  return [...found.values()].sort((a, b) => b.paidAt - a.paidAt).slice(0, MAX_LISTED);
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

  const purchases = await purchasesFor(store, raw);
  if (purchases.length === 0) return "sent";

  const token = randomBytes(32).toString("hex");
  // Kept as typed: Stripe matches the address as it was written at checkout.
  const grant: Grant = { a: store.stripeAccountId as string, e: raw };
  await redisPipeline([["SET", tokenKey(token), JSON.stringify(grant), "EX", ORDERS_LINK_SECONDS]]);

  const name = store.name;
  const count = purchases.length;
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
      `Sent by Nimbus Labs on behalf of ${name}. Every purchase was charged by ${name} on their own Stripe account.`,
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
    if (grant.a !== store.stripeAccountId || typeof grant.e !== "string" || !grant.e) return null;
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
  const email = await ordersGrant(store, token);
  if (!email) return null;
  const purchases = await purchasesFor(store, email);
  return purchases.find((p) => p.reference === reference) ?? null;
}
