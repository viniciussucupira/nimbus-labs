/**
 * The one way Nimbus Labs makes money.
 *
 * A subscription on our own Stripe account, monthly or yearly, and nothing
 * else. This is
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
  type Cycle,
  type Tier,
  PLAN_NAMES,
  PLAN_PRICES,
  PRICE_CENTS,
  TRIAL_DAYS,
} from "@/lib/plan";
import {
  CUSTOMER_PATTERN,
  SUBSCRIPTION_PATTERN,
  type Store,
} from "@/lib/store";

/**
 * The price and the trial come from lib/plan.ts and are passed straight
 * through, so the checkout this file opens and the price the site advertises
 * cannot drift apart. They are re-exported because this file is where the
 * rest of the app already looks for them.
 */
export { PRICE_CENTS, TRIAL_DAYS };

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

/** Our products at Stripe, one per plan, under names we choose. */
const PRODUCT_IDS: Record<Tier, string> = {
  creator: "nimbus_labs_creator",
  pro: "nimbus_labs_pro",
};
const PRODUCT_DESCRIPTIONS: Record<Tier, string> = {
  creator: "One store, 0% of your sales.",
  pro: "Everything in Nimbus Labs, and what costs us money to run for you.",
};

/** The name each price is found by, so there is never a second one. */
export function lookupKey(tier: Tier, cycle: Cycle): string {
  return `nimbus_${tier}_${cycle}`;
}

function planFromLookupKey(key: unknown): { tier: Tier; cycle: Cycle } | null {
  const match = typeof key === "string" ? /^nimbus_(creator|pro)_(month|year)$/.exec(key) : null;
  return match ? { tier: match[1] as Tier, cycle: match[2] as Cycle } : null;
}

async function ensureProduct(tier: Tier): Promise<string> {
  const id = PRODUCT_IDS[tier];
  try {
    const found = await onPlatform("GET", `/products/${id}`);
    if (found.active === false) {
      await onPlatform("POST", `/products/${id}`, new URLSearchParams({ active: "true" }));
    }
    return id;
  } catch (error) {
    if (!(error instanceof BillingError) || error.status !== 404) throw error;
  }
  try {
    await onPlatform(
      "POST",
      "/products",
      new URLSearchParams({ id, name: PLAN_NAMES[tier], description: PRODUCT_DESCRIPTIONS[tier] }),
    );
  } catch (error) {
    // Made a moment ago by another request: that one is ours too.
    if (!(error instanceof BillingError) || error.code !== "resource_already_exists") throw error;
  }
  return id;
}

const priceIds = new Map<string, string>();

/**
 * The Stripe price for a plan, made the first time it is needed.
 *
 * The amount comes from lib/plan.ts, and a price at Stripe that no longer
 * matches it is replaced, never used: the number the site shows is the number
 * that is charged. A subscription has to point at a real price to be moved
 * from one plan to another, which is why these exist at all.
 */
export async function ensurePrice(tier: Tier, cycle: Cycle): Promise<string> {
  const key = lookupKey(tier, cycle);
  const amount = PLAN_PRICES[tier][cycle];
  const cached = priceIds.get(`${key}:${amount}`);
  if (cached) return cached;

  const listed = await onPlatform(
    "GET",
    `/prices?${new URLSearchParams({ "lookup_keys[]": key, active: "true", limit: "1" })}`,
  );
  const found = (listed.data as Record<string, unknown>[] | undefined)?.[0];
  const recurring = found?.recurring as { interval?: unknown } | null | undefined;
  if (
    found &&
    typeof found.id === "string" &&
    found.unit_amount === amount &&
    found.currency === "usd" &&
    recurring?.interval === cycle
  ) {
    priceIds.set(`${key}:${amount}`, found.id);
    return found.id;
  }

  const product = await ensureProduct(tier);
  const made = await onPlatform(
    "POST",
    "/prices",
    new URLSearchParams({
      currency: "usd",
      unit_amount: String(amount),
      "recurring[interval]": cycle,
      product,
      lookup_key: key,
      // Takes the name from an old price whose amount no longer matches.
      transfer_lookup_key: "true",
      nickname: `${PLAN_NAMES[tier]}, ${cycle === "year" ? "yearly" : "monthly"}`,
    }),
  );
  if (typeof made.id !== "string") throw new Error("Stripe did not return a price");
  priceIds.set(`${key}:${amount}`, made.id);
  return made.id;
}

