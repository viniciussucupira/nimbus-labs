/**
 * Where a store stands with its plan, and what follows from that.
 *
 * Opening a store is free: the address, the page, the editor. What the
 * subscription buys is the till (lib/store-checkout.ts). But two things a
 * store does cost us by the gigabyte and by the hour whether or not it ever
 * pays: keeping its files and lesson videos, and sending those videos to
 * whoever watches. For a store on a paid plan both are set against what the
 * plan brings in (tests/plan-margin.test.ts). A store that pays nothing had
 * the same room, two hundred gigabytes kept and four hundred hours watched a
 * month, which made a free store address a free video host for anybody who
 * typed an email address.
 *
 * So what a store may keep and play goes by where it stands:
 *
 *   paid    a plan in good standing, past its trial. Keeps up to the brake
 *           every plan has (lib/storage-quota.ts); video is covered for the
 *           plan's hours and charged past them, never paused
 *           (lib/watch-rules.ts).
 *   trial   the free days of a plan, a card on file. Keeps up to
 *           TRIAL_STORAGE_BYTES; video plays for the plan's hours and is
 *           paused past them, because nothing can be charged yet.
 *   none    never started a plan: a store being set up.
 *   ended   had a plan, and it is over.
 *           Either keeps up to SETUP_STORAGE_BYTES, and its video plays for
 *           SETUP_VIDEO_HOURS a month: room to build a store and to look at
 *           one's own lessons, and no more. A store that already holds more
 *           than that when its plan ends loses nothing; it cannot add to it.
 *
 * Nothing a buyer paid for is taken away by any of these. A download is
 * never refused (lib/delivery.ts), and what stops is an upload, or a video
 * past the hours, with the reason said to whoever meets it.
 *
 * No secrets and nothing server-only: the studio's pages and the Terms read
 * the same figures the doors enforce.
 */
import { VIDEO_SECONDS_INCLUDED } from "@/lib/watch-rules";

const GB = 1024 * 1024 * 1024;

export type Standing = "paid" | "trial" | "none" | "ended";

/** What a store's record says about its plan (lib/store.ts). `trialEnds` in seconds; `planEndedAt` a date, or empty. */
export type PlanFields = {
  subscriptionActive: boolean;
  subscriptionId: string | null;
  trialEnds: number;
  planEndedAt: string;
};

/** Where a store stands with its plan right now. */
export function standingOf(store: PlanFields, nowSeconds = Date.now() / 1000): Standing {
  if (store.subscriptionActive) return store.trialEnds > nowSeconds ? "trial" : "paid";
  // A plan that was started and is not running has ended, whether or not
  // the day it ended was written down.
  return store.planEndedAt || store.subscriptionId ? "ended" : "none";
}

/**
 * What a store in its free trial may keep. A course of fifty hours of video
 * fits in it; it becomes the brake every plan has with the first payment.
 */
export const TRIAL_STORAGE_BYTES = 50 * GB;
/**
 * What a store with no plan may keep: at the dearest rate a file is kept at
 * that is twelve cents a month, which is what a free store address may cost.
 * A real store holds two to five gigabytes (lib/storage-quota.ts).
 */
export const SETUP_STORAGE_BYTES = 5 * GB;
/** The hours of lesson video a store with no plan may have watched in a month: its owner looking at their own lessons, and a preview. */
export const SETUP_VIDEO_HOURS = 10;
export const SETUP_VIDEO_SECONDS = SETUP_VIDEO_HOURS * 3600;

/**
 * The seconds of lesson video a store may have watched this month before
 * its video is paused; null for a store that pays, which is never paused.
 */
export function videoLimitFor(store: PlanFields, nowSeconds = Date.now() / 1000): number | null {
  const standing = standingOf(store, nowSeconds);
  if (standing === "paid") return null;
  return standing === "trial" ? VIDEO_SECONDS_INCLUDED : SETUP_VIDEO_SECONDS;
}

/** The word an upload is refused with when it would not fit, by standing (lib/studio-messages.ts has the sentences). */
export function storageRefusal(standing: Standing): "storage_full" | "storage_trial" | "storage_setup" {
  return standing === "paid" ? "storage_full" : standing === "trial" ? "storage_trial" : "storage_setup";
}
