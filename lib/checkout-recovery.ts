/**
 * An abandoned checkout: one reminder, only to a buyer who said yes to it.
 *
 * A buyer who opens a store's checkout and leaves without paying is usually
 * someone who meant to come back and did not. One email an hour later, with
 * the way back to the product, is the whole of this feature. What makes it
 * something we are willing to send is what stands in front of it:
 *
 *   - The creator switches it on, in the studio. It is off for every store
 *     until they do, and it needs the postal address US law asks every email
 *     about buying something to carry.
 *   - The buyer agrees, on Stripe's own checkout page. The checkout is opened
 *     with Stripe's promotional-consent collection (consent_collection
 *     .promotions = "auto") and with recovery switched on
 *     (after_expiration.recovery), which is the pair Stripe documents for
 *     abandoned-cart email. A reminder goes out only when Stripe reports the
 *     buyer's consent as "opt_in"; a buyer who was not asked, or said no, is
 *     never written to. Stripe decides where the question is shown, and it
 *     offers it only to businesses in the United States, so the studio
 *     switches this on only for a Stripe account whose country is the US.
 *   - One email per checkout, one per address and product in a week, none to
 *     someone who has since paid for that product, and none ever again to an
 *     address that pressed stop — or that left the creator's list.
 *
 * Every checkout here is a direct charge on the creator's own account, and so
 * is the consent: the buyer agrees to hear from the business named on that
 * checkout page, which is the creator. We send for them, from their name.
 *
 * The link in the email is to the product on the store, not the one-time
 * recovery address Stripe also makes. That address re-opens a copy of the
 * old checkout — its old price, and none of the unit a limited product held
 * for it — while the store page opens a new one at today's price, with
 * today's stock. The store page is the one that cannot sell something wrong.
 *
 *   nl:recover:sent:<session>                the reminder for that checkout went
 *   nl:recover:once:<statsId>:<hash>         that address heard about that product this week
 *   nl:recover:off:<statsId>:<hash>          that address pressed stop, kept for good
 *   nl:recover:link:<token>                  who a stop link belongs to
 */
import { saleHandles } from "@/lib/store";
import { createHash, randomBytes } from "node:crypto";
import { normaliseEmail } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount, platformKey } from "@/lib/stripe-account";
import { RECOVERY_OPEN_SECONDS, recoveryOn } from "@/lib/recovery-setting";
import { isSettled } from "@/lib/instant-pay";
import { leadsKey, parseContact } from "@/lib/contacts";
import { canSellProduct, fromPriceCents } from "@/lib/store-checkout";
import { stockLeft } from "@/lib/stock";
import { type SessionRecord, fromCreator, storeBase } from "@/lib/purchase-email";
import { membershipPrice } from "@/lib/product-recurring";
import { activePwyw } from "@/lib/pay-what-you-want";
import { SITE_URL } from "@/lib/site-url";
import type { Store } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

/** A checkout that closed longer ago than this is left alone. */
export const REMIND_WITHIN_SECONDS = 6 * 60 * 60;
/** One reminder per address and product in this long, however many checkouts. */
export const ONCE_PER_SECONDS = 7 * 24 * 60 * 60;
/** How long a stop link keeps working. */
const LINK_SECONDS = 400 * 24 * 60 * 60;

export const STOP_TOKEN = /^[0-9a-f]{40}$/;
const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const who = (email: string) => sha(`nimbus-recover:${normaliseEmail(email)}`).slice(0, 32);
const sentKey = (session: string) => `nl:recover:sent:${session}`;
const onceKey = (statsId: string, email: string, product: string) =>
  `nl:recover:once:${statsId}:${sha(`nimbus-recover-once:${normaliseEmail(email)}|${product}`).slice(0, 32)}`;
const offKey = (statsId: string, email: string) => `nl:recover:off:${statsId}:${who(email)}`;
const linkKey = (token: string) => `nl:recover:link:${token}`;

export type CountryAnswer = { state: "ok"; country: string } | { state: "unknown" };

/** The country of the creator's Stripe account, as Stripe says. */
export async function accountCountry(store: Store): Promise<CountryAnswer> {
  if (!store.stripeAccountId || !platformKey()) return { state: "unknown" };
  try {
    const account = await onAccount("GET", store.stripeAccountId, "/account");
    return typeof account.country === "string" && account.country
      ? { state: "ok", country: account.country.toUpperCase() }
      : { state: "unknown" };
  } catch (error) {
    console.error("reading the account country failed", error);
    return { state: "unknown" };
  }
}

