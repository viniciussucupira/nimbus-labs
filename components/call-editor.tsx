"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/store";
import {
  BUFFERS,
  CALL_LENGTHS,
  type CallSetup,
  DAY_NAMES,
  HORIZON_CHOICES,
  MAX_RANGES_PER_DAY,
  NOTICE_CHOICES,
  type Range,
  clock,
  defaultWeekly,
  fromClock,
} from "@/lib/call-setup";

const MESSAGES: Record<string, string> = {
  minutes: "Pick how long a call lasts.",
  tz: "Pick your time zone.",
  weekly: "Check your hours: switch on at least one day, and make every stretch long enough for one call, with the second stretch starting after the first ends.",
  notice: "Pick how much notice you need.",
  horizon: "Pick how far ahead people may book.",
  buffer: "Pick the gap between calls.",
  room: "The meeting link has to be a full web address starting with https://.",
  free: "Something free cannot be a paid call. Give it a price first.",
  recurring: "A membership cannot be a call. Make it a one-off price first.",
  options: "Take the price options off first: a call has one price.",
  delivery: "Take the file or link off first: a call delivers a time in your calendar, not a file.",
  course: "This is a course. Stop selling it as a course first.",
  unknown: "That product is not there any more. Reload the page.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

function zones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list && list.length) return list;
  } catch {}
  return ["UTC"];
}

function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "Mon–Fri 9:00–17:00" style, for the one-line summary in the studio. */
function summarise(setup: CallSetup): string {
  const days = setup.weekly
    .map((ranges, day) => (ranges.length ? `${DAY_NAMES[day].slice(0, 3)} ${ranges.map(([a, b]) => `${clock(a)}–${clock(b)}`).join(", ")}` : null))
    .filter(Boolean);
  return days.join(" · ");
}

type Draft = {
  minutes: number;
  tz: string;
  weekly: Range[][];
  noticeHours: number;
  horizonDays: number;
  bufferMinutes: number;
  room: string;
};

function toDraft(setup: CallSetup | null): Draft {
  if (setup) {
    return { ...setup, weekly: setup.weekly.map((day) => day.map((r) => [r[0], r[1]] as Range)), room: setup.room ?? "" };
  }
  return { minutes: 30, tz: localZone(), weekly: defaultWeekly(), noticeHours: 12, horizonDays: 30, bufferMinutes: 10, room: "" };
}

