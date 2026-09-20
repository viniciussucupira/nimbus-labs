/**
 * The one way Nimbus Labs makes money.
 *
 * A monthly subscription on our own Stripe account, and nothing else. This is
 * the other half of the promise the home page makes: 0% of the creator's
 * sales, because the creator's sales never touch us, and a single price that
 * is the same whether they sell three files or three thousand.
 *
 * Note which account each call runs on. Everything here is the PLATFORM
 * account — no Stripe-Account header anywhere in this file. The creator's own
 * account lives in stripe-connect.ts and store-checkout.ts, and the two must
 * never be confused: a charge made on the wrong one is either us taking a cut
 * we promised not to take, or us billing ourselves.
 */
import {
  CUSTOMER_PATTERN,
  SUBSCRIPTION_PATTERN,
  type Store,
} from "@/lib/store";

/** What a creator pays, in cents. Matches the price published on the site. */
export const PRICE_CENTS = 2900;

/**
 * Days before the first charge.
 *
 * Long enough to open a store, connect Stripe and make a real sale, which is
 * the only honest way to find out whether this is worth paying for.
 */
export const TRIAL_DAYS = 14;

/** Local tests may point this at a mock on 127.0.0.1; nothing else is taken. */
const STRIPE_API = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  process.env.STRIPE_CONNECT_API_BASE ?? "",
)
  ? `${process.env.STRIPE_CONNECT_API_BASE}/v1`
  : "https://api.stripe.com/v1";

function platformKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) return null;
  return key;
}

export function isBillingConfigured(): boolean {
  return platformKey() !== null;
}

const SESSION_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export class BillingError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, stripeMessage: string) {
    // Stripe's sentence is kept. A bare code in a log costs a trip through the
    // dashboard before anyone knows what went wrong.
    super(`Stripe billing failed (${status} ${code}): ${stripeMessage}`);
    this.status = status;
    this.code = code;
  }
}

async function onPlatform(
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams,
): Promise<Record<string, unknown>> {
  const key = platformKey();
  if (!key) throw new Error("Billing is not configured");

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
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
    throw new BillingError(
      response.status,
      error?.code ?? error?.type ?? "unknown",
      error?.message ?? "Stripe gave no reason.",
    );
  }
  return data;
}

/**
 * Opens the page where a creator starts paying, and returns where to send them.
 *
 * The price is built inline rather than kept as an object in the Stripe
 * dashboard, so there is one place where the number lives — this file — and no
 * way for the site to say $29 while a forgotten dashboard object charges
 * something else.
 */
export async function createBillingCheckout(
  store: Store,
  origin: string,
): Promise<string> {
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(PRICE_CENTS),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": "Nimbus Labs",
    "line_items[0][price_data][product_data][description]":
      "One store, 0% of your sales.",
    customer_email: store.email,
    "subscription_data[trial_period_days]": String(TRIAL_DAYS),
    "subscription_data[metadata][store]": store.handle,
    "metadata[store]": store.handle,
    success_url: `${origin}/api/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/studio?billing=cancelled`,
  });

  const session = await onPlatform("POST", "/checkout/sessions", body);
  if (typeof session.url !== "string" || !session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}

/** What a finished checkout left behind, once Stripe confirms it is ours. */
export type StartedSubscription = {
  customerId: string;
  subscriptionId: string;
  active: boolean;
};

/**
 * Reads a returning checkout session and says what it actually created.
 *
 * The session id arrives in a URL the creator's browser followed, so it is
 * treated as a claim, not a fact: it must look like a session id, Stripe must
 * know it, it must be a subscription, and its metadata must name this very
 * store. A session from somewhere else buys nothing here.
 */
export async function readStartedSubscription(
  store: Store,
  sessionId: string | undefined,
): Promise<StartedSubscription | null> {
  if (!sessionId || !SESSION_PATTERN.test(sessionId)) return null;

  let session: Record<string, unknown>;
  try {
    session = await onPlatform(
      "GET",
      `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    );
  } catch (error) {
    if (error instanceof BillingError && error.status === 404) return null;
    throw error;
  }

  if (session.mode !== "subscription") return null;
  const metadata = session.metadata as Record<string, string> | null;
  if (metadata?.store !== store.handle) return null;

  const customerId = typeof session.customer === "string" ? session.customer : "";
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : "";
  if (!CUSTOMER_PATTERN.test(customerId)) return null;
  if (!SUBSCRIPTION_PATTERN.test(subscriptionId)) return null;

  const state = await readSubscription(subscriptionId);
  return { customerId, subscriptionId, active: state.state === "active" };
}

export type SubscriptionState =
  /** Paying, or inside the trial. Either way the store may take money. */
  | { state: "active"; trialing: boolean; until: number }
  /** Stripe knows it and it is not paying: unpaid, cancelled, incomplete. */
  | { state: "inactive"; reason: string }
  /** Stripe could not be asked. Says nothing about whether they pay. */
  | { state: "unknown" };

/**
 * The statuses Stripe treats as a subscription in good standing.
 *
 * `past_due` is deliberately in here: a card that failed this morning is a
 * card, not a decision to leave, and Stripe retries it for days. Cutting a
 * creator's store off mid-retry would take their sales away over a bank's
 * timing.
 */
const GOOD = new Set(["active", "trialing", "past_due"]);

/** Asks Stripe what a subscription is doing right now. */
export async function readSubscription(
  subscriptionId: string,
): Promise<SubscriptionState> {
  if (!SUBSCRIPTION_PATTERN.test(subscriptionId)) {
    return { state: "inactive", reason: "shape" };
  }

  let subscription: Record<string, unknown>;
  try {
    subscription = await onPlatform(
      "GET",
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
  } catch (error) {
    if (error instanceof BillingError && error.status === 404) {
      return { state: "inactive", reason: "missing" };
    }
    console.error("reading the subscription failed", error);
    return { state: "unknown" };
  }

  const status = typeof subscription.status === "string" ? subscription.status : "";
  if (!GOOD.has(status)) return { state: "inactive", reason: status || "unknown" };

  const ends =
    typeof subscription.current_period_end === "number"
      ? subscription.current_period_end
      : 0;
  return { state: "active", trialing: status === "trialing", until: ends };
}

/**
 * Whether this store is paid up, read from what we wrote down.
 *
 * The snapshot is what the public store page uses, because a buyer's page load
 * must not wait on a call to Stripe. The studio refreshes it every time the
 * creator opens it, which is the moment they would notice it being wrong.
 */
export function isPaidUp(store: Store): boolean {
  return store.subscriptionActive;
}
