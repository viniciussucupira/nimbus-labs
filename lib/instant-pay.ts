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
