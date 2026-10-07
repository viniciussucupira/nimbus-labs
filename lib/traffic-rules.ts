/**
 * Visits to a store, and what a plan covers of them: the rules.
 *
 * Every time somebody opens a store, the host that serves this site charges
 * for it: for each file the page is made of, for the page being put together
 * on a server, and for each thing read from and written to the database
 * while it is. A visit costs a few hundredths of a cent, and that is why it
 * went unnoticed: every other cost here had a brake, the sum of the brakes
 * was checked against what each plan brings in (tests/plan-margin.test.ts),
 * and visits were in neither. A hundred thousand of them in a month cost
 * more than a $29 plan has left after everything else, and a store with no
 * plan at all could be sent any number of them for nothing.
 *
 * Why these figures. A visitor who opens a store, lets every picture on its
 * page load and looks at two more pages costs a little over two hundredths
 * of a cent (tests/traffic-cost.ts has the sum, from what was measured on
 * the live site on October 7, 2026, at the host's and the database's
 * published rates). What each plan covers is what fits inside the plan with
 * every other brake at its limit and the plan's margin whole, paid by the
 * month or by the year; fifty cents a thousand is a little over twice what
 * a thousand cost.
 *
 * So visits are covered and priced the way lesson video is
 * (lib/watch-rules.ts), by the one measure of them a third party cannot run
 * up cheaply:
 *
 *   - A visit is one person opening a store on one day, however many of its
 *     pages they look at. People are told apart by the address they come
 *     from, and by nothing kept in their browser (lib/traffic.ts). The
 *     store's owner is never counted, nor is a robot that says it is one.
 *   - Every plan covers a number of visits in a calendar month
 *     (VISITS_INCLUDED), more on a larger plan.
 *   - A thousand visits past that is VISIT_CENTS_PER_THOUSAND_OVER cents, to
 *     the visit, added to the creator's next invoice by the daily job
 *     (lib/usage-billing.ts). A store that pays is never taken down for it
 *     and nothing is asked of its creator.
 *   - A store with no plan that can be charged has nothing to add a visit
 *     to. Its pages are shown for the visits it has (TRIAL_VISITS in the
 *     free trial, SETUP_VISITS before a plan and after one) and rest there until
 *     the plan is paid or the month turns. What a buyer already has is never
 *     part of that: orders, downloads, lessons and memberships stay open.
 *
 * Why a visit and not a page view. A page view is what costs, but a count
 * of page views can be run up from one computer, and a creator must never
 * be billed for somebody else's script. One address counts once a day for
 * a store whatever it does, so the figure a creator pays for is the number
 * of people who came, and what it costs us is worked out for a visitor who
 * looks at more pages and more pictures than visitors do
 * (tests/plan-margin.test.ts has the sum).
 *
 * Nothing here touches the network or a secret: the pages that publish
 * these figures read the same ones the bill is made from.
 */
import type { Tier } from "@/lib/plan";
import { type PlanFields, standingOf } from "@/lib/plan-standing";

/** Visits every plan covers, per store, per calendar month. */
export const VISITS_INCLUDED: Record<Tier, number> = {
  creator: 3_000,
  pro: 10_000,
  scale: 50_000,
};

/** What a thousand visits past that cost the creator, in cents. */
export const VISIT_CENTS_PER_THOUSAND_OVER = 50;

/** Visits a store with no plan has in a month, before one is started and after one has ended. */
export const SETUP_VISITS = 500;

/**
 * Visits a store has in a month of its free trial, whichever plan the trial
 * is of: what the smallest plan covers. A trial has paid nothing yet, and a
 * larger figure would be handed out for a card number alone.
 */
export const TRIAL_VISITS = VISITS_INCLUDED.creator;

/** The visits a store's plan covers in a month. */
export function visitsIncluded(tier: Tier): number {
  return VISITS_INCLUDED[tier] ?? VISITS_INCLUDED.creator;
}

/**
 * What a month's visits cost past the plan's, in whole cents.
 *
 * To the visit, and rounded down: a part of a cent is never charged.
 */
export function visitsOwedCents(visits: number, tier: Tier): number {
  const included = visitsIncluded(tier);
  if (!Number.isFinite(visits) || visits <= included) return 0;
  return Math.floor(((visits - included) * VISIT_CENTS_PER_THOUSAND_OVER) / 1000);
}

/**
 * How many visits a store's pages are shown for in a month; null for a
 * store that pays, which is never rested: its visits past the plan are
 * charged instead.
 */
export function visitLimitFor(store: PlanFields, nowSeconds = Date.now() / 1000): number | null {
  const standing = standingOf(store, nowSeconds);
  if (standing === "paid") return null;
  return standing === "trial" ? TRIAL_VISITS : SETUP_VISITS;
}

/** "4,812 visits", "1 visit": a count, for a page or an email. */
export function visitsWords(visits: number): string {
  const counted = Number.isFinite(visits) && visits > 0 ? Math.floor(visits) : 0;
  return `${counted.toLocaleString("en-US")} ${counted === 1 ? "visit" : "visits"}`;
}

/** "5,000", "30,000": a figure with its thousands marked. */
export function countWords(count: number): string {
  return Math.max(0, Math.floor(count)).toLocaleString("en-US");
}

/**
 * The address a visitor is told apart by, for one day: as it is for the old
 * kind, and the network it belongs to for the new kind, where one
 * subscriber is handed more addresses than there are grains of sand and
 * could otherwise be counted as that many people.
 */
export function visitorAddress(ip: string): string {
  const address = ip.trim().toLowerCase();
  if (!address.includes(":")) return address || "unknown";
  // An old address written the new way ("::ffff:203.0.113.9") is the old address.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mapped) return mapped[1];
  // The first four groups of the eight: the network, whatever follows it.
  const [head, tail = ""] = address.split("::");
  const front = head ? head.split(":") : [];
  const back = tail ? tail.split(":") : [];
  const missing = Math.max(0, 8 - front.length - back.length);
  const groups = address.includes("::") ? [...front, ...Array<string>(missing).fill("0"), ...back] : front;
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return address;
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
