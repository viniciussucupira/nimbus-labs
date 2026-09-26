/**
 * Only ways to pay that settle while the buyer is on the page.
 *
 * Every product here is handed over the moment Stripe says it is paid: the
 * file on the thanks page, the course, the booked call. A bank debit, a cash
 * voucher or a crypto transfer says "complete" at checkout and "paid" days
 * later, so a buyer would pay and meet a page saying nothing was paid. Those
 * methods are left out of the checkout rather than apologised for after it.
 *
 * Everything else the creator's Stripe account offers stays: cards, Apple Pay
 * and Google Pay, Link, and the wallets that confirm at once.
 */
export const DELAYED_METHODS = [
  "us_bank_account",
  "sepa_debit",
  "bacs_debit",
  "au_becs_debit",
  "acss_debit",
  "boleto",
  "oxxo",
  "konbini",
  "customer_balance",
  "multibanco",
  "crypto",
] as const;

/** Adds the exclusion to a Checkout Session being made. */
export function onlyInstantMethods(body: URLSearchParams): void {
  DELAYED_METHODS.forEach((type, i) => body.set(`excluded_payment_method_types[${i}]`, type));
}

/**
 * Charges the amount the page showed, in the currency it was written in.
 *
 * Stripe can convert a price into the currency of whoever is looking at it.
 * It reads well until you follow the money: the buyer of a $39 plan meets a
 * total in their own currency, carrying a conversion fee of two to four per
 * cent that Stripe adds to the exchange rate, and the creator never chose
 * either number. Our own page promises that what is charged is what was
 * saved, so the conversion is turned off and the price stands as written.
 */
export function inTheCurrencyShown(body: URLSearchParams): void {
  body.set("adaptive_pricing[enabled]", "false");
}

/**
 * Whether a finished checkout is settled: paid, or brought to nothing by a
 * discount code.
 *
 * A code for 100%, or for more than the price, closes the checkout with
 * nothing to pay, and Stripe then says "no_payment_required" rather than
 * "paid". The buyer still bought the thing and is owed it, so every door that
 * asks "was this paid for?" asks it here, and none of them can forget the
 * second answer.
 */
export function isSettled(session: { status?: unknown; payment_status?: unknown }): boolean {
  return (
    session.status === "complete" &&
    (session.payment_status === "paid" || session.payment_status === "no_payment_required")
  );
}
