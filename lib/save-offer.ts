/**
 * An offer made once to a member on their way out: stay, and pay less for a
 * while.
 *
 * Checked against the field on 30 September 2026 before building it: of Stan,
 * Skool, Circle, Whop, Kajabi and Gumroad, none ships a real save offer in the
 * cancel flow. Skool shows a video on its cancel page; Kajabi lets the creator
 * pause somebody by hand. For every one of them the cancel button is a dead end
 * the creator never gets a word in at.
 *
 * What it is here, precisely:
 *
 *   - A discount the creator chooses — a percentage off, for one to three
 *     months — made as a coupon on the creator's own Stripe account, because
 *     that is where the membership is charged.
 *   - Offered by Stripe's own cancellation page, which renders it, applies it
 *     if taken, and cancels as normal if not. It is Stripe's tested flow, not
 *     a page written here that could get the money wrong.
 *   - Offered ONCE per membership, ever. A member who is shown a discount
 *     every time they reach for the cancel button learns to reach for it every
 *     month, and the creator ends up paying people to stay who were never
 *     leaving.
 *   - Never a wall. Declining is one press on Stripe's page, and the portal's
 *     own cancel stays exactly where it was. Somebody who wants to leave
 *     leaves.
 *
 * The coupon is made when the creator saves the setting, not when a member is
 * leaving: a member mid-cancel should never wait on a coupon being created, or
 * meet an error because it could not be. A Stripe coupon cannot be changed once
 * made, so a new setting makes a new coupon and the old one is left to lapse.
 *
 * Pure, so the studio's own form can read the choices and the words without
 * pulling in anything that talks to Stripe. Making the coupon is in
 * lib/save-offer-coupon.ts, which only the server imports.
 */
import type { Store } from "@/lib/store";

export type SaveOffer = {
  /** Percent off each payment while it lasts. 0 is off. */
  percent: number;
  /** How many monthly payments it lasts for. */
  months: number;
  /** The coupon on the creator's own account, made when this was saved. */
  coupon: string;
};

/** The percentages a creator may choose from. Round numbers read as an offer; 37% reads as a formula. */
export const SAVE_PERCENTS = [10, 20, 25, 30, 40, 50] as const;
/** How long it may last. Longer than a quarter and it is a new price, not an offer. */
export const SAVE_MONTHS = [1, 2, 3] as const;

export const NO_SAVE: SaveOffer = { percent: 0, months: 1, coupon: "" };

const COUPON_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;

/** Whatever came back from storage, made safe to use. Anything off-list reads as off. */
export function parseSaveOffer(raw: unknown): SaveOffer {
  if (!raw || typeof raw !== "object") return { ...NO_SAVE };
  const value = raw as Record<string, unknown>;
  const percent = (SAVE_PERCENTS as readonly number[]).includes(value.percent as number) ? (value.percent as number) : 0;
  const months = (SAVE_MONTHS as readonly number[]).includes(value.months as number) ? (value.months as number) : 1;
  const coupon = typeof value.coupon === "string" && COUPON_PATTERN.test(value.coupon) ? value.coupon : "";
  // On only with a coupon to offer: a setting that lost its coupon is off,
  // rather than a Cancel button that fails for the member pressing it.
  if (!percent || !coupon) return { ...NO_SAVE };
  return { percent, months, coupon };
}

/** Whether a store has an offer to make. */
export function saveOn(store: Pick<Store, "save">): boolean {
  return store.save.percent > 0 && store.save.coupon !== "";
}

/** "25% off the next 2 payments", as the creator reads it in the studio. */
export function saveWords(offer: Pick<SaveOffer, "percent" | "months">): string {
  return offer.months === 1
    ? `${offer.percent}% off the next payment`
    : `${offer.percent}% off the next ${offer.months} payments`;
}

/**
 * Whether this offer can be made to this membership and honoured exactly.
 *
 * A Stripe coupon that repeats does so for a number of MONTHS, whatever the
 * membership's interval. On a monthly membership that is the same number of
 * payments, which is what the offer promises. On a yearly one the next payment
 * can be ten months off, so a two-month coupon would lapse before it touched
 * anything: the member would accept "25% off" and never be given it. On a
 * weekly one it would cover eight or nine payments where two were promised.
 *
 * So an offer of one payment — a coupon applied once, to the next invoice
 * whenever it comes — is made on every membership. An offer of several is
 * made only on memberships charged once a month, where months and payments are
 * the same thing. Anywhere else the member simply cancels as they would have,
 * which is a smaller offer made nowhere rather than a promise broken.
 */
export function canOffer(offer: Pick<SaveOffer, "months">, interval: string, intervalCount: number): boolean {
  if (offer.months === 1) return true;
  return interval === "month" && intervalCount === 1;
}
