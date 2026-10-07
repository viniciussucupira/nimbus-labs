/**
 * What a visit to a store costs us, worked out once for the two test files
 * that need it: tests/traffic.test.ts, which holds the counts below to what
 * the code really does, and tests/plan-margin.test.ts, which sets the sum
 * against what each plan brings in.
 *
 * The rates are the published ones, read on October 7, 2026, and they move
 * only when the vendors' do:
 *
 *   Vercel, CDN requests       $2.00 / million   (Flat Rate CDN, which this
 *                                                 account is on: each tier
 *                                                 is this much a million,
 *                                                 and the bytes sent are in
 *                                                 the tier, so a picture
 *                                                 costs a request and no
 *                                                 more whatever it weighs)
 *   Vercel, function calls     $0.60 / million
 *   Vercel, function CPU       $0.128 / hour
 *   Vercel, function memory    $0.0106 / GB-hour (2 GB for as long as a
 *                                                 request is being answered)
 *   Upstash, commands          $2.00 / million   (pay as you go, $0.20 a
 *                                                 hundred thousand)
 *
 * And what was measured on the live site that day. A store's front page,
 * opened for the first time: the page, 13 files of script and type that a
 * browser then keeps for a year, the count, the owner's photo and one
 * picture for each product drawn. The page took up to a second to answer
 * from the other side of the world.
 *
 * The visitor this is worked out for is heavier than visitors are: every one
 * of the 24 pictures a full page can hold is loaded, and two more pages are
 * opened after the first, each with pictures of its own. A visit is counted
 * once however many pages are opened (lib/traffic-rules.ts), so the pages
 * have to be in the cost of the one.
 *
 * What these figures count on, and what nothing here can check: that Flat
 * Rate CDN stays switched on in the host's billing settings. Without it the
 * bytes of every picture are charged by the gigabyte, and a visit can cost
 * thirty times this.
 */
import { STORE_PAGE_SIZE } from "@/lib/catalog";

export const CDN_PER_REQUEST = 2.0 / 1_000_000;
export const COMMAND = 2.0 / 1_000_000;
const CALL = 0.6 / 1_000_000;
const CPU_PER_SECOND = 0.128 / 3600;
const MEMORY_PER_SECOND = (0.0106 * 2) / 3600;

/** Files of script and type a first visit fetches, as counted on the live page. */
export const STATIC_FILES = 13;
/** Pages a visit is costed at: the front page and two more. */
export const PAGES_PER_VISIT = 3;
/** Pictures on a page after the first. */
const PICTURES_ON_A_LATER_PAGE = 4;

/**
 * Commands a page may send to the database, at the most: what the model
 * allows for, which tests/traffic.test.ts holds the code under.
 */
export const COMMANDS = {
  /** Drawing the front page of a store that pays. */
  frontPage: 4,
  /** Counting it: the store's stats and the visit. */
  frontCount: 14,
  /** What a visitor new to the day adds, once. */
  firstOfDay: 7,
  /** Drawing another page of the store, and saying it was opened. */
  laterPage: 10,
  laterCount: 6,
};

/** Answering one page and its count: two calls, a tenth of a second of work, and memory held while the database is waited on. */
const PAGE_AND_COUNT = 2 * CALL + 0.1 * CPU_PER_SECOND + 1.3 * MEMORY_PER_SECOND;

/** What one visit costs at the most this is worked out for, in dollars. */
export function visitCost(): number {
  const later = PAGES_PER_VISIT - 1;
  const requests = 1 + STATIC_FILES + 1 + 1 + STORE_PAGE_SIZE + later * (1 + 1 + PICTURES_ON_A_LATER_PAGE);
  const commands = COMMANDS.frontPage + COMMANDS.frontCount + COMMANDS.firstOfDay + later * (COMMANDS.laterPage + COMMANDS.laterCount);
  return requests * CDN_PER_REQUEST + commands * COMMAND + PAGES_PER_VISIT * PAGE_AND_COUNT;
}
