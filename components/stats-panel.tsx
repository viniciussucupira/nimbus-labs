"use client";

import { useState } from "react";

import type { AllTimeSales, Ranked, RangeKey, StatsData } from "@/lib/stats";

const SOURCE_NAMES: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  threads: "Threads",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  reddit: "Reddit",
  linktree: "Linktree",
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  email: "Email",
  direct: "Direct, or an app that hides it",
};

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "d7", label: "7 days" },
  { key: "d30", label: "30 days" },
  { key: "d90", label: "90 days" },
  { key: "all", label: "All time" },
];

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const count = (n: number) => n.toLocaleString("en-US");

function rate(part: number, whole: number): string {
  if (!whole) return "—";
  const value = (part / whole) * 100;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** One list of where visits came from, with a bar each. */
function Breakdown({ title, rows, named = false }: { title: string; rows: Ranked; named?: boolean }) {
  const total = rows.reduce((sum, s) => sum + s.visits, 0) || 1;
  return (
    <div className="min-w-0">
      <p className="text-sm font-bold text-ink">{title}</p>
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 8).map((row) => {
          const share = Math.round((row.visits / total) * 100);
          return (
            <li key={row.name} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-ink">{named ? SOURCE_NAMES[row.name] ?? row.name : row.name}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">{`${count(row.visits)} · ${share}%`}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-line" aria-hidden="true">
                <div className="h-full rounded-full bg-violet-brand/70" style={{ width: `${Math.max(2, share)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A store's visits, checkouts and sales, for the last week, month, quarter or all time. */
export function StatsPanel({ data }: { data: StatsData }) {
  const [range, setRange] = useState<RangeKey>("d7");
  const [all, setAll] = useState<{ state: "idle" | "loading" | "error" } | { state: "ok"; sales: AllTimeSales }>({ state: "idle" });
  const salesKnown = data.sales === "ok";

  async function loadAll() {
    if (!salesKnown || all.state === "loading" || all.state === "ok") return;
    setAll({ state: "loading" });
    try {
      const response = await fetch("/api/store/stats?range=all", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; sales?: AllTimeSales };
      setAll(body.ok && body.sales ? { state: "ok", sales: body.sales } : { state: "error" });
    } catch {
      setAll({ state: "error" });
    }
  }

  function choose(key: RangeKey) {
    setRange(key);
    if (key === "all") loadAll();
  }

  // All-time sales arrive when asked for; until then they are shown as coming.
  const allSales = all.state === "ok" ? all.sales : null;
  const salesHere = salesKnown && (range !== "all" || allSales !== null);
  const totals =
    range === "all" && allSales ? { ...data.totals.all, sales: allSales.totals.sales, cents: allSales.totals.cents } : data.totals[range];
  const days = range === "d7" ? data.days.slice(-7) : range === "d30" ? data.days.slice(-30) : data.days;
  const peak = Math.max(1, ...days.map((d) => d.visitors));
  const empty = data.totals.all.views === 0 && data.totals.d90.checkouts === 0 && data.totals.d90.sales === 0;
  const salesNote = !salesKnown
    ? data.sales === "none"
      ? "Once Stripe is connected"
      : "Stripe did not answer"
    : range === "all" && !allSales
      ? all.state === "error"
        ? "Stripe did not answer"
        : "Reading Stripe…"
      : "Paid, from your Stripe";

  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "Visitors", value: count(totals.visitors), note: "People, each counted once a day" },
    { label: "Page views", value: count(totals.views), note: "Every time your store was opened" },
    { label: "Checkouts started", value: count(totals.checkouts), note: "Pressed buy, book or get it free" },
    { label: "Sales", value: salesHere ? count(totals.sales) : "—", note: salesNote },
    { label: "Revenue", value: salesHere ? money(totals.cents) : "—", note: "Before Stripe's fee" },
    { label: "Conversion", value: salesHere ? rate(totals.sales, totals.visitors) : "—", note: "Sales for every 100 visitors" },
  ];

  // Products, the best sellers first: by revenue, then sales, then checkouts.
  const products = data.products
    .map((product) => {
      const row = product[range];
      const sold = range === "all" ? allSales?.byProduct[product.id] ?? { sales: 0, cents: 0 } : row;
      return { id: product.id, title: product.title, checkouts: row.checkouts, sales: sold.sales, cents: sold.cents };
    })
    .sort((a, b) => b.cents - a.cents || b.sales - a.sales || b.checkouts - a.checkouts);
  const shownProducts = products.filter((p) => p.checkouts || p.sales).length ? products.filter((p) => p.checkouts || p.sales) : products;
  const sources = data.sources[range];
  const mediums = data.mediums[range];
  const campaigns = data.campaigns[range];

  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="numbers-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="numbers-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
          Your numbers
        </h2>
        <div className="inline-flex max-w-full flex-wrap rounded-full bg-paper p-1 ring-1 ring-line" role="group" aria-label="Period">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={range === key}
              onClick={() => choose(key)}
              className={`min-h-8 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                range === key ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="mt-3 text-ink-soft">
          Nothing counted yet. Share your store&apos;s address and the first visits show up here within seconds.
        </p>
      ) : null}
      {range === "all" ? (
        <p className="mt-3 text-sm text-ink-soft">
          {`Visits since ${data.since ? longDate(data.since) : "the first one counted"}. `}
          {allSales
            ? allSales.since
              ? `Sales since ${longDate(allSales.since)}, the first one on your Stripe account.`
              : "No sales on your Stripe account yet."
            : null}
          {allSales?.partial ? " Your store has more sales than one reading covers (3,000 checkouts), so the oldest are left out." : ""}
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[12px] bg-paper px-4 py-3 ring-1 ring-line">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-mute">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{tile.value}</dd>
            {tile.note ? <dd className="mt-0.5 text-xs text-ink-soft">{tile.note}</dd> : null}
          </div>
        ))}
      </dl>

      {range !== "all" ? (
        <div className="mt-6">
          <p className="text-sm font-bold text-ink">Visitors a day</p>
          <div className={`mt-3 flex h-28 items-end ${days.length > 30 ? "gap-px" : "gap-[3px]"}`} aria-hidden="true">
            {days.map((day) => (
              <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${shortDate(day.date)}: ${day.visitors} visitors, ${day.sales} sales`}>
                <div
                  className="w-full rounded-t-[3px] bg-violet-brand/80"
                  style={{ height: `${Math.max(day.visitors ? 4 : 1, (day.visitors / peak) * 100)}%`, opacity: day.visitors ? 1 : 0.25 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-mute" aria-hidden="true">
            <span>{shortDate(days[0].date)}</span>
            <span>{shortDate(days[days.length - 1].date)}</span>
          </div>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-soft">See each day</summary>
            <div className="max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label="Each day">
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="text-ink-mute">
                    <th scope="col" className="py-1 font-semibold">Day (UTC)</th>
                    <th scope="col" className="py-1 text-right font-semibold">Visitors</th>
                    <th scope="col" className="py-1 text-right font-semibold">Checkouts</th>
                    <th scope="col" className="py-1 text-right font-semibold">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {[...days].reverse().map((day) => (
                    <tr key={day.date} className="border-t border-line">
                      <td className="py-1">{shortDate(day.date)}</td>
                      <td className="py-1 text-right tabular-nums">{count(day.visitors)}</td>
                      <td className="py-1 text-right tabular-nums">{count(day.checkouts)}</td>
                      <td className="py-1 text-right tabular-nums">{salesKnown ? count(day.sales) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ) : null}

      {sources.length ? (
        <div className="mt-6">
          <Breakdown title="Where visitors came from" rows={sources} named />
          <p className="mt-2 text-xs text-ink-soft">
            Add <span className="font-mono">?utm_source=newsletter</span> (or any word) to a link you share and its visits are counted under that word.
          </p>
        </div>
      ) : null}

      {mediums.length || campaigns.length ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {mediums.length ? <Breakdown title="By medium (utm_medium)" rows={mediums} /> : null}
          {campaigns.length ? <Breakdown title="By campaign (utm_campaign)" rows={campaigns} /> : null}
        </div>
      ) : sources.length ? (
        <p className="mt-4 text-xs text-ink-soft">
          Tag links with <span className="font-mono">utm_medium</span> and <span className="font-mono">utm_campaign</span> too (say
          <span className="font-mono"> ?utm_source=instagram&amp;utm_medium=story&amp;utm_campaign=launch</span>) and each gets a list of its own here.
        </p>
      ) : null}

      {data.products.length ? (
        // Scrolls sideways on a narrow phone, so it can be reached from the keyboard too.
        <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-labelledby="numbers-products">
          <table className="w-full text-left text-sm">
            <caption id="numbers-products" className="text-left text-sm font-bold text-ink">
              What you sell, best first
            </caption>
            <thead>
              <tr className="text-ink-mute">
                <th scope="col" className="py-1.5 font-semibold">Product</th>
                <th scope="col" className="whitespace-nowrap py-1.5 pl-3 text-right font-semibold">Checkouts</th>
                <th scope="col" className="whitespace-nowrap py-1.5 pl-3 text-right font-semibold">Sales</th>
                <th scope="col" className="whitespace-nowrap py-1.5 pl-3 text-right font-semibold">Revenue</th>
                <th scope="col" className="whitespace-nowrap py-1.5 pl-3 text-right font-semibold" title="Sales for every 100 checkouts started">
                  Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {shownProducts.map((product, index) => (
                <tr key={product.id} className="border-t border-line">
                  <td className="max-w-[7rem] truncate py-1.5 pr-2 font-semibold text-ink sm:max-w-[14rem]">
                    {index < 3 && product.cents > 0 ? <span className="mr-1.5 tabular-nums text-violet-deep">{index + 1}.</span> : null}
                    {product.title}
                  </td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{count(product.checkouts)}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{salesHere ? count(product.sales) : "—"}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{salesHere ? money(product.cents) : "—"}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{salesHere ? rate(product.sales, product.checkouts) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-soft">
            Paid is sales for every 100 checkouts started. A free product&apos;s checkouts are the addresses asked for, and
            it has no sales.
          </p>
        </div>
      ) : null}

      {data.links.length ? (
        <div className="mt-6">
          <p className="text-sm font-bold text-ink">Your links, opened</p>
          <ul className="mt-2 divide-y divide-line text-sm">
            {data.links.map((link) => (
              <li key={link.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-ink">{link.title}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">{count(link[range])}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 rounded-[12px] bg-paper px-4 py-4 ring-1 ring-line">
        <p className="text-sm font-bold text-ink">Take your numbers with you</p>
        <p className="mt-1 text-xs text-ink-soft">CSV files that open in Excel, Numbers and Google Sheets.</p>
        {/* Plain GET forms rather than links, so nothing prefetches a file that reads Stripe. */}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {salesKnown ? (
            <form action="/api/store/export" method="get" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="what" value="sales" />
              <label className="text-sm">
                <span className="field-label">Sales</span>
                <select name="range" defaultValue="30" className="field mt-1 w-auto py-2">
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">All</option>
                </select>
              </label>
              <button type="submit" className="btn btn-primary btn-sm">
                Download sales
              </button>
            </form>
          ) : null}
          <form action="/api/store/export" method="get">
            <input type="hidden" name="what" value="visits" />
            <button type="submit" className="btn btn-secondary btn-sm">
              Visits by day
            </button>
          </form>
          <form action="/api/store/export" method="get">
            <input type="hidden" name="what" value="sources" />
            <button type="submit" className="btn btn-secondary btn-sm">
              Sources and campaigns
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          The sales file has one row per paid checkout or one-click extra, with the buyer&apos;s email and name, and reads up
          to 5,000 of each from your Stripe account. Visits go back as far as they are kept, 400 days.
        </p>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        Counted without cookies, and your own visits while logged in are not counted. A visitor is one person on one
        device on one day. Days run midnight to midnight UTC. Sales are read from your own Stripe account: new
        purchases and new members, before Stripe&apos;s fee and any refund; renewals are in your Stripe dashboard.
        {data.partial ? " These 90 days had more sales than one reading covers (1,000 checkouts), so the oldest are left out of these totals." : ""}
      </p>
    </section>
  );
}
