/**
 * How many people visit a store, where they come from, and how many of them
 * start to pay.
 *
 * Counted without a cookie and without keeping anybody's address. A visitor
 * is told apart from another for one day only, by a one-way fingerprint of
 * the day, the store, their network address and their browser, and even that
 * fingerprint is not kept: it goes into Redis's HyperLogLog, which keeps an
 * estimate of how many different ones it has seen and nothing from which any
 * one of them could be read back.
 *
 * Sales are not counted here. They are read from the creator's own Stripe
 * account, which is the only record of money that deserves the name.
 */
import { createHash } from "node:crypto";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount } from "@/lib/stripe-account";
import type { Store } from "@/lib/store";

/** Days kept, a little over a year, so a year-on-year look is possible. */
const TTL_SECONDS = 400 * 86400;

/** The longest window the studio shows. */
export const STATS_DAYS = 30;

const MAX_SOURCES = 40;

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const countsKey = (statsId: string, day: string) => `nl:stats:${statsId}:${day}`;
const visitorsKey = (statsId: string, day: string) => `nl:stats:${statsId}:${day}:u`;

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|okhttp|scrapy|httpclient/i;

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT.test(userAgent);
}

/** Referring sites grouped under the name a creator knows them by. */
const KNOWN: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, "pinterest"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)(linktr\.ee|linktree\.com)$/, "linktree"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com)$/, "email"],
];

/** The names of the in-app browsers that send no referrer at all. */
const IN_APP: [RegExp, string][] = [
  [/Instagram/i, "instagram"],
  [/FBAN|FBAV|FB_IAB/i, "facebook"],
  [/musical_ly|BytedanceWebview|TikTok/i, "tiktok"],
  [/Pinterest/i, "pinterest"],
  [/Snapchat/i, "snapchat"],
  [/LinkedInApp/i, "linkedin"],
  [/Twitter/i, "x"],
];

/**
 * Where a visit came from, in a word.
 *
 * A campaign tag the creator put on their own link wins, then the site that
 * sent the visitor, then the app whose built-in browser opened the page —
 * Instagram and TikTok send no referrer, and that is where most of a
 * creator's visitors are. What is left is "direct".
 */