/** The same price, written out on the checkout itself. */
function writeInline(body: URLSearchParams, tier: Tier, cycle: Cycle): void {
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(PLAN_PRICES[tier][cycle]));
  body.set("line_items[0][price_data][recurring][interval]", cycle);
  body.set("line_items[0][price_data][product_data][name]", PLAN_NAMES[tier]);
  body.set("line_items[0][price_data][product_data][description]", PRODUCT_DESCRIPTIONS[tier]);
}

/**
 * Opens the page where a creator starts paying, and returns where to send them.
 *
 * The amount lives in lib/plan.ts and nowhere else. If the price at Stripe
 * cannot be read or made just now, the checkout is still opened with the same
 * amount written out inline, so a creator ready to pay is never turned away
 * over it.
 */
export async function createBillingCheckout(
  store: Store,
  origin: string,
  choice: { tier: Tier; cycle: Cycle } = { tier: "creator", cycle: "month" },
): Promise<string> {
  const { tier, cycle } = choice;
  const body = new URLSearchParams({
    mode: "subscription",
    // English, always. Left to itself Stripe picks the language of the
    // browser, and a creator in the United States should never meet a
    // payment page in whatever language the last person to test it spoke.
    locale: "en",
    "line_items[0][quantity]": "1",
    customer_email: store.email,
    "subscription_data[trial_period_days]": String(TRIAL_DAYS),
    "subscription_data[metadata][store]": store.handle,
    "subscription_data[metadata][tier]": tier,
    "metadata[store]": store.handle,
    success_url: `${origin}/api/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/studio?billing=cancelled`,
  });

  let price: string | null = null;
  try {
    price = await ensurePrice(tier, cycle);
  } catch (error) {
    console.error("reading our price failed; opening the checkout with it inline", error);
  }
  if (price) {
    body.set("line_items[0][price]", price);
  } else {
    writeInline(body, tier, cycle);
  }

  let session: Record<string, unknown>;
  try {
    session = await onPlatform("POST", "/checkout/sessions", body);
  } catch (error) {
    // A price archived at Stripe since we last read it: forget it, and open
    // the checkout with the amount written out instead.
    if (!price || !(error instanceof BillingError) || error.status !== 400) throw error;
    priceIds.clear();
    body.delete("line_items[0][price]");
    writeInline(body, tier, cycle);
    session = await onPlatform("POST", "/checkout/sessions", body);
  }
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
  tier: Tier;
  cycle: Cycle;
  trialEnds: number;
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
  return {
    customerId,
    subscriptionId,
    active: state.state === "active",
    tier: state.state === "active" ? state.tier : "creator",
    cycle: state.state === "active" ? state.cycle : "month",
    trialEnds: state.state === "active" && state.trialing ? state.until : 0,
  };
}

export type SubscriptionState =
  /** Paying, or inside the trial. Either way the store may take money. */
  | {
      state: "active";
      trialing: boolean;
      /** When the paid period, or the trial, runs out. 0 if Stripe did not say. */
      until: number;
      /** Set to stop at `until`. Nothing more will be charged after it. */
      cancelsAtEnd: boolean;
      tier: Tier;
      cycle: Cycle;
      /** What each renewal charges, in cents, as Stripe has it. */
      amountCents: number;
      /** A change of plan is waiting on a payment the bank has not let through. */
      changePending: boolean;
    }
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

