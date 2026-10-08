"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const never = () => () => {};

/** What the countdown says, in the store's language (lib/buyer-words), and how it writes a date. */
export type CountdownWords = {
  units: { days: string; hours: string; min: string; sec: string };
  /** "Until {when}", with {when} where the moment goes. */
  until: string;
  locale: string;
};

const ENGLISH: CountdownWords = { units: { days: "days", hours: "hours", min: "min", sec: "sec" }, until: "Until {when}", locale: "en-US" };

/**
 * A countdown to one moment (lib/sales-page.ts, CountdownBlock): the same
 * moment for every visitor, never one that starts again for each of them.
 * When it has passed, nothing is drawn.
 *
 * `now` is the server's clock at the moment the page was drawn, so the first
 * numbers are the same on the server and in the browser; from then on the
 * browser's own clock counts. The exact time is shown in the visitor's own
 * time zone once the browser is there to say which one that is.
 */
export function Countdown({
  until,
  now,
  heading,
  note,
  words = ENGLISH,
}: {
  until: number;
  now?: number;
  heading: string;
  note: string;
  words?: CountdownWords;
}) {
  const [clock, setClock] = useState<number | null>(now ?? null);
  // True only in the browser, after the page drawn on the server has been taken over.
  const here = useSyncExternalStore(never, () => true, () => false);

  useEffect(() => {
    const tick = () => setClock(Math.floor(Date.now() / 1000));
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const left = clock === null ? null : until - clock;
  if (left !== null && left <= 0) return null;
  const seconds = left ?? 0;
  const parts: [number, string][] = [
    [Math.floor(seconds / 86_400), words.units.days],
    [Math.floor((seconds % 86_400) / 3_600), words.units.hours],
    [Math.floor((seconds % 3_600) / 60), words.units.min],
    [seconds % 60, words.units.sec],
  ];
  const when = here
    ? new Date(until * 1000).toLocaleString(words.locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : "";
  return (
    <div className="sp-countdown" role="timer" aria-live="off">
      {heading ? <p className="font-display text-xl font-semibold leading-snug">{heading}</p> : null}
      <div className="sp-countdown-units" aria-hidden="true">
        {parts.map(([value, word]) => (
          <span key={word} className="sp-countdown-unit">
            <span className="sp-countdown-number">{left === null ? "–" : String(value).padStart(2, "0")}</span>
            <span className="sp-countdown-word st-muted">{word}</span>
          </span>
        ))}
      </div>
      {when ? <p className="st-muted mt-4 text-sm">{words.until.replace("{when}", when)}</p> : null}
      {note ? <p className="mt-2 text-sm font-semibold">{note}</p> : null}
    </div>
  );
}
