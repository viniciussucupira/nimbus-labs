/**
 * What we charge, in one place.
 *
 * These two numbers are read by the checkout that actually bills a creator and
 * by the pages that tell the world the price. They live here, rather than in
 * lib/billing.ts, because that file talks to Stripe with a secret key and must
 * never be pulled into a browser bundle — and a marketing page that cannot
 * import the real number ends up retyping it, which is how a site starts
 * advertising a price the checkout does not open with.
 *
 * Nothing in this file may ever read an environment variable or a secret. That
 * is the whole reason it is safe for a client component to import it.
 */

/** The monthly subscription, in cents. */
export const PRICE_CENTS = 2900;

/**
 * Days of the subscription that are free, with no card asked for.
 *
 * Long enough for a creator to put a product up and actually sell something
 * before deciding whether we are worth paying for. A trial that ends before
 * the first sale proves nothing to anybody.
 */
export const TRIAL_DAYS = 14;
