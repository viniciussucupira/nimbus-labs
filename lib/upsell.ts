/**
 * The one-click upsell: after paying, one press adds another product, charged
 * to the card the buyer just used, on the creator's own account.
 *
 * What keeps it honest and safe:
 *
 *   - the card is saved only for payments made while the buyer is there
 *     (setup_future_usage "on_session"), never to be charged behind their back;
 *   - the offer only works in the browser that paid: a secret cookie is set
 *     when the checkout opens and its fingerprint travels with the charge, so
 *     a thanks-page link that is forwarded cannot be used to charge the card;
 *   - it is open for an hour after paying and can be taken once, guarded so a
 *     double press charges once;
 *   - when the bank asks the buyer to confirm, they are sent to confirm it,
 *     and nothing is delivered until Stripe says it is paid.
 */
import { createHash, randomBytes } from "node:crypto";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { StripeError, onAccount } from "@/lib/stripe-account";
import { activeUpsell } from "@/lib/product-extras";
import type { Product, Store } from "@/lib/store";
import type { ProductFile } from "@/lib/product-file";

export const UPSELL_COOKIE = "nl_upsell";
export const UPSELL_WINDOW_SECONDS = 60 * 60;
const RECORD_SECONDS = 8 * 24 * 60 * 60;
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

type UpsellRecord = { state: "pending" | "paid" | "failed"; product: string; pi?: string; at: number };

const recordKey = (session: string) => `nl:upsell:${session}`;

export function newUpsellKey(): { secret: string; fingerprint: string } {
  const secret = randomBytes(24).toString("hex");
  return { secret, fingerprint: fingerprint(secret) };
}

export function fingerprint(secret: string): string {
  return createHash("sha256").update(`nimbus-upsell:${secret}`).digest("hex").slice(0, 40);
}

export async function readUpsell(session: string): Promise<UpsellRecord | null> {
  if (!isRedisConfigured() || !SESSION_ID.test(session)) return null;
  const [raw] = await redisPipeline([["GET", recordKey(session)]]);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as UpsellRecord;
  } catch {
    return null;
  }
}

async function writeUpsell(session: string, record: UpsellRecord): Promise<void> {
  await redisPipeline([["SET", recordKey(session), JSON.stringify(record), "EX", RECORD_SECONDS]]);
}

export type TakeResult =
  | { kind: "done" }
  | { kind: "confirm"; url: string }
  | { kind: "failed" }
  | { kind: "unavailable" };

type SessionView = {
  status?: unknown;
  payment_status?: unknown;
  created?: unknown;
  customer?: unknown;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: unknown } | null;
  payment_intent?: { id?: unknown; payment_method?: unknown } | string | null;
};

/** Reads a paid checkout of this store, with what an upsell needs from it. */
async function paidSession(store: Store, session: string): Promise<{ view: SessionView; product: Product } | null> {
  if (!store.stripeAccountId || !SESSION_ID.test(session)) return null;
  let view: SessionView;
  try {
    view = (await onAccount(
      "GET",
      store.stripeAccountId,
      `/checkout/sessions/${encodeURIComponent(session)}?expand[]=payment_intent`,
    )) as SessionView;
  } catch {
    return null;
  }
  if (view.status !== "complete" || view.payment_status !== "paid") return null;
  if (view.metadata?.store !== store.handle) return null;
  const product = store.products.find((p) => p.id === view.metadata?.product);
  return product ? { view, product } : null;
}

/** Whether the offer can still be shown to this browser, for this order. */
export function offerOpen(createdSeconds: number, secret: string | undefined, key: string | undefined): boolean {
  if (!secret || !key || fingerprint(secret) !== key) return false;
  return Date.now() / 1000 - createdSeconds <= UPSELL_WINDOW_SECONDS;
}

/**
 * Charges the upsell to the card the buyer just paid with.
 *
 * `secret` is the cookie from the buyer's own browser; without it, or after
 * the hour, or a second time, nothing is charged.
 */