/**
 * When the period already paid for, or the trial, runs out.
 *
 * Stripe moved `current_period_end` off the subscription and onto its items
 * in 2025. This file sends no Stripe-Version header, so it reads whatever the
 * account's default version returns: the item first, the old top-level field
 * if an older account still carries it. While trialing it is the trial's end,
 * because that is the date a creator in the trial is actually deciding about.
 */
function periodEnd(subscription: Record<string, unknown>, trialing: boolean): number {
  if (trialing && typeof subscription.trial_end === "number") {
    return subscription.trial_end;
  }
  const items = subscription.items as
    | { data?: { current_period_end?: unknown }[] }
    | undefined;
  const fromItem = items?.data?.[0]?.current_period_end;
  if (typeof fromItem === "number") return fromItem;
  if (typeof subscription.current_period_end === "number") {
    return subscription.current_period_end;
  }
  return 0;
}

/**
 * Which plan a subscription is on, read from its price: the name we gave the
 * price when there is one, and the amount and interval otherwise, so a
 * subscription begun before prices had names is still read right.
 */
export function planOf(subscription: Record<string, unknown>): { tier: Tier; cycle: Cycle; amountCents: number } {
  const items = subscription.items as { data?: { price?: Record<string, unknown> }[] } | undefined;
  const price = items?.data?.[0]?.price ?? {};
  const recurring = price.recurring as { interval?: unknown } | null | undefined;
  const amountCents = typeof price.unit_amount === "number" ? price.unit_amount : 0;
  const named = planFromLookupKey(price.lookup_key);
  if (named) return { ...named, amountCents };
  const cycle: Cycle = recurring?.interval === "year" ? "year" : "month";
  const meta = subscription.metadata as Record<string, string> | null | undefined;
  const tier: Tier =
    meta?.tier === "pro" || (amountCents > 0 && amountCents >= PLAN_PRICES.pro[cycle]) ? "pro" : "creator";
  return { tier, cycle, amountCents };
}

/** One reading of a subscription, used for what Stripe sends back either way. */
function stateOf(subscription: Record<string, unknown>): SubscriptionState {
  const status = typeof subscription.status === "string" ? subscription.status : "";
  if (!GOOD.has(status)) return { state: "inactive", reason: status || "unknown" };

  const trialing = status === "trialing";
  // Newer versions also fill `cancel_at` when a subscription is set to stop at
  // the period's end, and a date set by hand in the dashboard lands there too.
  // Either way it stops, and the date it stops on is the one to show.
  const cancelAt = typeof subscription.cancel_at === "number" ? subscription.cancel_at : 0;
  return {
    state: "active",
    trialing,
    until: cancelAt || periodEnd(subscription, trialing),
    cancelsAtEnd: subscription.cancel_at_period_end === true || cancelAt > 0,
    ...planOf(subscription),
    changePending: Boolean(subscription.pending_update),
  };
}

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

  return stateOf(subscription);
}

/**
 * Stops the subscription at the end of what is already paid for, or takes
 * that back.
 *
 * Only ever the creator's own subscription: the id comes from their store
 * record, never from the request. Stopping at the period's end rather than on
 * the spot is what keeps the help page's promise — access until the end of
 * the period already paid for — and inside the trial it means the card is
 * never charged at all. Until that date the decision can be reversed.
 *
 * Errors are thrown, not swallowed: the caller has to tell the creator that
 * nothing changed, and "Stripe did not answer" is not "cancelled".
 */
export async function setCancelAtPeriodEnd(
  subscriptionId: string,
  cancel: boolean,
): Promise<SubscriptionState> {
  if (!SUBSCRIPTION_PATTERN.test(subscriptionId)) {
    return { state: "inactive", reason: "shape" };
  }
  const subscription = await onPlatform(
    "POST",
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    new URLSearchParams({ cancel_at_period_end: cancel ? "true" : "false" }),
  );
  return stateOf(subscription);
}

export type SwitchResult =
  /** Done: the subscription is on the new plan. */
  | { kind: "switched"; state: SubscriptionState }
  /** The bank wants the creator to confirm the charge; send them here. */
  | { kind: "confirm"; url: string }
  /** Already on that plan. */
  | { kind: "same" }
  /** Not now: cancelled, not in good standing, or a change is already waiting. */
  | { kind: "refused"; reason: "cancelling" | "standing" | "pending" };

