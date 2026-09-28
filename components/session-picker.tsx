"use client";

import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

function dateParts(ms: number, tz: string) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o }).format(new Date(ms));
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}

function timeRange(start: number, end: number, tz: string): string {
  const f = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(ms));
  return `${f(start)} – ${f(end)}`;
}

function zoneLabel(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

function length(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} ${h === 1 ? "hour" : "hours"}`;
}

export type SessionChoice = { start: number; end: number; minutes: number; seats: number; left: number };

/**
 * The dated live sessions a buyer may take a seat in, shown in the buyer's
 * own time zone, soonest first.
 *
 * Like the slot picker, it is a plain form of radio buttons: drawn first in
 * the creator's zone, which is all the server knows, and redrawn in the
 * buyer's once the browser says which that is. Only sessions still on sale
 * with a seat left reach it. Given `move`, it moves a booking instead.
 */
export function SessionPicker({
  sessions,
  creatorTz,
  handle,
  productId,
  price,
  move,
}: {
  sessions: SessionChoice[];
  creatorTz: string;
  handle: string;
  productId: string;
  price: string;
  move?: string;
}) {
  const tz = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || creatorTz,
    () => creatorTz,
  );
  const local = useSyncExternalStore(noop, () => true, () => false);
  const [chosen, setChosen] = useState<number | null>(sessions.length === 1 ? sessions[0].start : null);

  if (sessions.length === 0) {
    return (
      <div className="st-note mt-6 text-center">
        <p className="font-bold" style={{ color: "var(--st-text)" }}>
          {move ? "No other session has a seat right now" : "No sessions to book right now"}
        </p>
        <p className="mt-1 text-sm">
          {move
            ? "Your seat stays as it is."
            : "Every session is full or too close to its start to book. New dates appear here when they are added."}
        </p>
      </div>
    );
  }

  return (
    <form action={move ? "/api/store/book/move" : "/api/store/book"} method="post" className="mt-6" {...(move ? {} : { "data-checkout": "" })}>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="product" value={productId} />
      <input type="hidden" name="tz" value={tz} />
      {move ? <input type="hidden" name="session" value={move} /> : null}

      <fieldset className="min-w-0">
        <legend className="st-label">Pick a session</legend>
        <div className="mt-3 space-y-2">
          {sessions.map((session) => {
            const d = dateParts(session.start, tz);
            return (
              <label key={session.start} className="st-option !justify-start !gap-4 !py-3">
                <input
                  type="radio"
                  name="start"
                  value={session.start}
                  required
                  className="sr-only"
                  checked={chosen === session.start}
                  onChange={() => setChosen(session.start)}
                />
                <span
                  aria-hidden="true"
                  className="flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5"
                  style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                >
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wide">{d.month}</span>
                  <span className="text-xl font-semibold leading-tight tabular-nums">{d.day}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold tabular-nums">{`${d.weekday}, ${timeRange(session.start, session.end, tz)}`}</span>
                  <span className="st-muted block text-sm">
                    {`${length(session.minutes)}${session.seats > 1 ? ` · ${session.left} of ${session.seats} seats left` : ""}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="st-muted mt-3 text-sm">
          {`Times are in ${local ? "your" : "the creator's"} time zone, ${zoneLabel(sessions[0].start, tz)}.`}
        </p>
      </fieldset>

      <div className="mt-6">
        <button type="submit" className="btn st-btn btn-lg btn-block">
          {move ? "Move my seat to this session" : `Continue to payment — ${price}`}
        </button>
        <p className="st-muted mt-3 text-center text-xs">
          {move
            ? "Nothing is charged. Your old seat is freed for somebody else."
            : "Your seat is kept for you for 30 minutes while you pay."}
        </p>
      </div>
    </form>
  );
}
