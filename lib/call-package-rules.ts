/**
 * A package of calls: several sessions of one call product, paid for at once
 * and booked one at a time, as rules the browser can read too. Sold, kept
 * and spent in lib/call-packages.ts.
 *
 * Measured before it was built (30 September 2026): Stan's coaching call is
 * one session per purchase (help.stan.store, article 15, "How to Create a
 * Coaching Call Product", read 30 September 2026), with no package of
 * sessions in their help center.
 *
 * Here the call product offers a package beside its single price: the buyer
 * pays once and books each session on the call's own page whenever they
 * like, from the same open times, with the same reminders, meeting links and
 * moves as a single call. Nothing more is charged per session. A package can
 * have to be used within a number of days, said before buying.
 */

export type CallPackage = {
  /** Sessions in it: 2 to 20. */
  sessions: number;
  /** For all of them, in the store's currency's smallest unit. */
  priceCents: number;
  /** Days from buying to use them in; 0 is no limit. */
  days: number;
};

export const MIN_PACKAGE_SESSIONS = 2;
export const MAX_PACKAGE_SESSIONS = 20;
export const PACKAGE_DAYS = [0, 30, 60, 90, 180, 365] as const;

export function parseCallPackage(raw: unknown): CallPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const sessions = Number(v.sessions);
  const priceCents = Number(v.priceCents);
  const days = Number(v.days);
  if (!Number.isInteger(sessions) || sessions < MIN_PACKAGE_SESSIONS || sessions > MAX_PACKAGE_SESSIONS) return null;
  if (!Number.isInteger(priceCents) || priceCents <= 0) return null;
  return { sessions, priceCents, days: (PACKAGE_DAYS as readonly number[]).includes(days) ? days : 0 };
}

/** What it saves against the sessions bought one by one, when it saves anything. */
export function packageSaving(pkg: CallPackage, singleCents: number): number {
  return Math.max(0, pkg.sessions * singleCents - pkg.priceCents);
}

/** "Use them within 90 days" or "No time limit". */
export function packageLimitWords(pkg: CallPackage): string {
  return pkg.days ? `Use them within ${pkg.days} days` : "No time limit to use them";
}
