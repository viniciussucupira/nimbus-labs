"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import type { Product } from "@/lib/store";
import {
  BUFFERS,
  CALL_LENGTHS,
  type CallSetup,
  DAY_NAMES,
  HORIZON_CHOICES,
  MAX_RANGES_PER_DAY,
  MAX_SEATS,
  MAX_SESSIONS,
  MAX_SESSION_SEATS,
  NOTICE_CHOICES,
  type Range,
  SESSION_LENGTHS,
  SESSION_NOTICE_CHOICES,
  clock,
  defaultWeekly,
  fromClock,
  newSessionId,
  partsIn,
} from "@/lib/call-setup";

const MESSAGES: Record<string, string> = {
  minutes: "Pick how long a call lasts.",
  tz: "Pick your time zone.",
  weekly: "Check your hours: switch on at least one day, and make every stretch long enough for one call, with the second stretch starting after the first ends.",
  notice: "Pick how much notice you need.",
  horizon: "Pick how far ahead people may book.",
  buffer: "Pick the gap between calls.",
  room: "The meeting link has to be a full web address starting with https://.",
  seats: `People per time has to be a whole number from 1 to ${MAX_SEATS}.`,
  sessions: `Add at least one session, at most ${MAX_SESSIONS}, and no two starting at the same moment.`,
  session_time: "Check each session's date and start time: one of them is missing, or is a time your clocks skip when they go forward.",
  session_seats: `Seats in a session have to be a whole number from 1 to ${MAX_SESSION_SEATS}.`,
  session_room: "Each session's meeting link has to be a full web address starting with https://, or left empty.",
  past: "A new or changed session has to start in the future.",
  upcoming: "Add at least one session that is still to come.",
  booked: "Somebody has booked a session you moved or took off. A booked session keeps its date, time and length; you can still change its link, or add more seats.",
  booked_seats: "A session cannot have fewer seats than are already booked.",
  kind: "People have booked times that are still to come, so this cannot switch between weekly hours and dated sessions until they have passed.",
  error: "Your bookings could not be checked with Stripe just now, so nothing was saved. Try again in a moment.",
  free: "Something free cannot be a paid call. Give it a price first.",
  recurring: "A membership cannot be a call. Make it a one-off price first.",
  options: "Take the price options off first: a call has one price.",
  delivery: "Take the file or link off first: a call delivers a time in your calendar, not a file.",
  course: "This is a course. Stop selling it as a course first.",
  unknown: "That product is not there any more. Reload the page.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
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

function hoursLabel(h: number): string {
  return h === 1 ? "1 hour" : `${h} hours`;
}

function sessionLength(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : h === 1 ? "1 hour" : `${h} hours`;
}

type SessionDraft = { id: string; date: string; time: string; minutes: number; seats: string; room: string };

type Draft = {
  kind: "weekly" | "live";
  minutes: number;
  tz: string;
  weekly: Range[][];
  noticeHours: number;
  horizonDays: number;
  bufferMinutes: number;
  room: string;
  /** Typed, so a field being cleared to retype it is not snapped back to a number. */
  seats: string;
  sessions: SessionDraft[];
};

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** A new session: a week from today at six in the evening, like the one before it if there is one. */
function newSession(tz: string, before: SessionDraft | undefined): SessionDraft {
  const p = partsIn(Date.now() + 7 * 86_400_000, tz);
  return {
    id: newSessionId(),
    date: isoDate(p.year, p.month, p.day),
    time: before?.time ?? "18:00",
    minutes: before?.minutes ?? 60,
    seats: before?.seats ?? "100",
    room: before?.room ?? "",
  };
}

function toDraft(setup: CallSetup | null, kind: "weekly" | "live"): Draft {
  if (setup) {
    const now = Date.now();
    return {
      ...setup,
      weekly: setup.weekly.map((day) => day.map((r) => [r[0], r[1]] as Range)),
      room: setup.room ?? "",
      seats: String(setup.seats),
      // Sessions that are over are not shown, and are let go when this is saved.
      sessions: setup.sessions
        .filter((s) => s.start + s.minutes * 60_000 > now)
        .map((s) => {
          const p = partsIn(s.start, setup.tz);
          return {
            id: s.id,
            date: isoDate(p.year, p.month, p.day),
            time: clock(p.hour * 60 + p.minute),
            minutes: s.minutes,
            seats: String(s.seats),
            room: s.room ?? "",
          };
        }),
    };
  }
  const tz = localZone();
  return {
    kind,
    minutes: 30,
    tz,
    weekly: defaultWeekly(),
    noticeHours: kind === "live" ? 0 : 12,
    horizonDays: 30,
    bufferMinutes: 10,
    room: "",
    seats: "1",
    sessions: kind === "live" ? [newSession(tz, undefined)] : [],
  };
}

/** The next few dated sessions, as the summary in the studio lists them. */
function upcomingSessions(setup: CallSetup) {
  const now = Date.now();
  return setup.sessions.filter((s) => s.start + s.minutes * 60_000 > now);
}

function sessionWhen(start: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(start));
}

