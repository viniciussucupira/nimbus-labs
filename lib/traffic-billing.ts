/**
 * Visits past what a plan covers, put on the creator's next invoice.
 *
 * lib/traffic-rules.ts says what is covered and what a thousand visits past
 * it cost; lib/traffic.ts keeps each store's count. How a month is settled,
 * and why never twice, is in lib/usage-billing.ts, shared with lesson video
 * (lib/watch-billing.ts). What is here is the visits' own part: a larger
 * plan covers more of them, so what a store owes is worked out from its own
 * plan.
 *
 *   nl:visits:billed:<folder>:<month>   cents of that month already on an invoice
 *   nl:visits:adding:<folder>:<month>   a line being added, until it is known to be there
 *   nl:visits:told:<folder>:<month>     the creator was written to about that month
 */
import { type Meter, type Settled, firstWordOf, settleAllUsage, settleUsage } from "@/lib/usage-billing";
import { visitedFolders, visitsIn } from "@/lib/traffic";
import { SETUP_VISITS, VISITS_INCLUDED, countWords, visitsIncluded, visitsOwedCents, visitsWords } from "@/lib/traffic-rules";
import { monthWords } from "@/lib/watch-rules";

const VISITS: Meter = {
  name: "visits",
  measured: visitsIn,
  // A store nobody is known to own owes nothing: there is no plan to work it out from.
  owed: (visits, store) => (store ? visitsOwedCents(visits, store.tier) : 0),
  byPlan: true,
  // Under the fewest visits any store has, nothing is owed and nothing rests.
  covered: Math.min(SETUP_VISITS, ...Object.values(VISITS_INCLUDED)),
  describe: (month, visits, store) =>
    `Visits to your store past your plan's ${countWords(visitsIncluded(store?.tier ?? "creator"))} in ${monthWords(month)} (${visitsWords(visits)} so far)`,
  folders: visitedFolders,
};

export type { Settled };

/** Settles one store's month of visits. `final` when the month is over: whatever is left is billed, however small. */
export function settleVisits(folder: string, month: string, final: boolean, now = Date.now()): Promise<Settled> {
  return settleUsage(VISITS, folder, month, final, now);
}

/** The daily run: this month for every store that was visited, and the month before while it is still being closed. */
export function settleAllVisits(now = Date.now()): Promise<Settled[]> {
  return settleAllUsage(VISITS, now);
}

/** Whether the creator still has to be written to about this month's visits: true the first time it is asked, and never again. */
export function firstWordOnVisits(folder: string, month: string): Promise<boolean> {
  return firstWordOf(VISITS, folder, month);
}
