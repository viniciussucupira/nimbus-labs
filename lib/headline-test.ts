/**
 * A/B test of a sales page's headline: the creator writes a second headline
 * and line under it, half the visitors see each, and the page itself starts
 * showing the one that brings more people to the checkout once the
 * difference is real.
 *
 * Measured before it was built (7 October 2026): Kajabi, Stan, Hotmart,
 * Gumroad and Whop offer no A/B test of a product page; creators who want one
 * pay for a separate page builder (Replo, Unbounce) and send buyers across to
 * the checkout. Here it is on the page they already have.
 *
 * What keeps it honest and cheap:
 *
 *   - Only the words of the hero change. Never the price, the options or
 *     anything about what is sold: two visitors may read different headlines,
 *     never be charged different amounts.
 *   - A visitor is put in a group by one random number kept in a cookie for
 *     the store's pages (proxy.ts, nl_ab), and keeps seeing the same version.
 *     Where the law asks for consent before such a cookie (the places the ad
 *     pixels ask first, lib/pixels.ts), none is set: those visitors see the
 *     first version and are not counted.
 *   - A view is counted when the page is drawn for a visitor with a group,
 *     and a checkout when one is opened from it. One small hash per test.
 *   - The winner is decided by arithmetic, not by a hunch: both versions seen
 *     at least MIN_VIEWS times, and the difference in checkouts per view
 *     significant at 95% (a two-proportion z-test). Until then both run; after
 *     it, everybody sees the winner until the creator keeps it or ends the
 *     test. Nothing is written to decide it: it is worked out on each read.
 *
 *   nl:ab:<statsId>:<productId>:<testId>   hash: va vb ca cb
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import type { Counts, Version } from "@/lib/headline-test-rules";

export * from "@/lib/headline-test-rules";

const key = (statsId: string, productId: string, testId: string) => `nl:ab:${statsId}:${productId}:${testId}`;

export async function readCounts(statsId: string | null, productId: string, testId: string): Promise<Counts> {
  const zero = { va: 0, vb: 0, ca: 0, cb: 0 };
  if (!statsId || !isRedisConfigured()) return zero;
  const [raw] = await redisPipeline([["HGETALL", key(statsId, productId, testId)]]);
  const pairs: Record<string, string> = {};
  if (Array.isArray(raw)) for (let i = 0; i + 1 < raw.length; i += 2) pairs[String(raw[i])] = String(raw[i + 1]);
  else if (raw && typeof raw === "object") Object.assign(pairs, raw);
  const n = (k: string) => (Number.isFinite(Number(pairs[k])) ? Number(pairs[k]) : 0);
  return { va: n("va"), vb: n("vb"), ca: n("ca"), cb: n("cb") };
}

/** Counts one view or one checkout of a version. Best effort: a test is never worth a failed page. */
export async function count(statsId: string | null, productId: string, testId: string, what: "v" | "c", version: Version): Promise<void> {
  if (!statsId || !isRedisConfigured()) return;
  const k = key(statsId, productId, testId);
  await redisPipeline([
    ["HINCRBY", k, `${what}${version}`, 1],
    ["EXPIRE", k, 400 * 86_400],
  ]).catch(() => {});
}