export function classifySource(input: { referrer: string; utm: string; userAgent: string; ownHost: string }): string {
  const utm = input.utm.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
  if (utm) return utm;
  let host = "";
  try {
    host = input.referrer ? new URL(input.referrer).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  if (host && host !== input.ownHost) {
    for (const [pattern, name] of KNOWN) if (pattern.test(host)) return name;
    return host.replace(/^www\./, "").slice(0, 60);
  }
  for (const [pattern, name] of IN_APP) if (pattern.test(input.userAgent)) return name;
  return "direct";
}

export type HitKind = "view" | "checkout" | "link";

/**
 * Counts one thing a visitor did.
 *
 * A view is counted once per page load, from the page itself; a checkout is
 * counted by the server when a buyer presses the button that takes them to
 * pay, or to get something free; a link is counted when one is opened.
 */
export async function recordHit(
  store: Store,
  hit: { kind: HitKind; id?: string; source?: string; ip: string; userAgent: string },
  now = Date.now(),
): Promise<void> {
  if (!store.statsId || !isRedisConfigured() || isBot(hit.userAgent)) return;
  const day = dayKey(now);
  const counts = countsKey(store.statsId, day);
  const commands: (string | number)[][] = [];
  if (hit.kind === "view") {
    const visitor = createHash("sha256")
      .update(`${day}|${store.statsId}|${hit.ip}|${hit.userAgent}`)
      .digest("hex")
      .slice(0, 24);
    const visitors = visitorsKey(store.statsId, day);
    commands.push(["HINCRBY", counts, "v", 1]);
    commands.push(["HINCRBY", counts, `r:${hit.source || "direct"}`, 1]);
    commands.push(["PFADD", visitors, visitor]);
    commands.push(["EXPIRE", visitors, TTL_SECONDS]);
  } else if (hit.kind === "checkout" && hit.id) {
    commands.push(["HINCRBY", counts, "c", 1]);
    commands.push(["HINCRBY", counts, `c:${hit.id}`, 1]);
  } else if (hit.kind === "link" && hit.id) {
    commands.push(["HINCRBY", counts, `l:${hit.id}`, 1]);
  } else {
    return;
  }
  commands.push(["EXPIRE", counts, TTL_SECONDS]);
  await redisPipeline(commands);
}

export type DayStats = { date: string; views: number; visitors: number; checkouts: number };

export type Stats = {
  days: DayStats[];
  /** People, over the whole window — not the sum of the days. */
  visitors: number;
  visitors7: number;
  views: number;
  checkouts: number;
  sources: { name: string; visits: number }[];
  sources7: { name: string; visits: number }[];
  checkoutsByProduct: Record<string, { all: number; last7: number }>;
  linkClicks: Record<string, { all: number; last7: number }>;
};

/** The last thirty days of a store, oldest first. */
export async function readStats(store: Store, now = Date.now()): Promise<Stats | null> {
  if (!store.statsId || !isRedisConfigured()) return null;
  const statsId = store.statsId;
  const dates: string[] = [];
  for (let i = STATS_DAYS - 1; i >= 0; i -= 1) dates.push(dayKey(now - i * 86400_000));
  const last7 = new Set(dates.slice(-7));

  const commands: (string | number)[][] = [
    ...dates.map((d) => ["HGETALL", countsKey(statsId, d)]),
    ...dates.map((d) => ["PFCOUNT", visitorsKey(statsId, d)]),
    ["PFCOUNT", ...dates.map((d) => visitorsKey(statsId, d))],
    ["PFCOUNT", ...dates.slice(-7).map((d) => visitorsKey(statsId, d))],
  ];
  const results = await redisPipeline(commands);

  const days: DayStats[] = [];
  const sources = new Map<string, number>();
  const sources7 = new Map<string, number>();
  const checkoutsByProduct: Stats["checkoutsByProduct"] = {};
  const linkClicks: Stats["linkClicks"] = {};
  let views = 0;
  let checkouts = 0;

  dates.forEach((date, index) => {
    const flat = Array.isArray(results[index]) ? (results[index] as string[]) : [];
    const recent = last7.has(date);
    let dayViews = 0;
    let dayCheckouts = 0;
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const field = flat[i];
      const count = Number(flat[i + 1]) || 0;
      if (field === "v") dayViews = count;
      else if (field === "c") dayCheckouts = count;
      else if (field.startsWith("r:")) {
        const name = field.slice(2);
        sources.set(name, (sources.get(name) ?? 0) + count);
        if (recent) sources7.set(name, (sources7.get(name) ?? 0) + count);
      } else if (field.startsWith("c:")) {
        const id = field.slice(2);
        const entry = (checkoutsByProduct[id] ??= { all: 0, last7: 0 });
        entry.all += count;
        if (recent) entry.last7 += count;
      } else if (field.startsWith("l:")) {
        const id = field.slice(2);
        const entry = (linkClicks[id] ??= { all: 0, last7: 0 });
        entry.all += count;
        if (recent) entry.last7 += count;
      }
    }
    views += dayViews;
    checkouts += dayCheckouts;
    days.push({ date, views: dayViews, visitors: Number(results[dates.length + index]) || 0, checkouts: dayCheckouts });
  });

  const ranked = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SOURCES)
      .map(([name, visits]) => ({ name, visits }));

  return {
    days,
    visitors: Number(results[dates.length * 2]) || 0,
    visitors7: Number(results[dates.length * 2 + 1]) || 0,
    views,
    checkouts,
    sources: ranked(sources),
    sources7: ranked(sources7),
    checkoutsByProduct,
    linkClicks,
  };
}

export type SalesStats = {
  /** Paid checkouts per day, same days as the visits. */
  byDay: Record<string, { sales: number; cents: number }>;
  byProduct: Record<string, { sales: number; cents: number; sales7: number; cents7: number }>;
  sales: number;
  cents: number;
  sales7: number;
  cents7: number;
  /** True when there were more sales than one reading covers. */
  partial: boolean;
};

type Row = {
  status?: unknown;
  payment_status?: unknown;
  amount_total?: unknown;
  currency?: unknown;
  created?: unknown;
  metadata?: Record<string, string> | null;
};

/**
 * Sales in the same thirty days, read from the creator's own Stripe account:
 * every checkout on it that this store opened and that was paid. The amount
 * is what the buyer paid, after any discount code and before Stripe's fee or
 * any refund.
 */