export async function takeUpsell(input: {
  store: Store;
  session: string;
  secret: string | undefined;
  origin: string;
}): Promise<TakeResult> {
  const { store, session, secret, origin } = input;
  if (!store.stripeAccountId || !isRedisConfigured()) return { kind: "unavailable" };
  const found = await paidSession(store, session);
  if (!found) return { kind: "unavailable" };
  const { view, product } = found;
  // A one-click charge cannot carry Stripe Tax, so with tax on there is none.
  const offer = store.tax.enabled ? null : activeUpsell(store.products, product);
  if (!offer) return { kind: "unavailable" };
  const created = typeof view.created === "number" ? view.created : 0;
  if (!offerOpen(created, secret, view.metadata?.upsell_key)) return { kind: "unavailable" };

  // Once, however many times the button is pressed.
  const [claimed] = await redisPipeline([
    ["SET", recordKey(session), JSON.stringify({ state: "pending", product: offer.target.id, at: Date.now() }), "NX", "EX", RECORD_SECONDS],
  ]);
  if (claimed === null) {
    const existing = await readUpsell(session);
    return existing?.state === "paid" ? { kind: "done" } : existing?.state === "failed" ? { kind: "failed" } : { kind: "done" };
  }

  const intent = typeof view.payment_intent === "object" && view.payment_intent ? view.payment_intent : null;
  const method = typeof intent?.payment_method === "string" ? intent.payment_method : null;
  const customer = typeof view.customer === "string" ? view.customer : null;
  if (!method || !customer) {
    await writeUpsell(session, { state: "failed", product: offer.target.id, at: Date.now() });
    return { kind: "failed" };
  }

  const email = typeof view.customer_details?.email === "string" ? view.customer_details.email : "";
  const body = new URLSearchParams({
    amount: String(offer.bump.priceCents),
    currency: "usd",
    customer,
    payment_method: method,
    confirm: "true",
    return_url: `${origin}/@${store.handle}/thanks?session_id=${encodeURIComponent(session)}&upsell=back`,
    description: offer.target.title.slice(0, 200),
    "metadata[store]": store.handle,
    "metadata[product]": offer.target.id,
    "metadata[title]": offer.target.title.slice(0, 480),
    "metadata[kind]": "upsell",
    "metadata[parent]": session,
  });
  if (email) body.set("receipt_email", email);

  try {
    const pi = await onAccount("POST", store.stripeAccountId, "/payment_intents", body);
    const id = typeof pi.id === "string" ? pi.id : "";
    if (pi.status === "succeeded") {
      await writeUpsell(session, { state: "paid", product: offer.target.id, pi: id, at: Date.now() });
      return { kind: "done" };
    }
    const next = pi.next_action as { redirect_to_url?: { url?: unknown } } | null;
    const url = typeof next?.redirect_to_url?.url === "string" ? next.redirect_to_url.url : "";
    if (pi.status === "requires_action" && url) {
      await writeUpsell(session, { state: "pending", product: offer.target.id, pi: id, at: Date.now() });
      return { kind: "confirm", url };
    }
    await writeUpsell(session, { state: "failed", product: offer.target.id, pi: id, at: Date.now() });
    return { kind: "failed" };
  } catch (error) {
    if (!(error instanceof StripeError) || error.status >= 500) console.error("upsell charge failed", error);
    await writeUpsell(session, { state: "failed", product: offer.target.id, at: Date.now() });
    return { kind: "failed" };
  }
}

/**
 * Settles an upsell the bank asked the buyer to confirm, once they are back:
 * paid only if Stripe says so, for this very order.
 */
export async function settleUpsell(store: Store, session: string): Promise<void> {
  const record = await readUpsell(session);
  if (!record || record.state !== "pending" || !record.pi || !store.stripeAccountId) return;
  try {
    const pi = await onAccount("GET", store.stripeAccountId, `/payment_intents/${encodeURIComponent(record.pi)}`);
    const meta = pi.metadata as Record<string, string> | null;
    if (meta?.parent !== session) return;
    if (pi.status === "succeeded") await writeUpsell(session, { ...record, state: "paid" });
    else if (pi.status === "requires_payment_method" || pi.status === "canceled") await writeUpsell(session, { ...record, state: "failed" });
  } catch (error) {
    console.error("settling an upsell failed", error);
  }
}

/** What the upsell delivers, once it is paid. */
export async function upsellDelivery(
  store: Store,
  session: string,
): Promise<{ product: Product; file: ProductFile | null; link: string | null } | null> {
  const record = await readUpsell(session);
  if (!record || record.state !== "paid") return null;
  const product = store.products.find((p) => p.id === record.product);
  return product ? { product, file: product.file, link: product.link } : null;
}
