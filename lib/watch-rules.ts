/**
 * Lesson video, and what a plan covers of it: the rules.
 *
 * A file that is sold costs nothing to send (lib/vault-rules.ts). A lesson's
 * video does: the video service charges for every gigabyte it sends
 * (lib/stream.ts), a course is watched by the hour, and a student who paid
 * the creator is never cut off. That left one cost here with no ceiling, and
 * a $29 store with a few thousand students watching could cost more than it
 * pays.
 *
 * So video is priced rather than limited, by the one measure of it that is
 * neither a guess of ours nor a thing a page view can inflate: the time
 * students spent watching, as the video service's own player counts it.
 *
 *   - Every plan covers VIDEO_HOURS_INCLUDED hours watched in a calendar
 *     month, across the whole store.
 *   - An hour past that is VIDEO_CENTS_PER_HOUR_OVER cents, to the second,
 *     added to the creator's next invoice by the daily job
 *     (lib/watch-billing.ts). Nobody is cut off and nothing is asked of the
 *     creator.
 *   - A store with no plan that can be charged, in its free trial or with
 *     its plan ended, has nothing to add an hour to. Its video plays up to
 *     what a plan covers and pauses there until the plan is paid or the
 *     month turns (lib/learn.ts).
 *
 * Why these figures. An hour watched at the largest size kept is at most
 * 2.5 gigabytes (lib/stream-rules.ts), and a player fetches a little ahead
 * of what is watched; with a quarter added for that, an hour costs us about
 * a cent and a half at the video service's rate. Four hundred hours is about
 * six dollars, which every plan carries with its margin whole
 * (tests/plan-margin.test.ts), and three cents is about twice what the hour costs.
 * The two services built for nothing but video charge five to six cents for
 * the same hour (their price pages, read October 6, 2026; lib/stream.ts).
 *
 * Nothing here touches the network or a secret: the pages that publish these
 * figures read the same ones the bill is made from.
 */

/** Hours of video watched that every plan covers, per store, per calendar month. */
export const VIDEO_HOURS_INCLUDED = 400;
/** What an hour watched past that costs the creator, in cents. */
export const VIDEO_CENTS_PER_HOUR_OVER = 3;

/** The same allowance in seconds, which is what is counted. */
export const VIDEO_SECONDS_INCLUDED = VIDEO_HOURS_INCLUDED * 3600;

/**
 * What a month's watching costs past the allowance, in whole cents.
 *
 * To the second, and rounded down: a part of a cent is never charged.
 */
export function videoOwedCents(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= VIDEO_SECONDS_INCLUDED) return 0;
  return Math.floor(((seconds - VIDEO_SECONDS_INCLUDED) * VIDEO_CENTS_PER_HOUR_OVER) / 3600);
}

/** "12 minutes", "3.5 hours", "412 hours": a length of watching, for a page or an email. */
export function hoursWords(seconds: number): string {
  const counted = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  if (counted < 3600) {
    const minutes = Math.floor(counted / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  const hours = counted / 3600;
  // One decimal while it says something; whole hours past ten.
  const shown = hours < 10 ? Math.floor(hours * 10) / 10 : Math.floor(hours);
  return `${shown.toLocaleString("en-US")} ${shown === 1 ? "hour" : "hours"}`;
}

/** "$0.03", from cents. */
export function centsWords(cents: number): string {
  return `$${(Math.max(0, Math.round(cents)) / 100).toFixed(2)}`;
}

/** "October 2026", from a month written "2026-10". */
export function monthWords(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** The month before one written "2026-10". */
export function monthBefore(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const year = Number(match[1]);
  const number = Number(match[2]);
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, "0")}`;
}

/**
 * Whether a store has a plan an hour of video can be added to: one that is
 * paid, and past its free trial. `trialEnds` is in seconds, 0 when not in one.
 */
export function canBeCharged(store: { subscriptionActive: boolean; subscriptionId: string | null; stripeCustomerId: string | null; trialEnds: number }, nowSeconds = Date.now() / 1000): boolean {
  return store.subscriptionActive && Boolean(store.subscriptionId) && Boolean(store.stripeCustomerId) && !(store.trialEnds > nowSeconds);
}

/** The smallest line worth adding to an invoice while the month is still running, in cents. */
export const SMALLEST_LINE_CENTS = 100;

/** How often a store whose video is being watched is measured, and how soon after a lesson is opened. */
export const MEASURE_EVERY_MS = 60 * 60 * 1000;
export const MEASURE_SOON_MS = 10 * 60 * 1000;
