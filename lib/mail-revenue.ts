/**
 * What each email sold, read from the creator's own Stripe account.
 *
 * Links to the store in an email arrive tagged with the email they came from
 * (lib/mail-links.ts); the checkout writes the tag on the sale
 * (lib/came-from.ts); this adds the sales up by tag. Nothing here is kept
 * about anybody: the figures are a count and a sum, cached for ten minutes
 * so that opening the email page does not ask Stripe every time.
 *
 *   nl:stats:<statsId>:mailsales   the last reading (JSON), for ten minutes
 *
 * What a figure means, exactly: checkouts paid on the page one of that
 * email's links opened, in the store's own currency, over the last
 * STATS_DAYS days. A one-click extra taken after such a checkout is not
 * added, and neither is somebody who came back later by themselves.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { STATS_DAYS, readPaidSales } from "@/lib/stats";
import { MAIL_SOURCE, broadcastCampaign, flowCampaignPrefix } from "@/lib/mail-links";
import type { Store } from "@/lib/store";

export type MailMoney = { sales: number; cents: number };
export type MailRevenue = { by: Record<string, MailMoney>; partial: boolean };

const cacheKey = (statsId: string) => `nl:stats:${statsId}:mailsales`;
const CACHE_SECONDS = 600;
/** Pages of a hundred sales read from Stripe for one reading, the same as the studio's own numbers. */
const PAGES = 10;

/** Sales that arrived from an email, added up by which email. Other currencies are left out, never converted. */
export function moneyByCampaign(
  sales: { source: string; campaign: string; cents: number; currency: string }[],
  currency: string,
): Record<string, MailMoney> {
  const by: Record<string, MailMoney> = {};
  for (const sale of sales) {
    if (sale.source !== MAIL_SOURCE || !sale.campaign || sale.currency !== currency) continue;
    const row = (by[sale.campaign] ??= { sales: 0, cents: 0 });
    row.sales += 1;
    row.cents += sale.cents;
  }
  return by;
}

/** What one one-off email sold; null when nothing is counted for it. */
export function broadcastMoney(revenue: MailRevenue | null, broadcastId: string): MailMoney | null {
  return revenue?.by[broadcastCampaign(broadcastId)] ?? null;
}

/** What every email of one sequence sold together. */
export function flowMoney(revenue: MailRevenue | null, flowId: string): MailMoney | null {
  if (!revenue) return null;
  const start = flowCampaignPrefix(flowId);
  const total = { sales: 0, cents: 0 };
  for (const [campaign, money] of Object.entries(revenue.by)) {
    if (!campaign.startsWith(start)) continue;
    total.sales += money.sales;
    total.cents += money.cents;
  }
  return total.sales ? total : null;
}

/** The store's email sales, from the cache when it is fresh. Never throws: a page is not lost over a number. */
export async function readMailRevenue(store: Store): Promise<MailRevenue | null> {
  if (!store.stripeAccountId || !store.statsId) return null;
  try {
    if (isRedisConfigured()) {
      const [cached] = await redisPipeline([["GET", cacheKey(store.statsId)]]);
      if (typeof cached === "string") return JSON.parse(cached) as MailRevenue;
    }
    const since = Math.floor(Date.now() / 1000) - STATS_DAYS * 86400;
    const { sales, partial } = await readPaidSales(store, since, PAGES);
    const out: MailRevenue = { by: moneyByCampaign(sales, store.currency), partial };
    if (isRedisConfigured()) {
      await redisPipeline([["SET", cacheKey(store.statsId), JSON.stringify(out), "EX", CACHE_SECONDS]]).catch(() => {});
    }
    return out;
  } catch (error) {
    console.error("reading what the emails sold failed", error);
    return null;
  }
}
