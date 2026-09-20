/**
 * Selling, on the creator's own Stripe account.
 *
 * Every charge here is a direct charge on the connected account, with no
 * application fee. That is not a detail: it is what makes the money the
 * creator's from the first second, puts their name on the buyer's statement,
 * and leaves Nimbus with nothing to hold, skim or lose. The 0% on the home
 * page is this file.
 */
import type { Product, Store } from "@/lib/store";
import { isPaidUp } from "@/lib/billing";

/** Local tests may point this at a mock on 127.0.0.1; nothing else is taken. */
const STRIPE_API = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  process.env.STRIPE_CONNECT_API_BASE ?? "",
)
  ? `${process.env.STRIPE_CONNECT_API_BASE}/v1`
  : "https://api.stripe.com/v1";

/**
 * How long a paid link keeps working.
 *
 * The session id in that link is what opens the download, so it is a key, and
 * a key that never expires is a file quietly published. Three days is long
 * enough for a buyer who checks mail on Monday and short enough that a link
 * forwarded once does not become a permanent leak.
 */
export const DOWNLOAD_WINDOW_SECONDS = 3 * 24 * 60 * 60;

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

function platformKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) return null;
  return key;
}

export function isSellingConfigured(): boolean {
  return platformKey() !== null;
}

/**
 * Whether this store can actually take money right now.
 *
 * Both halves matter. A connected account that Stripe has not cleared cannot
 * charge, and saying otherwise on the store page would take a buyer's time for
 * nothing.
 */
export function canSell(store: Store): boolean {
  return (
    isSellingConfigured() &&
    Boolean(store.stripeAccountId) &&
    store.stripeChargesEnabled &&
    // The third condition is how this company stays alive. Everything else
    // here is free — the address, the page, the editor, connecting Stripe —
    // and what the subscription buys is the till. A creator inside the trial
    // passes this too, because a trial that cannot sell proves nothing.
    isPaidUp(store)
  );
}

/**
 * A product can only be sold once there is something to hand over.
 *
 * Either kind counts: a file we host, or a link to wherever the creator keeps
 * it. What is refused is a product with neither, because a buyer would pay and
 * then be shown nothing.
 */
export function canSellProduct(store: Store, product: Product): boolean {
  return canSell(store) && (product.file !== null || product.link !== null);
}

class StripeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, stripeMessage: string) {
    // Stripe's own sentence is kept, because a bare code in a log is a trip
    // through the Stripe dashboard before anyone knows what went wrong.
    super(`Stripe request failed (${status} ${code}): ${stripeMessage}`);
    this.status = status;
    this.code = code;
  }
}

async function onAccount(
  method: "GET" | "POST",
  account: string,
  path: string,
  body?: URLSearchParams,
): Promise<Record<string, unknown>> {
  const key = platformKey();
  if (!key) throw new Error("Selling is not configured");

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      // The whole point: this acts on the creator's account, not ours.
      "Stripe-Account": account,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as
      | { code?: string; type?: string; message?: string }
      | undefined;
    throw new StripeError(
      response.status,
      error?.code ?? error?.type ?? "unknown",
      error?.message ?? "Stripe gave no reason.",
    );
  }
  return data;
}

