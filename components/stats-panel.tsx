"use client";

import { useState } from "react";

import type { StatsData } from "@/lib/stats";

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

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const count = (n: number) => n.toLocaleString("en-US");

function rate(sales: number, visitors: number): string {
  if (!visitors) return "—";
  const value = (sales / visitors) * 100;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A store's visits, checkouts and sales, for the last week or month. */
export function StatsPanel({ data }: { data: StatsData }) {
  const [range, setRange] = useState<"d7" | "d30">("d7");
  const totals = data.totals[range];
  const days = range === "d7" ? data.days.slice(-7) : data.days;
  const peak = Math.max(1, ...days.map((d) => d.visitors));
  const sources = data.sources[range];
  const sourceTotal = sources.reduce((sum, s) => sum + s.visits, 0) || 1;
  const salesKnown = data.sales === "ok";
  const empty = data.totals.d30.views === 0 && data.totals.d30.checkouts === 0 && data.totals.d30.sales === 0;

  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "Visitors", value: count(totals.visitors), note: "People, each counted once a day" },
    { label: "Page views", value: count(totals.views), note: "Every time your store was opened" },
    { label: "Checkouts started", value: count(totals.checkouts), note: "Pressed buy, book or get it free" },
    { label: "Sales", value: salesKnown ? count(totals.sales) : "—", note: salesKnown ? "Paid, from your Stripe" : data.sales === "none" ? "Once Stripe is connected" : "Stripe did not answer" },
    { label: "Revenue", value: salesKnown ? money(totals.cents) : "—", note: "Before Stripe's fee" },
    { label: "Conversion", value: salesKnown ? rate(totals.sales, totals.visitors) : "—", note: "Sales for every 100 visitors" },
  ];

  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="numbers-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="numbers-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
          Your numbers
        </h2>
        <div className="inline-flex rounded-full bg-paper p-1 ring-1 ring-line" role="group" aria-label="Period">
          {(["d7", "d30"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={range === key}
              onClick={() => setRange(key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                range === key ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-ink-soft hover:text-ink"
              }`}
            >
              {key === "d7" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="mt-3 text-ink-soft">
          Nothing counted yet. Share your store&apos;s address and the first visits show up here within seconds.
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

      <div className="mt-6">
        <p className="text-sm font-bold text-ink">Visitors a day</p>
        <div className="mt-3 flex h-28 items-end gap-[3px]" aria-hidden="true">
          {days.map((day) => (
            <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${shortDate(day.date)}: ${day.visitors} visitors, ${day.sales} sales`}>
              <div
                className="w-full rounded-t-[4px] bg-violet-brand/80"
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
        </details>
      </div>

      {sources.length ? (
        <div className="mt-6">
          <p className="text-sm font-bold text-ink">Where visitors came from</p>
          <ul className="mt-3 space-y-2">
            {sources.slice(0, 8).map((source) => {
              const share = Math.round((source.visits / sourceTotal) * 100);
              return (
                <li key={source.name} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-ink">{SOURCE_NAMES[source.name] ?? source.name}</span>
                    <span className="shrink-0 tabular-nums text-ink-soft">{`${count(source.visits)} · ${share}%`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-line" aria-hidden="true">
                    <div className="h-full rounded-full bg-violet-brand/70" style={{ width: `${Math.max(2, share)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            Add <span className="font-mono">?utm_source=newsletter</span> (or any word) to a link you share and its visits are counted under that word.
          </p>
        </div>
      ) : null}

      {data.products.length ? (
        // Scrolls sideways on a narrow phone, so it can be reached from the keyboard too.
        <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-labelledby="numbers-products">
          <table className="w-full text-left text-sm">
            <caption id="numbers-products" className="text-left text-sm font-bold text-ink">What you sell</caption>
            <thead>
              <tr className="text-ink-mute">
                <th scope="col" className="py-1.5 font-semibold">Product</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Checkouts</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Sales</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((product) => {
                const row = product[range];
                return (
                  <tr key={product.id} className="border-t border-line">
                    <td className="max-w-[7rem] truncate py-1.5 pr-2 font-semibold text-ink sm:max-w-[14rem]">{product.title}</td>
                    <td className="py-1.5 text-right tabular-nums">{count(row.checkouts)}</td>
                    <td className="py-1.5 text-right tabular-nums">{salesKnown ? count(row.sales) : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{salesKnown ? money(row.cents) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        Counted without cookies, and your own visits while logged in are not counted. A visitor is one person on one
        device on one day. Days run midnight to midnight UTC. Sales are read from your own Stripe account: new
        purchases and new members, before Stripe&apos;s fee and any refund; renewals are in your Stripe dashboard.
        {data.partial ? " This month had more sales than one reading covers, so the oldest are left out of these totals." : ""}
      </p>
    </section>
  );
}
