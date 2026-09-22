"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

function dayKey(ms: number, tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  return p;
}

function dayLabel(ms: number, tz: string) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o }).format(new Date(ms));
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}

function timeLabel(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

function longLabel(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function zoneLabel(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/**
 * The times a buyer may book, shown in the buyer's own time zone.
 *
 * The page is first drawn in the creator's zone — which is all the server can
 * know — and redrawn in the buyer's as soon as the browser says which that is.
 * The times are radio buttons inside a plain form, so the first day's times
 * can still be booked with JavaScript turned off, in the creator's zone and
 * said so.
 */
export function SlotPicker({
  starts,
  creatorTz,
  handle,
  productId,
  minutes,
  price,
}: {
  starts: number[];
  creatorTz: string;
  handle: string;
  productId: string;
  minutes: number;
  price: string;
}) {
  const tz = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || creatorTz,
    () => creatorTz,
  );
  // True once the browser has said which zone it is in.
  const local = useSyncExternalStore(noop, () => true, () => false);

  const days = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const start of starts) {
      const key = dayKey(start, tz);
      const list = map.get(key) ?? [];
      list.push(start);
      map.set(key, list);
    }
    return [...map.entries()].map(([key, list]) => ({ key, starts: list.sort((a, b) => a - b) }));
  }, [starts, tz]);

  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const day = days.find((d) => d.key === chosenDay) ?? days[0];

  if (days.length === 0) {
    return (
      <div className="st-note mt-6 text-center">
        <p className="font-bold" style={{ color: "var(--st-text)" }}>No free times right now</p>
        <p className="mt-1 text-sm">Every time that can be booked is taken. Come back in a day or two: new times open as the days go by.</p>
      </div>
    );
  }

  return (
    <form action="/api/store/book" method="post" className="mt-6">
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="product" value={productId} />
      <input type="hidden" name="tz" value={tz} />

      {/* A fieldset is as wide as its widest child unless told otherwise,
          which would push the row of days out of the card. */}
      <fieldset className="min-w-0">
        <legend className="st-label">Pick a day</legend>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
          {days.map((d) => {
            const label = dayLabel(d.starts[0], tz);
            const active = d.key === day.key;
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setChosenDay(d.key);
                  setChosen(null);
                }}
                className="st-option shrink-0 flex-col !gap-0 px-3 py-2 text-center"
                style={active ? { borderColor: "var(--st-accent-text)", background: "var(--st-accent-soft)" } : undefined}
              >
                <span className="st-muted text-xs font-semibold uppercase tracking-wide">{label.weekday}</span>
                <span className="text-xl font-semibold leading-tight">{label.day}</span>
                <span className="st-muted text-xs">{label.month}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5 min-w-0">
        <legend className="st-label">Pick a time</legend>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {day.starts.map((start) => (
            <label key={start} className="st-option cursor-pointer justify-center !px-2 !py-2.5 text-center font-semibold tabular-nums">
              <input
                type="radio"
                name="start"
                value={start}
                required
                className="sr-only"
                checked={chosen === start}
                onChange={() => setChosen(start)}
              />
              {timeLabel(start, tz)}
            </label>
          ))}
        </div>
        <p className="st-muted mt-3 text-sm">
          {`Times are in ${local ? "your" : "the creator's"} time zone, ${zoneLabel(day.starts[0], tz)}.`}
        </p>
      </fieldset>

      <div className="mt-6">
        {chosen ? (
          <p className="mb-3 rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }} role="status">
            <strong>{longLabel(chosen, tz)}</strong>
            {` · ${minutes} minutes`}
          </p>
        ) : null}
        <button type="submit" className="btn st-btn btn-lg btn-block">
          {`Continue to payment — $${price}`}
        </button>
        <p className="st-muted mt-3 text-center text-xs">
          The time is kept for you for 30 minutes while you pay.
        </p>
      </div>
    </form>
  );
}