/** Opens a checkout for one product and returns where to send the buyer. */
export async function createCheckout(
  store: Store,
  product: Product,
  origin: string,
): Promise<string> {
  if (!store.stripeAccountId) throw new Error("This store has no account");

  const membership = product.recurring;

  const body = new URLSearchParams({
    mode: membership ? "subscription" : "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(product.priceCents),
    "line_items[0][price_data][product_data][name]": product.title,
    "metadata[store]": store.handle,
    "metadata[product]": product.id,
    // Kept on the charge itself so the order still says what was sold after
    // the creator renames or removes the product. Stripe's record outlives
    // ours, and the creator should not lose the history by tidying the store.
    "metadata[title]": product.title.slice(0, 480),
    success_url: `${origin}/@${store.handle}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/@${store.handle}`,
  });

  if (membership) {
    // The subscription is created on the creator's own account, like every
    // other charge here, so the member is their customer and not ours.
    body.set("line_items[0][price_data][recurring][interval]", membership.interval);
    body.set("subscription_data[metadata][store]", store.handle);
    body.set("subscription_data[metadata][product]", product.id);
  } else {
    body.set("payment_intent_data[metadata][store]", store.handle);
    body.set("payment_intent_data[metadata][product]", product.id);
  }

  if (product.summary) {
    body.set("line_items[0][price_data][product_data][description]", product.summary);
  }

  const session = await onAccount(
    "POST",
    store.stripeAccountId,
    "/checkout/sessions",
    body,
  );
  if (typeof session.url !== "string" || !session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}

export type Order =
  | {
      state: "paid";
      product: Product;
      amount: number;
      /** The address the buyer paid with, so the link can be sent again. */
      email: string | null;
      /** How long this download still has, in seconds. */
      secondsLeft: number;
    }
  | { state: "unpaid" | "expired" | "invalid" | "unavailable" | "error" };

/**
 * Decides whether this buyer may have the file.
 *
 * Nothing about the visitor is trusted except the session id, and that is
 * checked against Stripe every time rather than against anything we wrote
 * down. The session must belong to this store and name a product this store
 * still lists, so a session from somewhere else cannot open a door here.
 */
export async function readOrder(
  store: Store,
  sessionId: string | undefined,
): Promise<Order> {
  if (!canSell(store)) return { state: "unavailable" };
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    return { state: "invalid" };
  }

  let session: Record<string, unknown>;
  try {
    session = await onAccount(
      "GET",
      store.stripeAccountId as string,
      `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    );
  } catch (error) {
    if (error instanceof StripeError && error.status === 404) {
      return { state: "invalid" };
    }
    console.error("order lookup failed", error);
    return { state: "error" };
  }

  const metadata = session.metadata as Record<string, string> | null;
  if (metadata?.store !== store.handle) return { state: "invalid" };
  const product = store.products.find((p) => p.id === metadata?.product);
  if (!product) return { state: "invalid" };

  if (session.status !== "complete" || session.payment_status !== "paid") {
    return { state: "unpaid" };
  }

  const created = typeof session.created === "number" ? session.created : 0;
  const age = Date.now() / 1000 - created;
  if (age > DOWNLOAD_WINDOW_SECONDS) return { state: "expired" };

  const details = session.customer_details as { email?: unknown } | null;
  const email =
    typeof details?.email === "string" && details.email ? details.email : null;

  return {
    state: "paid",
    product,
    amount: typeof session.amount_total === "number" ? session.amount_total : 0,
    email,
    secondsLeft: Math.max(0, Math.floor(DOWNLOAD_WINDOW_SECONDS - age)),
  };
}

/** How many past sales the studio shows at once. */
export const ORDERS_PAGE_SIZE = 25;

export type Sale = {
  /** Stripe's own id for the sale. The creator can search it in Stripe. */
  reference: string;
  title: string;
  amount: number;
  email: string | null;
  /** Seconds since the epoch, as Stripe counts them. */
  paidAt: number;
  /** Whether the buyer's own download link still opens. */
  stillDownloadable: boolean;
};

// Each state is its own member so a check on one narrows the rest away;
// a combined "unavailable" | "error" member does not narrow in a JSX chain.
export type SaleList =
  | { state: "ok"; sales: Sale[] }
  | { state: "unavailable" }
  | { state: "error" };

type SessionRecord = {
  id?: unknown;
  status?: unknown;
  payment_status?: unknown;
  created?: unknown;
  amount_total?: unknown;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: unknown } | null;
};

/**
 * What this store has sold.
 *
 * Read from the creator's own Stripe account every time rather than kept in a
 * table here. That costs a request, and it buys something worth more: there is
 * no second copy of the sales record to drift from the real one, and nothing
 * for us to lose, leak or quietly get wrong. Stripe is the ledger; this is a
 * window onto it.
 *
 * Only paid sessions carrying this store's handle are returned, so one
 * creator's account can never show another's sales even if an id were reused.
 */
export async function listSales(store: Store): Promise<SaleList> {
  if (!canSell(store)) return { state: "unavailable" };

  let page: Record<string, unknown>;
  try {
    page = await onAccount(
      "GET",
      store.stripeAccountId as string,
      `/checkout/sessions?limit=${ORDERS_PAGE_SIZE}`,
    );
  } catch (error) {
    console.error("listing orders failed", error);
    return { state: "error" };
  }

  const rows = Array.isArray(page.data) ? (page.data as SessionRecord[]) : [];
  const now = Date.now() / 1000;

  const sales = rows
    .filter(
      (row) =>
        row.status === "complete" &&
        row.payment_status === "paid" &&
        row.metadata?.store === store.handle,
    )
    .map((row): Sale => {
      const paidAt = typeof row.created === "number" ? row.created : 0;
      const known = store.products.find((p) => p.id === row.metadata?.product);
      const email = row.customer_details?.email;
      return {
        reference: typeof row.id === "string" ? row.id : "",
        // The title recorded on the charge wins, because it is what the buyer
        // saw. The current product name is only a fallback for older sales.
        title:
          row.metadata?.title ||
          known?.title ||
          "A product that is no longer listed",
        amount: typeof row.amount_total === "number" ? row.amount_total : 0,
        email: typeof email === "string" && email ? email : null,
        paidAt,
        stillDownloadable: now - paidAt <= DOWNLOAD_WINDOW_SECONDS,
      };
    })
    .filter((sale) => sale.reference !== "");

  return { state: "ok", sales };
}
