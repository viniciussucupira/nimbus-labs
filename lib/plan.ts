/**
 * What we charge, in one place.
 *
 * These numbers are read by the checkout that actually bills a creator and by
 * the pages that tell the world the price. They live here, rather than in
 * lib/billing.ts, because that file talks to Stripe with a secret key and must
 * never be pulled into a browser bundle — and a marketing page that cannot
 * import the real number ends up retyping it, which is how a site starts
 * advertising a price the checkout does not open with.
 *
 * Nothing in this file may ever read an environment variable or a secret. That
 * is the whole reason it is safe for a client component to import it.
 */

/** The two plans. Pro adds what costs us money to run for you. */
export type Tier = "creator" | "pro";
/** How often it is billed. */
export type Cycle = "month" | "year";

/** Every price we charge, in cents. Never below what Stan charges for the same. */
export const PLAN_PRICES: Record<Tier, Record<Cycle, number>> = {
  creator: { month: 2900, year: 30000 },
  pro: { month: 9900, year: 94800 },
};

/** The monthly subscription, in cents: the price the site leads with. */
export const PRICE_CENTS = PLAN_PRICES.creator.month;
/** The same plan, paid once a year. */
export const YEAR_PRICE_CENTS = PLAN_PRICES.creator.year;

/** What paying yearly saves over twelve monthly payments, in cents. */
export function yearSaving(tier: Tier): number {
  return PLAN_PRICES[tier].month * 12 - PLAN_PRICES[tier].year;
}

/** "$29 a month", "$300 a year". */
export function priceWords(tier: Tier, cycle: Cycle): string {
  const cents = PLAN_PRICES[tier][cycle];
  const dollars = cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100);
  return `$${dollars} a ${cycle}`;
}

export const PLAN_NAMES: Record<Tier, string> = {
  creator: "Nimbus Labs",
  pro: "Nimbus Labs Pro",
};

/**
 * Whether Pro can be bought.
 *
 * Pro is what costs us money to run for a creator: email to their list, their
 * own domain, several stores, affiliates and the API. It goes on sale with the
 * first of those, and not a day before — a plan that costs more and adds
 * nothing yet is not something we will take money for.
 */
export const PRO_ON_SALE = false;

/** What only Pro switches on. */
export type ProFeature = "email" | "affiliates" | "domain" | "stores" | "api";

/**
 * Whether a store may use a Pro feature right now: paid up, on Pro. Read from
 * the snapshot the studio refreshes, so a buyer's page never waits on Stripe.
 */
export function canUse(
  store: { subscriptionActive: boolean; tier: Tier },
  feature: ProFeature,
): boolean {
  void feature;
  return store.subscriptionActive && store.tier === "pro";
}

export function parseTier(raw: unknown): Tier | null {
  return raw === "creator" || raw === "pro" ? raw : null;
}

export function parseCycle(raw: unknown): Cycle | null {
  return raw === "month" || raw === "year" ? raw : null;
}

/**
 * Days of the subscription that are free.
 *
 * The card is taken when the trial starts and first charged when it ends, and
 * cancelling inside it — one click in the studio — means it is never charged.
 * Every public sentence about the trial has to say exactly that, no more.
 *
 * Long enough for a creator to put a product up and actually sell something
 * before deciding whether we are worth paying for. A trial that ends before
 * the first sale proves nothing to anybody.
 */
export const TRIAL_DAYS = 14;