/** Where a reminder's link leads: the product's own page on the store. */
export function productLink(store: Store, productId: string): string {
  return `${storeBase(store)}/p/${encodeURIComponent(productId)}`;
}

async function stopLink(store: Store, email: string): Promise<{ page: string; oneClick: string }> {
  const token = randomBytes(20).toString("hex");
  const grant = { k: store.statsId, e: normaliseEmail(email), h: store.handle, n: store.name };
  await redisPipeline([["SET", linkKey(token), JSON.stringify(grant), "EX", LINK_SECONDS]]);
  return {
    page: `${SITE_URL}/unsubscribe?r=${token}`,
    oneClick: `${SITE_URL}/api/mail/unsubscribe?r=${token}`,
  };
}

/** Who a stop link belongs to, without acting on it. */
export async function readStopToken(
  token: string,
): Promise<{ email: string; storeName: string; stopped: boolean } | null> {
  if (!STOP_TOKEN.test(token) || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", linkKey(token)]]);
  if (typeof raw !== "string" || !raw) return null;
  try {
    const grant = JSON.parse(raw) as { k?: unknown; e?: unknown; n?: unknown };
    if (typeof grant.k !== "string" || typeof grant.e !== "string" || !grant.k || !grant.e) return null;
    const [off] = await redisPipeline([["EXISTS", offKey(grant.k, grant.e)]]);
    return { email: grant.e, storeName: typeof grant.n === "string" ? grant.n : "", stopped: Number(off) === 1 };
  } catch {
    return null;
  }
}

/** Stops every reminder from that store to that address, for good. Safe to press twice. */
export async function stopReminders(token: string): Promise<boolean> {
  if (!STOP_TOKEN.test(token) || !isRedisConfigured()) return false;
  const [raw] = await redisPipeline([["GET", linkKey(token)]]);
  if (typeof raw !== "string" || !raw) return false;
  try {
    const grant = JSON.parse(raw) as { k?: unknown; e?: unknown };
    if (typeof grant.k !== "string" || typeof grant.e !== "string" || !grant.k || !grant.e) return false;
    await redisPipeline([["SET", offKey(grant.k, grant.e), new Date().toISOString()]]);
    return true;
  } catch {
    return false;
  }
}

/** Whether the address paid this store for this product after the checkout opened. */
async function paidSince(store: Store, email: string, productId: string, since: number): Promise<boolean> {
  const handles = saleHandles(store);
  const query = new URLSearchParams({
    "customer_details[email]": email,
    status: "complete",
    "created[gte]": String(since),
    limit: "100",
  });
  const listed = await onAccount("GET", store.stripeAccountId as string, `/checkout/sessions?${query}`);
  const rows = Array.isArray(listed.data) ? (listed.data as SessionRecord[]) : [];
  return rows.some(
    (row) => isSettled(row) && handles.has(row.metadata?.store ?? "") && row.metadata?.product === productId,
  );
}

export type RemindOutcome = "sent" | "skip" | "failed";

/**
 * Sends the reminder for one checkout that closed unpaid, when everything
 * above allows it. Called by the five-minute job with each closed checkout
 * of a store that has reminders on.
 */
export async function remindAbandoned(
  store: Store,
  session: SessionRecord,
  nowSeconds = Date.now() / 1000,
): Promise<RemindOutcome> {
  if (!recoveryOn(store) || !store.stripeAccountId || !store.statsId) return "skip";
  const id = typeof session.id === "string" ? session.id : "";
  if (!SESSION_ID_PATTERN.test(id) || session.status !== "expired") return "skip";
  // Consent, as Stripe recorded it. Nothing else counts as a yes.
  if (session.consent?.promotions !== "opt_in") return "skip";
  const meta = session.metadata ?? {};
  const handles = saleHandles(store);
  if (!handles.has(meta.store ?? "") || meta.kind === "call") return "skip";
  const closed = typeof session.expires_at === "number" ? session.expires_at : 0;
  if (!closed || nowSeconds - closed > REMIND_WITHIN_SECONDS || closed > nowSeconds) return "skip";
  const typed = session.customer_details?.email;
  const email = typeof typed === "string" && typed ? typed : typeof session.customer_email === "string" ? session.customer_email : "";
  if (!email) return "skip";

  // Only something that can still be bought, and bought now.
  const product = meta.product ? await readListing(store, meta.product) : null;
  if (!product || product.call || !canSellProduct(store, product)) return "skip";
  const left = await stockLeft(store, product).catch(() => null);
  if (left === 0) return "skip";

  const created = typeof session.created === "number" ? session.created : closed - RECOVERY_OPEN_SECONDS;
  return deliver(store, product, email, {
    claim: id,
    since: created,
    why: `It reached you because you agreed, on the checkout page, to hear from ${store.name}.`,
  });
}

/**
 * Sends the reminder a buyer asked for themselves, on the way back from a
 * checkout they did not finish (lib/checkout-ask.ts). The same email, under
 * the same limits; what differs is who said yes, and where.
 */
export async function remindAsked(
  store: Store,
  ask: { productId: string; email: string; askedAt: number; key: string },
): Promise<RemindOutcome> {
  if (!recoveryOn(store) || !store.stripeAccountId || !store.statsId) return "skip";
  const product = await readListing(store, ask.productId);
  if (!product || product.call || product.hidden || !canSellProduct(store, product)) return "skip";
  const left = await stockLeft(store, product).catch(() => null);
  if (left === 0) return "skip";
  return deliver(store, product, ask.email, {
    claim: `ask-${ask.key}`,
    since: ask.askedAt,
    why: `It reached you because you asked for it on ${store.name}'s store.`,
  });
}

/**
 * The one email, and everything that stands in front of it whoever agreed:
 * never twice for one checkout, once per address and product in a week,
 * never to an address that pressed stop or left the creator's list, and
 * never to somebody who has paid for it since.
 */
async function deliver(
  store: Store,
  product: NonNullable<Awaited<ReturnType<typeof readListing>>>,
  email: string,
  how: { claim: string; since: number; why: string },
): Promise<RemindOutcome> {
  const id = how.claim;
  const statsId = store.statsId as string;
  const [sent, off, once, contact] = await redisPipeline([
    ["EXISTS", sentKey(id)],
    ["EXISTS", offKey(statsId, email)],
    ["EXISTS", onceKey(statsId, email, product.id)],
    store.listId ? ["HGET", leadsKey(store.listId), normaliseEmail(email)] : ["EXISTS", "nl:none"],
  ]);
  if (Number(sent) === 1 || Number(off) === 1 || Number(once) === 1) return "skip";
  // Someone who left the creator's list has said no to their email, and a
  // reminder is their email.
  if (store.listId && parseContact(contact)?.unsub) return "skip";

  if (await paidSince(store, email, product.id, how.since)) {
    await redisPipeline([["SET", sentKey(id), "paid", "EX", ONCE_PER_SECONDS]]);
    return "skip";
  }

  // Taken before sending: whichever pass gets here first is the only one.
  const [claimed, claimedOnce] = await redisPipeline([
    ["SET", sentKey(id), "sending", "NX", "EX", ONCE_PER_SECONDS * 2],
    ["SET", onceKey(statsId, email, product.id), "1", "NX", "EX", ONCE_PER_SECONDS],
  ]);
  if (claimed === null || claimedOnce === null) return "skip";

  const name = store.name;
  // The price as the store page says it: the floor of a price the buyer
  // chooses, and a membership's trial and set number of payments with it.
  const price = `${formatMoney(fromPriceCents(product), store.currency)}`;
  const from = product.options.length > 1 ? "from " : "";
  const priceWords = activePwyw(product)
    ? `you choose it, from ${formatMoney(product.priceCents, store.currency)}`
    : product.recurring
      ? `${from}${membershipPrice(product.recurring, price)}`
      : `${from}${price}`;
  const stop = await stopLink(store, email);
  const text = [
    `You started buying ${product.title} from ${name} and did not finish, so nothing was charged.`,
    "",
    "If you still want it, it is here:",
    productLink(store, product.id),
    "",
    `The price: ${priceWords}. The checkout opens at today's price.`,
    "",
    `This is the only reminder about that checkout. ${how.why}`,
    "",
    `Stop these reminders from ${name}: ${stop.page}`,
    `${name} · ${store.recovery.address}`,
    "Sent with Marktmorgen.",
  ].join("\n");

  let ok = false;
  try {
    ok = await sendEmail({
      // An email that asks for a sale is the creator's, like their list's:
      // from their own address where there is one (lib/mail-from.ts).
      from: fromCreator(store),
      to: email,
      subject: `You left ${product.title} at checkout`.slice(0, 200),
      text,
      replyTo: store.email,
      headers: { "List-Unsubscribe": `<${stop.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      idempotencyKey: `nimbus-recover:${id}`,
    });
  } finally {
    if (ok) {
      await redisPipeline([["SET", sentKey(id), "sent", "EX", ONCE_PER_SECONDS * 2]]);
    } else {
      await redisPipeline([["DEL", sentKey(id)], ["DEL", onceKey(statsId, email, product.id)]]);
    }
  }
  return ok ? "sent" : "failed";
}