/** Selling a product as a paid call: hours or dated sessions, length, seats, and where it happens. */
export function CallEditor({ product, email }: { product: Product; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(product.call, product.call?.kind ?? "weekly"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible =
    product.priceCents > 0 &&
    !product.recurring &&
    product.options.length === 0 &&
    !product.file &&
    !product.link &&
    !product.course &&
    // A call is booked at a set price, never a chosen one.
    !product.pwyw;

  async function send(payload: Record<string, unknown>, confirmation: string) {
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
        toast(confirmation);
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

  function setSession(index: number, change: Partial<SessionDraft>) {
    const sessions = draft.sessions.map((s, i) => (i === index ? { ...s, ...change } : s));
    setDraft({ ...draft, sessions });
  }

  if (!product.call && !open) {
    if (!eligible) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={() => {
            setDraft(toDraft(null, "weekly"));
            setOpen(true);
          }}
          className="inline-flex min-h-6 items-center text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
        >
          Sell this as a paid call with a calendar
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(toDraft(null, "live"));
            setOpen(true);
          }}
          className="inline-flex min-h-6 items-center text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
        >
          Sell seats in live sessions on set dates
        </button>
      </div>
    );
  }

  if (product.call && !open) {
    const setup = product.call;
    const live = setup.kind === "live";
    const coming = live ? upcomingSessions(setup) : [];
    return (
      <div className="mt-3 rounded-[var(--r-sm)] border border-line bg-white p-4">
        {live ? (
          <>
            <p className="text-sm font-semibold text-ink">
              {`Live sessions · ${coming.length} coming up · ${setup.tz}`}
            </p>
            {coming.length ? (
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {coming.slice(0, 5).map((s) => (
                  <li key={s.id} className="break-words">
                    <span className="font-semibold text-ink">{sessionWhen(s.start, setup.tz)}</span>
                    {` · ${sessionLength(s.minutes)} · ${s.seats} ${s.seats === 1 ? "seat" : "seats"}${s.room ? "" : " · no meeting link yet"}`}
                  </li>
                ))}
                {coming.length > 5 ? <li>{`and ${coming.length - 5} more`}</li> : null}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">No sessions to come. Add one so buyers have something to book.</p>
            )}
            <p className="mt-2 text-sm text-ink-soft">
              {setup.noticeHours === 0
                ? "On sale until each session starts."
                : `Sales close ${hoursLabel(setup.noticeHours)} before each session.`}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">
              {setup.seats > 1
                ? `Group call · ${setup.minutes} minutes · up to ${setup.seats} people · ${setup.tz}`
                : `Paid call · ${setup.minutes} minutes · ${setup.tz}`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{summarise(setup)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {`At least ${setup.noticeHours} hours' notice, up to ${setup.horizonDays} days ahead${setup.bufferMinutes ? `, ${setup.bufferMinutes} minutes between calls` : ""}.`}
            </p>
            <p className="mt-1 break-all text-sm text-ink-soft">
              {setup.room ? `Meeting link: ${setup.room}` : "No meeting link: you send one to each buyer yourself."}
            </p>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
          <button
            type="button"
            onClick={() => {
              setDraft(toDraft(setup, setup.kind));
              setOpen(true);
            }}
            className="inline-flex min-h-6 items-center text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
          >
            {live ? "Change the sessions" : "Change the hours"}
          </button>
          <button
            type="button"
            aria-busy={busy} disabled={busy}
            onClick={() => send({ id: product.id, remove: true }, live ? "It's no longer sold as live sessions." : "It's no longer sold as a call.")}
            className="inline-flex min-h-6 items-center text-ink-soft underline underline-offset-4 transition hover:text-danger"
          >
            {live ? "Stop selling it as live sessions" : "Stop selling it as a call"}
          </button>
        </div>
        {error ? <p className="notice notice-error mt-3" role="alert">{error}</p> : null}
      </div>
    );
  }

  const zoneList = zones();
  const zoneOptions = (zoneList.includes(draft.tz) ? zoneList : [draft.tz, ...zoneList]).map((z) => (
    <option key={z} value={z}>{z}</option>
  ));
  const saved = product.call !== null;

  if (draft.kind === "live") {
    return (
      <form
        className="mt-3 space-y-5 rounded-[var(--r-sm)] border border-line bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          send(
            {
              id: product.id,
              call: {
                kind: "live",
                tz: draft.tz,
                noticeHours: draft.noticeHours,
                sessions: draft.sessions.map((s) => ({
                  id: s.id,
                  date: s.date,
                  time: s.time,
                  minutes: s.minutes,
                  seats: Number(s.seats),
                  room: s.room.trim(),
                })),
              },
            },
            saved ? "Sessions saved." : "It's now sold as live sessions.",
          );
        }}
      >
        <div>
          <p className="font-semibold text-ink">Live sessions</p>
          <p className="mt-1 text-sm text-ink-soft">
            A webinar, workshop or class on dates you choose. Each buyer pays for one seat in one session.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Your time zone</span>
            <select className="field mt-2" value={draft.tz} onChange={(e) => setDraft({ ...draft, tz: e.target.value })}>
              {zoneOptions}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Sales close</span>
            <select className="field mt-2" value={draft.noticeHours} onChange={(e) => setDraft({ ...draft, noticeHours: Number(e.target.value) })}>
              {SESSION_NOTICE_CHOICES.map((h) => (
                <option key={h} value={h}>{h === 0 ? "When the session starts" : `${hoursLabel(h)} before`}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="min-w-0">
          <legend className="field-label">Sessions, in your time zone</legend>
          <ol className="mt-2 space-y-3">
            {draft.sessions.map((s, index) => (
              <li key={s.id} className="rounded-[10px] bg-paper p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{`Session ${index + 1}`}</span>
                  {draft.sessions.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove session ${index + 1}`}
                      onClick={() => setDraft({ ...draft, sessions: draft.sessions.filter((_, i) => i !== index) })}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-ink-mute transition hover:bg-white hover:text-danger"
                    >
                      &times;
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="text-xs font-semibold text-ink-soft">Date</span>
                    <input
                      type="date"
                      required
                      value={s.date}
                      onChange={(e) => setSession(index, { date: e.target.value })}
                      className="field mt-1 !min-h-0 !py-1.5"
                    />
                  </label>
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="text-xs font-semibold text-ink-soft">Starts</span>
                    <input
                      type="time"
                      step={300}
                      required
                      value={s.time}
                      onChange={(e) => setSession(index, { time: e.target.value })}
                      className="field mt-1 !min-h-0 !py-1.5"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-ink-soft">Length</span>
                    <select
                      value={s.minutes}
                      onChange={(e) => setSession(index, { minutes: Number(e.target.value) })}
                      className="field mt-1 !min-h-0 !py-1.5 !pl-3"
                    >
                      {SESSION_LENGTHS.map((m) => (
                        <option key={m} value={m}>{`${m} min`}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-ink-soft">Seats</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_SESSION_SEATS}
                      step={1}
                      required
                      value={s.seats}
                      onChange={(e) => setSession(index, { seats: e.target.value })}
                      className="field mt-1 !min-h-0 !py-1.5"
                    />
                  </label>
                  <label className="col-span-2 block sm:col-span-4">
                    <span className="text-xs font-semibold text-ink-soft">Meeting link</span>
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="https://zoom.us/j/… or https://meet.google.com/…"
                      value={s.room}
                      onChange={(e) => setSession(index, { room: e.target.value })}
                      className="field mt-1 !min-h-0 !py-1.5"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ol>
          {draft.sessions.length < MAX_SESSIONS ? (
            <button
              type="button"
              onClick={() => setDraft({ ...draft, sessions: [...draft.sessions, newSession(draft.tz, draft.sessions[draft.sessions.length - 1])] })}
              className="mt-3 inline-flex min-h-6 items-center text-sm font-semibold text-violet-deep underline underline-offset-4"
            >
              Add a session
            </button>
          ) : null}
        </fieldset>

        <p className="rounded-[10px] bg-paper px-3 py-2 text-sm text-ink-soft">
          {`A session is on sale until it is full or sales close. Each buyer gets the session's link and a calendar file the moment they have paid, then a reminder a day and an hour before; you get one email per booking and a reminder listing everyone. Buyers can move their seat to another session themselves, twice at most, until ${hoursLabel(Math.max(draft.noticeHours, 1))} before it starts. Replies to their emails go to ${email}.`}
        </p>

        {error ? <p className="notice notice-error" role="alert">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary">
            {busy ? "Saving…" : saved ? "Save the sessions" : "Sell seats in these sessions"}
          </button>
          <button type="button" onClick={() => { setOpen(false); setError(null); }} className="btn btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="mt-3 space-y-5 rounded-[var(--r-sm)] border border-line bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        send(
          {
            id: product.id,
            call: {
              kind: "weekly",
              minutes: draft.minutes,
              tz: draft.tz,
              weekly: draft.weekly,
              noticeHours: draft.noticeHours,
              horizonDays: draft.horizonDays,
              bufferMinutes: draft.bufferMinutes,
              room: draft.room.trim(),
              seats: Number(draft.seats),
            },
          },
          saved ? "Hours saved." : "It's now sold as a paid call.",
        );
      }}
    >
      <p className="font-semibold text-ink">Paid call</p>

      <div className="grid gap-4 sm:grid-cols-3">
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
          <span className="field-label">People per time</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SEATS}
            step={1}
            required
            value={draft.seats}
            onChange={(e) => setDraft({ ...draft, seats: e.target.value })}
            aria-describedby={`seats-hint-${product.id}`}
            className="field mt-2"
          />
        </label>
        <label className="block">
          <span className="field-label">Your time zone</span>
          <select className="field mt-2" value={draft.tz} onChange={(e) => setDraft({ ...draft, tz: e.target.value })}>
            {zoneOptions}
          </select>
        </label>
        <p id={`seats-hint-${product.id}`} className="field-hint sm:col-span-3">
          {`1 is a one-to-one call. Up to ${MAX_SEATS} makes it a group call: each time stays open until every seat is taken, and each person pays for their own seat.`}
        </p>
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
                    {/*
                      Each pair of clocks wraps on a narrow phone: two time
                      fields, the word between them and the row's own padding
                      do not fit across 320px, and a clock the creator cannot
                      reach is worse than one that takes a second line.
                    */}
                    {ranges.map((range, index) => (
                      <span key={index} className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
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
              <option key={h} value={h}>{hoursLabel(h)}</option>
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
        {`When someone books, you both get an email with a calendar file, then a reminder a day and an hour before. Buyers can move their booking to another open time themselves, twice at most, up to your notice before it starts. A buyer can reply to their email to reach you, and the reply goes to ${email}.`}
      </p>

      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : saved ? "Save the hours" : "Sell it as a call"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
