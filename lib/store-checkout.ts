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
import type { ProductFile } from "@/lib/product-file";
import {
  type ProductOption,
  lowestPriceCents,
  optionDelivers,
} from "@/lib/product-option";
import { isPaidUp } from "@/lib/billing";
import { StripeError, onAccount, platformKey } from "@/lib/stripe-account";
import { activeBump } from "@/lib/product-extras";

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
 * The options a buyer may actually be offered.
 *
 * An option with nothing behind it is left off the page rather than sold and
 * apologised for afterwards. The creator is told about it in the studio, which
 * is where it can be fixed; the buyer never meets it.
 */
export function sellableOptions(product: Product): ProductOption[] {
  return product.options.filter(optionDelivers);
}

/**
 * A product can only be sold once there is something to hand over.
 *
 * Either kind counts: a file we host, or a link to wherever the creator keeps
 * it. What is refused is a product with neither, because a buyer would pay and
 * then be shown nothing.
 *
 * With price options the same question is asked of them instead of the
 * product: at least one has to be ready, because that is what the buyer picks.
 */
export function canSellProduct(store: Store, product: Product): boolean {
  // Something free is never sold. It has its own door, and a checkout for
  // nothing would be a card form that cannot work.
  if (product.priceCents === 0) return false;
  if (!canSell(store)) return false;
  // A call delivers a time, not a file: it is ready once it has hours set.
  if (product.call) return product.options.length === 0 && product.recurring === null;
  if (product.options.length > 0) return sellableOptions(product).length > 0;
  return product.file !== null || product.link !== null;
}

/** The figure a product card leads with: the cheapest way in. */
export function fromPriceCents(product: Product): number {
  return lowestPriceCents(sellableOptions(product), product.priceCents);
}

/**
 * Opens a checkout for one product and returns where to send the buyer.
 *
 * When the product has price options, the buyer's form sends an option id and
 * nothing else about money. The amount charged is read from the option the
 * creator saved, found here, on the server. A page that accepted a price from
 * the form would be a page where anything can be bought for a cent, and that
 * is the single rule this whole feature rests on.
 */