export async function readSales(store: Store, now = Date.now()): Promise<SalesStats | null> {
  if (!store.stripeAccountId) return null;
  const handles = new Set([store.handle, ...store.previousHandles]);
  const since = Math.floor(now / 1000) - STATS_DAYS * 86400;
  const weekAgo = dayKey(now - 6 * 86400_000);
  const out: SalesStats = { byDay: {}, byProduct: {}, sales: 0, cents: 0, sales7: 0, cents7: 0, partial: false };
  let after = "";
  for (let page = 0; page < 10; page += 1) {
    const list = (await onAccount(
      "GET",
      store.stripeAccountId,
      `/checkout/sessions?limit=100&created[gte]=${since}${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`,
    )) as { data?: unknown; has_more?: unknown };
    const rows = Array.isArray(list.data) ? (list.data as (Row & { id?: unknown })[]) : [];
    for (const row of rows) {
      const meta = row.metadata ?? {};
      if (!handles.has(meta.store ?? "")) continue;
      if (row.status !== "complete" || row.payment_status !== "paid") continue;
      if (typeof row.currency === "string" && row.currency !== "usd") continue;
      const cents = typeof row.amount_total === "number" ? row.amount_total : 0;
      const created = typeof row.created === "number" ? row.created * 1000 : now;
      const day = dayKey(created);
      const recent = day >= weekAgo;
      const d = (out.byDay[day] ??= { sales: 0, cents: 0 });
      d.sales += 1;
      d.cents += cents;
      const p = (out.byProduct[meta.product ?? ""] ??= { sales: 0, cents: 0, sales7: 0, cents7: 0 });
      p.sales += 1;
      p.cents += cents;
      out.sales += 1;
      out.cents += cents;
      if (recent) {
        p.sales7 += 1;
        p.cents7 += cents;
        out.sales7 += 1;
        out.cents7 += cents;
      }
    }
    if (list.has_more !== true || rows.length === 0) break;
    const last = rows[rows.length - 1];
    after = typeof last.id === "string" ? last.id : "";
    if (!after) break;
    if (page === 9) out.partial = true;
  }

  // Products taken in one click after paying are charges of their own.
  const add = (day: string, productId: string, cents: number) => {
    const recent = day >= weekAgo;
    const d = (out.byDay[day] ??= { sales: 0, cents: 0 });
    d.sales += 1;
    d.cents += cents;
    const p = (out.byProduct[productId] ??= { sales: 0, cents: 0, sales7: 0, cents7: 0 });
    p.sales += 1;
    p.cents += cents;
    out.sales += 1;
    out.cents += cents;
    if (recent) {
      p.sales7 += 1;
      p.cents7 += cents;
      out.sales7 += 1;
      out.cents7 += cents;
    }
  };
  const intents = (await onAccount(
    "GET",
    store.stripeAccountId,
    `/payment_intents?limit=100&created[gte]=${since}`,
  )) as { data?: unknown };
  for (const pi of Array.isArray(intents.data) ? (intents.data as Record<string, unknown>[]) : []) {
    const meta = (pi.metadata ?? {}) as Record<string, string>;
    if (meta.kind !== "upsell" || !handles.has(meta.store ?? "") || pi.status !== "succeeded") continue;
    const created = typeof pi.created === "number" ? pi.created * 1000 : now;
    add(dayKey(created), meta.product ?? "", typeof pi.amount === "number" ? pi.amount : 0);
  }
  return out;
}

// ---- What the studio shows ------------------------------------------------

export type Totals = { visitors: number; views: number; checkouts: number; sales: number; cents: number };

export type StatsData = {
  days: { date: string; visitors: number; views: number; checkouts: number; sales: number }[];
  totals: { d7: Totals; d30: Totals };
  sources: { d7: { name: string; visits: number }[]; d30: { name: string; visits: number }[] };
  products: {
    id: string;
    title: string;
    d7: { checkouts: number; sales: number; cents: number };
    d30: { checkouts: number; sales: number; cents: number };
  }[];
  links: { id: string; title: string; d7: number; d30: number }[];
  /** "none" when there is no Stripe account to read sales from yet. */
  sales: "ok" | "none" | "error";
  partial: boolean;
};

/** Visits and sales put together, the shape the studio's panel draws. */
export function studioStats(store: Store, stats: Stats, sales: SalesStats | null, salesState: StatsData["sales"]): StatsData {
  const days = stats.days.map((day) => ({ ...day, sales: sales?.byDay[day.date]?.sales ?? 0 }));
  const last7 = days.slice(-7);
  const sum = (list: typeof days, key: "views" | "checkouts") => list.reduce((total, day) => total + day[key], 0);
  return {
    days,
    totals: {
      d7: { visitors: stats.visitors7, views: sum(last7, "views"), checkouts: sum(last7, "checkouts"), sales: sales?.sales7 ?? 0, cents: sales?.cents7 ?? 0 },
      d30: { visitors: stats.visitors, views: stats.views, checkouts: stats.checkouts, sales: sales?.sales ?? 0, cents: sales?.cents ?? 0 },
    },
    sources: { d7: stats.sources7, d30: stats.sources },
    products: store.products.map((product) => {
      const c = stats.checkoutsByProduct[product.id] ?? { all: 0, last7: 0 };
      const s = sales?.byProduct[product.id] ?? { sales: 0, cents: 0, sales7: 0, cents7: 0 };
      return {
        id: product.id,
        title: product.title,
        d7: { checkouts: c.last7, sales: s.sales7, cents: s.cents7 },
        d30: { checkouts: c.all, sales: s.sales, cents: s.cents },
      };
    }),
    links: store.links.map((link) => {
      const l = stats.linkClicks[link.id] ?? { all: 0, last7: 0 };
      return { id: link.id, title: link.title, d7: l.last7, d30: l.all };
    }),
    sales: salesState,
    partial: sales?.partial ?? false,
  };
}
