/**
 * The headline test's rules, which the browser can read too: groups, which
 * version a group sees, and when a version has won. The counting is in
 * lib/headline-test.ts, which only the server loads.
 */
/** Each version must have been seen this many times before a winner is called. */
export const MIN_VIEWS = 200;
/** The z-score of a difference significant at 95%, two-sided. */
const Z_95 = 1.96;
/** The cookie that holds a visitor's group number, 0 to 999. */
export const AB_COOKIE = "nl_ab";
export const AB_COOKIE_SECONDS = 90 * 24 * 60 * 60;

export type Version = "a" | "b";
export type Counts = { va: number; vb: number; ca: number; cb: number };


/** A group number as it arrives in the cookie, or null when there is none or it is not one. */
export function readBucket(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,3}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Which version this group sees in this test. Mixed with the test's id, so
 * the same visitor is not always in the same half of every test.
 */
export function versionFor(bucket: number, testId: string): Version {
  let h = bucket * 2654435761;
  for (let i = 0; i < testId.length; i += 1) h = Math.imul(h ^ testId.charCodeAt(i), 2246822519) >>> 0;
  return (h >>> 0) % 2 === 0 ? "a" : "b";
}

/** The version that has won, or null while the test is still running or nothing is clear. */
export function winner(counts: Counts): Version | null {
  if (counts.va < MIN_VIEWS || counts.vb < MIN_VIEWS) return null;
  const pa = counts.ca / counts.va;
  const pb = counts.cb / counts.vb;
  const pooled = (counts.ca + counts.cb) / (counts.va + counts.vb);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / counts.va + 1 / counts.vb));
  if (se === 0) return null;
  const z = (pb - pa) / se;
  if (Math.abs(z) < Z_95) return null;
  return z > 0 ? "b" : "a";
}

/** Checkouts per hundred views, to one decimal, for the studio. */
export function rate(checkouts: number, views: number): number {
  return views > 0 ? Math.round((checkouts / views) * 1000) / 10 : 0;
}