export async function createCheckout(
  store: Store,
  product: Product,
  origin: string,
  optionId?: string,
  extras: {
    /** The buyer ticked the box for the product offered alongside. */
    bump?: boolean;
    /** When the checkout closes, for a product whose units are held. */
    expiresAt?: number;
  } = {},
): Promise<{ url: string; id: string }> {
  if (!store.stripeAccountId) throw new Error("This store has no account");
  // A call is booked for a time, through its own door, never bought blind.
  if (product.call) throw new Error("A call is booked, not bought directly");

  const offered = sellableOptions(product);
  let chosen: ProductOption | null = null;
  if (offered.length > 0) {
    chosen = offered.find((option) => option.id === optionId) ?? null;
    // No id, or one that names nothing this product offers. Refusing beats
    // guessing: a buyer charged for the option they did not pick is a refund.
    if (!chosen) throw new Error("This product needs one of its options");
  }

  const membership = product.recurring;
  const priceCents = chosen ? chosen.priceCents : product.priceCents;
  const name = chosen ? `${product.title} (${chosen.label})` : product.title;

  const body = new URLSearchParams({
    mode: membership ? "subscription" : "payment",
    // In English, like every other page a buyer meets here, rather than in
    // whatever language Stripe guesses from the browser.
    locale: "en",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(priceCents),
    "line_items[0][price_data][product_data][name]": name,
    "metadata[store]": store.handle,
    "metadata[product]": product.id,
    // Kept on the charge itself so the order still says what was sold after
    // the creator renames or removes the product. Stripe's record outlives
    // ours, and the creator should not lose the history by tidying the store.
    "metadata[title]": name.slice(0, 480),
    success_url: `${origin}/@${store.handle}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/@${store.handle}`,
  });

  // Which option was bought decides which file is handed over later, so it
  // travels with the charge rather than being worked out again afterwards.
  if (chosen) body.set("metadata[option]", chosen.id);

  // The product the buyer chose to add, at the price the creator set for it
  // here — read from the store's record, never from the form.
  const bump = extras.bump && !membership ? activeBump(store.products, product) : null;
  if (bump) {
    body.set("line_items[1][quantity]", "1");
    body.set("line_items[1][price_data][currency]", "usd");
    body.set("line_items[1][price_data][unit_amount]", String(bump.bump.priceCents));
    body.set("line_items[1][price_data][product_data][name]", bump.target.title);
    body.set("metadata[bump]", bump.target.id);
    body.set("metadata[title]", `${name} + ${bump.target.title}`.slice(0, 480));
    body.set("payment_intent_data[metadata][bump]", bump.target.id);
  }

  // A limited product's unit is held while this checkout is open, so the
  // checkout closes when the hold does.
  if (extras.expiresAt) body.set("expires_at", String(extras.expiresAt));

  // The box a buyer types a discount code into, shown only by a store that has
  // one. An empty box on every checkout is an invitation to go and look for a
  // code that does not exist, and a buyer who leaves to search for one is a
  // buyer who may not come back. What a code takes off is worked out by Stripe
  // from a coupon on the creator's own account; no amount is decided here.
  if (store.hasDiscounts) body.set("allow_promotion_codes", "true");

  if (membership) {
    // The subscription is created on the creator's own account, like every
    // other charge here, so the member is their customer and not ours.
    body.set("line_items[0][price_data][recurring][interval]", membership.interval);
    body.set("subscription_data[metadata][store]", store.handle);
    body.set("subscription_data[metadata][product]", product.id);
    if (chosen) body.set("subscription_data[metadata][option]", chosen.id);
  } else {
    body.set("payment_intent_data[metadata][store]", store.handle);
    body.set("payment_intent_data[metadata][product]", product.id);
    if (chosen) body.set("payment_intent_data[metadata][option]", chosen.id);
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
  if (typeof session.url !== "string" || !session.url || typeof session.id !== "string") {
    throw new Error("Stripe did not return a checkout URL");
  }
  return { url: session.url, id: session.id };
}

export type Order =
  | {
      state: "paid";
      product: Product;
      /** The price option that was bought, when the product has any. */
      option: ProductOption | null;
      /** What to hand over: the option's if there was one, else the product's. */
      file: ProductFile | null;
      link: string | null;
      amount: number;
      /** The address the buyer paid with, so the link can be sent again. */
      email: string | null;
      /** How long this download still has, in seconds. */
      secondsLeft: number;
      /** For a paid call: the time booked, and the buyer's own time zone. */
      call: { start: number; end: number; buyerTz: string } | null;
      /** The product the buyer added at checkout, with what it delivers. */
      bump: { product: Product; file: ProductFile | null; link: string | null } | null;
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

  // The option is read from the charge, not from anything the visitor sends.
  // An option the creator has since removed leaves the order readable and its
  // delivery empty, which the pages say plainly rather than guessing another.
  const option =
    product.options.find((entry) => entry.id === metadata?.option) ?? null;

  if (session.status !== "complete" || session.payment_status !== "paid") {
    return { state: "unpaid" };
  }

  const created = typeof session.created === "number" ? session.created : 0;
  const age = Date.now() / 1000 - created;
  if (age > DOWNLOAD_WINDOW_SECONDS) return { state: "expired" };

  const details = session.customer_details as { email?: unknown } | null;
  const email =
    typeof details?.email === "string" && details.email ? details.email : null;

  const start = Number(metadata?.start);
  const end = Number(metadata?.end);
  const call =
    metadata?.kind === "call" && Number.isFinite(start) && Number.isFinite(end) && end > start
      ? { start, end, buyerTz: typeof metadata?.tz === "string" ? metadata.tz : "UTC" }
      : null;

  // Delivered as it is now, like the product itself: the offer may since have
  // changed, but what was paid for was this product.
  const added = metadata?.bump ? store.products.find((p) => p.id === metadata.bump) ?? null : null;
  const bump = added ? { product: added, file: added.file, link: added.link } : null;

  return {
    state: "paid",
    call,
    bump,
    product,
    option,
    file: option ? option.file : product.options.length > 0 ? null : product.file,
    link: option ? option.link : product.options.length > 0 ? null : product.link,
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
  /** A booked call delivers a time, not a download. */
  isCall: boolean;
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
        isCall: row.metadata?.kind === "call",
      };
    })
    .filter((sale) => sale.reference !== "");

  return { state: "ok", sales };
}
