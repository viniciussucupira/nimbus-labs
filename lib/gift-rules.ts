/**
 * Buying something for somebody else, as rules the browser can read too. The
 * part that keeps and delivers gifts is lib/gifts.ts.
 *
 * The buyer pays on Stripe's page as for anything else, and their receipt
 * says it was a gift and who it went to. The person they chose gets one
 * email: who it is from, their message, and a link to open it. From then on
 * it is theirs as if they had bought it — its download, its course, the
 * community it opens — on their own address, and the buyer does not get a
 * copy. A full refund takes it back.
 *
 * What can be given: a paid product bought once, that hands over a file, a
 * link, a course or a bundle. Not a membership or a payment plan (the
 * payments would be the buyer's for months), not a call (the time is the
 * buyer's to pick), not a product with price options, a price the buyer
 * chooses or license keys.
 */
import type { Listing } from "@/lib/catalog";

export const GIFT_ID = /^gft_[0-9a-f]{24}$/;
export const MAX_GIFT_MESSAGE = 500;
export const MAX_GIFT_FROM = 60;
/** How long a gift waits for its checkout to be paid. */
export const GIFT_PENDING_SECONDS = 2 * 86_400;
/** How long a paid gift is remembered: for the receipt, the list of purchases and a refund. */
export const GIFT_KEPT_SECONDS = 400 * 86_400;

/** Whether this product can be bought as a gift. */
export function canGift(product: Listing): boolean {
  if (product.priceCents <= 0) return false;
  if (product.recurring || product.call || product.pwyw || product.keys) return false;
  if (product.options.length > 0) return false;
  return Boolean(product.file || product.link || product.course || product.bundle);
}