const INVOICE_PAGE = /^https:\/\/invoice\.stripe\.com\//;
const LOCAL_PAGE = /^http:\/\/127\.0\.0\.1:\d+\//;

/**
 * Moves a subscription to another plan or billing cycle.
 *
 * Settled on the spot, and only if it is paid for: a move that costs more is
 * charged now, less what is left of the period already paid, and if the bank
 * refuses or asks the creator to confirm, nothing changes until it is paid. A
 * move that costs less leaves what is left as credit on their account, which
 * pays the next bills until it runs out. Inside the trial nothing is charged
 * and the trial keeps its end.
 */
export async function switchPlan(
  subscriptionId: string,
  choice: { tier: Tier; cycle: Cycle },
): Promise<SwitchResult> {
  if (!SUBSCRIPTION_PATTERN.test(subscriptionId)) return { kind: "refused", reason: "standing" };
  const path = `/subscriptions/${encodeURIComponent(subscriptionId)}`;
  const subscription = await onPlatform("GET", path);
  const status = typeof subscription.status === "string" ? subscription.status : "";
  if (status !== "active" && status !== "trialing") return { kind: "refused", reason: "standing" };
  if (subscription.cancel_at_period_end === true || (typeof subscription.cancel_at === "number" && subscription.cancel_at > 0)) {
    return { kind: "refused", reason: "cancelling" };
  }
  if (subscription.pending_update) return { kind: "refused", reason: "pending" };
  const now = planOf(subscription);
  if (
    now.tier === choice.tier &&
    now.cycle === choice.cycle &&
    now.amountCents === PLAN_PRICES[choice.tier][choice.cycle]
  ) {
    return { kind: "same" };
  }

  const items = subscription.items as { data?: { id?: unknown }[] } | undefined;
  const itemId = items?.data?.[0]?.id;
  if (typeof itemId !== "string") throw new Error("The subscription has no item to change");
  const price = await ensurePrice(choice.tier, choice.cycle);

  const body = new URLSearchParams({
    "items[0][id]": itemId,
    "items[0][price]": price,
    proration_behavior: "always_invoice",
    payment_behavior: "pending_if_incomplete",
    "metadata[tier]": choice.tier,
    "expand[]": "latest_invoice",
  });
  if (status === "trialing" && typeof subscription.trial_end === "number") {
    body.set("trial_end", String(subscription.trial_end));
  }
  let updated: Record<string, unknown>;
  try {
    updated = await onPlatform("POST", path, body);
  } catch (error) {
    // The next attempt reads the price from Stripe again.
    priceIds.clear();
    throw error;
  }

  if (updated.pending_update) {
    const invoice = updated.latest_invoice as { hosted_invoice_url?: unknown } | null;
    const url = typeof invoice?.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : "";
    if (INVOICE_PAGE.test(url) || (LOCAL_PAGE.test(url) && STRIPE_API.startsWith("http://127.0.0.1"))) {
      return { kind: "confirm", url };
    }
    return { kind: "refused", reason: "pending" };
  }
  return { kind: "switched", state: stateOf(updated) };
}

/**
 * One page of our own subscriptions in a given state, with each customer's
 * email, for the reminders sent before a charge.
 */
export async function listSubscriptions(
  status: "trialing" | "active",
  startingAfter?: string,
): Promise<{ data: Record<string, unknown>[]; hasMore: boolean }> {
  const query = new URLSearchParams({ status, limit: "100" });
  query.append("expand[]", "data.customer");
  if (startingAfter) query.set("starting_after", startingAfter);
  const page = await onPlatform("GET", `/subscriptions?${query}`);
  return {
    data: Array.isArray(page.data) ? (page.data as Record<string, unknown>[]) : [],
    hasMore: page.has_more === true,
  };
}

export { periodEnd };

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
