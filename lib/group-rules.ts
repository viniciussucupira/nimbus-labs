/**
 * Buying one product for several people at once, as rules the browser can
 * read too. The part that keeps the places and hands them out is
 * lib/group-buy.ts.
 *
 * Measured before it was built (7 October 2026): Kajabi's checkout can charge
 * for several at once, and its own help says "Only the buyer of the offer
 * will be granted access to the product" — the company then sends the creator
 * a list of addresses, and the creator grants each one by hand. LearnWorlds
 * hands seats to a manager after the school has set up a program for that
 * customer. Here the buyer types a number, pays once, and gets one link; the
 * creator does nothing at all.
 *
 * What it is:
 *
 *   - One payment on Stripe's page, the product's price times the number of
 *     people. The price per person is the product's own, read on the server
 *     like every price here; a sale or a discount code comes off the same way.
 *   - The buyer gets one link, on the page after paying and in their receipt.
 *     Whoever opens it types their own email address and is sent a link; the
 *     place is taken when that link is opened, so a mistyped address takes
 *     nothing. From then on the product is theirs on that address — its
 *     download, its course, the community it opens — exactly as a gift is
 *     (lib/gift-rules.ts). The buyer takes a place the same way.
 *   - As many places as were paid for, and never one more. A full refund
 *     takes every place back.
 *
 * What can be bought this way: what can be given as a gift, and not a product
 * with limited stock (one checkout holds one unit) or a private podcast. On a
 * product with price options the buyer picks one, and everybody gets that one
 * (lib/gift-rules.ts givableOptions).
 */
import type { Listing } from "@/lib/catalog";
import { canGift } from "@/lib/gift-rules";

export const GROUP_ID = /^grp_[0-9a-f]{24}$/;
/** The link in a place's email. */
export const PLACE_TOKEN = /^[0-9a-f]{64}$/;
/** Fewer than two is an ordinary purchase. */
export const MIN_PEOPLE = 2;
/** The most people one purchase is for. A larger team buys twice. */
export const MAX_PEOPLE = 200;
/** The number the box opens on. */
export const DEFAULT_PEOPLE = 5;
/** The most Stripe takes in one payment, in the smallest unit, with room to spare. */
const MAX_TOTAL_CENTS = 90_000_000;
/** How long a purchase for several waits for its checkout to be paid. */
export const GROUP_PENDING_SECONDS = 2 * 86_400;
/** How long a paid one is kept: for its link, the receipt and a refund. */
export const GROUP_KEPT_SECONDS = 400 * 86_400;
/** How long the link in a place's email works. */
export const PLACE_LINK_SECONDS = 86_400;

/** Whether this product can be bought for several people at once. */
export function canGroup(product: Listing): boolean {
  if (!canGift(product)) return false;
  if (product.stock !== null && product.stock !== undefined) return false;
  if (product.podcast) return false;
  return true;
}

/**
 * How many people, as typed into the box: a whole number from MIN_PEOPLE to
 * MAX_PEOPLE, or null for anything else. Never rounded or clamped: a buyer
 * who typed 2000 is told, not charged for 200.
 */
export function readPeople(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^[0-9]{1,4}$/.test(text)) return null;
  const people = Number(text);
  return people >= MIN_PEOPLE && people <= MAX_PEOPLE ? people : null;
}

/** Whether this many people at this price is a payment Stripe can take at all. */
export function payable(priceCents: number, people: number): boolean {
  return priceCents > 0 && priceCents * people <= MAX_TOTAL_CENTS;
}

/** "5 people", for a receipt, a sale's name and the page after paying. */
export function peopleWords(people: number): string {
  return `${people} ${people === 1 ? "person" : "people"}`;
}

/** "3 of 5 places are still open", for the page the link opens. */
export function placesWords(people: number, taken: number): string {
  const left = Math.max(0, people - taken);
  if (left === 0) return `All ${people} places have been taken.`;
  return `${left} of ${people} places ${left === 1 ? "is" : "are"} still open.`;
}