/** Selling a product as a paid call: hours, length, and where it happens. */
export function CallEditor({ product, email }: { product: Product; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(product.call));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible =
    product.priceCents > 0 && !product.recurring && product.options.length === 0 && !product.file && !product.link && !product.course;

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  function setRange(day: number, index: number, part: 0 | 1, text: string) {
    const typed = fromClock(text);
    if (typed === null) return;
    // Hours move in steps of five minutes, and a day's last minute means its end.
    const minutes = part === 1 && typed === 1439 ? 1440 : Math.round(typed / 5) * 5;
    const weekly = draft.weekly.map((ranges) => ranges.map((r) => [r[0], r[1]] as Range));
    weekly[day][index][part] = minutes;
    setDraft({ ...draft, weekly });
  }

  if (!product.call && !open) {
    if (!eligible) return null;
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            setDraft(toDraft(null));
            setOpen(true);
          }}
          className="text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
        >
          Sell this as a paid call with a calendar
        </button>
      </div>
    );
  }

  if (product.call && !open) {
    const setup = product.call;
    return (
      <div className="mt-3 rounded-[var(--r-sm)] border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">
          {`Paid call · ${setup.minutes} minutes · ${setup.tz}`}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{summarise(setup)}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {`At least ${setup.noticeHours} hours' notice, up to ${setup.horizonDays} days ahead${setup.bufferMinutes ? `, ${setup.bufferMinutes} minutes between calls` : ""}.`}
        </p>
        <p className="mt-1 break-all text-sm text-ink-soft">
          {setup.room ? `Meeting link: ${setup.room}` : "No meeting link: you send one to each buyer yourself."}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
          <button
            type="button"
            onClick={() => {
              setDraft(toDraft(setup));
              setOpen(true);
            }}
            className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
          >
            Change the hours
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => send({ id: product.id, remove: true })}
            className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
          >
            Stop selling it as a call
          </button>
        </div>
        {error ? <p className="notice notice-error mt-3" role="alert">{error}</p> : null}
      </div>
    );
  }

  const zoneList = zones();

  return (
    <form
      className="mt-3 space-y-5 rounded-[var(--r-sm)] border border-line bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        send({
          id: product.id,
          call: { ...draft, room: draft.room.trim() },
        });
      }}
    >
      <p className="font-semibold text-ink">Paid call</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">How long</span>
          <select
            className="field mt-2"
            value={draft.minutes}
            onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}
          >
            {CALL_LENGTHS.map((m) => (
              <option key={m} value={m}>{`${m} minutes`}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Your time zone</span>
          <select className="field mt-2" value={draft.tz} onChange={(e) => setDraft({ ...draft, tz: e.target.value })}>
            {(zoneList.includes(draft.tz) ? zoneList : [draft.tz, ...zoneList]).map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="field-label">When people can book, in your time zone</legend>
        <div className="mt-2 space-y-2">
          {DAY_NAMES.map((name, day) => {
            const ranges = draft.weekly[day];
            const on = ranges.length > 0;
            return (
              <div key={name} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-paper px-3 py-2">
                <label className="flex w-32 items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const weekly = draft.weekly.map((r) => r.map((x) => [x[0], x[1]] as Range));
                      weekly[day] = on ? [] : [[540, 1020]];
                      setDraft({ ...draft, weekly });
                    }}
                    className="h-4 w-4 accent-violet-brand"
                  />
                  {name}
                </label>
                {on ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {ranges.map((range, index) => (
                      <span key={index} className="flex items-center gap-1.5 text-sm text-ink-soft">
                        <input
                          type="time"
                          step={300}
                          aria-label={`${name}, stretch ${index + 1}, from`}
                          value={clock(range[0])}
                          onChange={(e) => setRange(day, index, 0, e.target.value)}
                          className="field !min-h-0 w-[7.5rem] !py-1.5"
                        />
                        to
                        <input
                          type="time"
                          step={300}
                          aria-label={`${name}, stretch ${index + 1}, to`}
                          value={clock(range[1] === 1440 ? 1439 : range[1])}
                          onChange={(e) => setRange(day, index, 1, e.target.value)}
                          className="field !min-h-0 w-[7.5rem] !py-1.5"
                        />
                        {index > 0 ? (
                          <button
                            type="button"
                            aria-label={`Remove ${name}'s second stretch`}
                            onClick={() => {
                              const weekly = draft.weekly.map((r) => r.map((x) => [x[0], x[1]] as Range));
                              weekly[day] = weekly[day].slice(0, 1);
                              setDraft({ ...draft, weekly });
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-ink-mute transition hover:bg-white hover:text-danger"
                          >
                            &times;
                          </button>
                        ) : null}
                      </span>
                    ))}
                    {ranges.length < MAX_RANGES_PER_DAY ? (
                      <button
                        type="button"
                        onClick={() => {
                          const weekly = draft.weekly.map((r) => r.map((x) => [x[0], x[1]] as Range));
                          const end = weekly[day][0][1];
                          weekly[day].push([Math.min(end + 60, 1380), Math.min(end + 180, 1440)]);
                          setDraft({ ...draft, weekly });
                        }}
                        className="text-sm font-semibold text-violet-deep underline underline-offset-4"
                      >
                        Add a second stretch
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm text-ink-mute">Not available</span>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="field-label">Notice you need</span>
          <select className="field mt-2" value={draft.noticeHours} onChange={(e) => setDraft({ ...draft, noticeHours: Number(e.target.value) })}>
            {NOTICE_CHOICES.map((h) => (
              <option key={h} value={h}>{h === 1 ? "1 hour" : `${h} hours`}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Book up to</span>
          <select className="field mt-2" value={draft.horizonDays} onChange={(e) => setDraft({ ...draft, horizonDays: Number(e.target.value) })}>
            {HORIZON_CHOICES.map((d) => (
              <option key={d} value={d}>{`${d} days ahead`}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Gap between calls</span>
          <select className="field mt-2" value={draft.bufferMinutes} onChange={(e) => setDraft({ ...draft, bufferMinutes: Number(e.target.value) })}>
            {BUFFERS.map((b) => (
              <option key={b} value={b}>{b === 0 ? "None" : `${b} minutes`}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="field-label">Meeting link</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://zoom.us/j/… or https://meet.google.com/…"
          value={draft.room}
          onChange={(e) => setDraft({ ...draft, room: e.target.value })}
          className="field mt-2"
        />
        <span className="field-hint mt-1 block">
          Your Zoom, Google Meet or Whereby room. Each buyer gets it the moment they have paid. Leave it empty to send one yourself.
        </span>
      </label>

      <p className="rounded-[10px] bg-paper px-3 py-2 text-sm text-ink-soft">
        {`When someone books, you both get an email with a calendar file. A buyer can reply to theirs to reach you, and the reply goes to ${email}.`}
      </p>

      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : product.call ? "Save the hours" : "Sell it as a call"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
