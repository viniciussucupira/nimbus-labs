/**
 * A paid call: what the creator offers, when, and the arithmetic of time.
 *
 * Nothing here touches the network, so the studio can use the same rules in
 * the browser that the server enforces, and the booking page can show exactly
 * the times the server will accept.
 *
 * Time is the hard part, and it is done without a library. The creator's
 * week is written in their own time zone — "Mondays from 9 to 12" — and every
 * slot is turned into one exact instant, in UTC, using the time zone database
 * the platform already carries (Intl). Daylight saving is handled by asking
 * that database, twice, what the offset is at the instant being built, which
 * is the standard way to do it and the only one that survives the two days a
 * year the clocks move.
 */

/** Call lengths a creator may pick, in minutes. */
export const CALL_LENGTHS = [15, 20, 30, 45, 60, 90, 120] as const;

/** Gaps a creator may leave between two calls, in minutes. */
export const BUFFERS = [0, 5, 10, 15, 30, 60] as const;

/** How soon a call may be booked: never closer than this many hours. */
export const NOTICE_CHOICES = [1, 2, 4, 12, 24, 48, 72] as const;

/** How far ahead a call may be booked, in days. */
export const HORIZON_CHOICES = [7, 14, 21, 30, 60, 90] as const;

/** Up to two stretches of time on any one day, e.g. a morning and an evening. */
export const MAX_RANGES_PER_DAY = 2;

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Minutes from midnight, [start, end). */
export type Range = [number, number];

export type CallSetup = {
  /** How long one call lasts. */
  minutes: number;
  /** The creator's time zone, as the time zone database names it. */
  tz: string;
  /** Seven entries, Sunday first; each holds up to two ranges. */
  weekly: Range[][];
  noticeHours: number;
  horizonDays: number;
  bufferMinutes: number;
  /** Where the call happens: a meeting link the creator already has. */
  room: string | null;
};

export const MAX_ROOM_LENGTH = 500;

/** Whether the platform knows this time zone. */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A meeting link that is safe to hand a buyer: https, and nothing that runs. */
export function cleanRoom(raw: unknown): string | null | "bad" {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const text = raw.trim().slice(0, MAX_ROOM_LENGTH);
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return "bad";
    if (!url.hostname.includes(".")) return "bad";
    return url.toString();
  } catch {
    return "bad";
  }
}

export type SetupProblem = "minutes" | "tz" | "weekly" | "notice" | "horizon" | "buffer" | "room";

/** Reads a setup sent from the studio, or says which part is wrong. */
export function readSetup(raw: unknown): CallSetup | SetupProblem {
  if (!raw || typeof raw !== "object") return "minutes";
  const value = raw as Record<string, unknown>;

  const minutes = Number(value.minutes);
  if (!(CALL_LENGTHS as readonly number[]).includes(minutes)) return "minutes";
  if (!isTimeZone(value.tz)) return "tz";
  const noticeHours = Number(value.noticeHours);
  if (!(NOTICE_CHOICES as readonly number[]).includes(noticeHours)) return "notice";
  const horizonDays = Number(value.horizonDays);
  if (!(HORIZON_CHOICES as readonly number[]).includes(horizonDays)) return "horizon";
  const bufferMinutes = Number(value.bufferMinutes ?? 0);
  if (!(BUFFERS as readonly number[]).includes(bufferMinutes)) return "buffer";

  if (!Array.isArray(value.weekly) || value.weekly.length !== 7) return "weekly";
  const weekly: Range[][] = [];
  let any = false;
  for (const day of value.weekly) {
    if (!Array.isArray(day) || day.length > MAX_RANGES_PER_DAY) return "weekly";
    const ranges: Range[] = [];
    for (const range of day) {
      if (!Array.isArray(range) || range.length !== 2) return "weekly";
      const [start, end] = range.map(Number);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return "weekly";
      if (start < 0 || end > 24 * 60 || start % 5 !== 0 || end % 5 !== 0) return "weekly";
      // A stretch has to hold at least one call.
      if (end - start < minutes) return "weekly";
      ranges.push([start, end]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    if (ranges.length === 2 && ranges[1][0] < ranges[0][1]) return "weekly";
    if (ranges.length) any = true;
    weekly.push(ranges);
  }
  if (!any) return "weekly";

  const room = cleanRoom(value.room);
  if (room === "bad") return "room";

  return { minutes, tz: value.tz as string, weekly, noticeHours, horizonDays, bufferMinutes, room };
}

/** Whatever came back from storage, made safe to use, or null. */
export function parseSetup(raw: unknown): CallSetup | null {
  const read = readSetup(raw);
  return typeof read === "string" ? null : read;
}

/** The parts of a date as a clock in `tz` shows them at instant `ms`. */
export function partsIn(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday,
  };
}

/** How far `tz` is ahead of UTC at instant `ms`, in minutes. */
function offsetAt(ms: number, tz: string): number {
  const p = partsIn(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/**
 * The instant at which a clock in `tz` shows this date and time.
 *
 * Returns null for a wall-clock time that does not exist there — the hour
 * skipped when the clocks go forward — so no slot is ever offered at a time
 * nobody's clock will show.
 */
export function zonedToUtc(year: number, month: number, day: number, minuteOfDay: number, tz: string): number | null {
  const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let guess = naive - offsetAt(naive, tz) * 60000;
  guess = naive - offsetAt(guess, tz) * 60000;
  const check = partsIn(guess, tz);
  const wanted = new Date(naive);
  if (
    check.year !== wanted.getUTCFullYear() ||
    check.month !== wanted.getUTCMonth() + 1 ||
    check.day !== wanted.getUTCDate() ||
    check.hour * 60 + check.minute !== wanted.getUTCHours() * 60 + wanted.getUTCMinutes()
  ) {
    return null;
  }
  return guess;
}

export type Busy = { start: number; end: number };

export type Day = {
  /** The date on the creator's calendar, YYYY-MM-DD. */
  date: string;
  /** Start instants, in milliseconds since the epoch. */
  starts: number[];
};

/**
 * Every slot a buyer may book right now, grouped by the creator's day.
 *
 * A slot is offered when it starts after the notice period, begins within
 * the horizon, fits inside one of the creator's stretches for that weekday,
 * and does not come within the buffer of anything already booked or held.
 */
export function openSlots(setup: CallSetup, now: number, busy: Busy[]): Day[] {
  const earliest = now + setup.noticeHours * 3600_000;
  const latest = now + setup.horizonDays * 86400_000;
  const length = setup.minutes * 60_000;
  const gap = setup.bufferMinutes * 60_000;
  const days: Day[] = [];

  const first = partsIn(now, setup.tz);
  // Walk the creator's calendar one day at a time, from today.
  for (let offset = 0; offset <= setup.horizonDays + 1; offset += 1) {
    const cursor = new Date(Date.UTC(first.year, first.month - 1, first.day + offset));
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const weekday = cursor.getUTCDay();
    const starts: number[] = [];
    for (const [from, to] of setup.weekly[weekday] ?? []) {
      for (let t = from; t + setup.minutes <= to; t += setup.minutes + setup.bufferMinutes) {
        const start = zonedToUtc(y, m, d, t, setup.tz);
        if (start === null) continue;
        if (start < earliest || start > latest) continue;
        const end = start + length;
        const clash = busy.some((b) => start < b.end + gap && end + gap > b.start);
        if (!clash) starts.push(start);
      }
    }
    if (starts.length) {
      days.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, starts });
    }
  }
  return days;
}

/** Whether one exact instant is a slot a buyer may book right now. */
export function isOpenSlot(setup: CallSetup, now: number, busy: Busy[], start: number): boolean {
  return openSlots(setup, now, busy).some((day) => day.starts.includes(start));
}

/** A time as a person reads it, in a given zone: "Tuesday, October 6, 9:30 AM". */
export function readableTime(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/** The zone's short name at that instant, e.g. "EDT" or "GMT+1". */
export function zoneName(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** "9:00" style, from minutes past midnight. For the studio's fields. */
export function clock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes past midnight from "09:30". */
export function fromClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

/** A sensible first week for a creator who has not set one: weekdays, 9 to 5. */
export function defaultWeekly(): Range[][] {
  return [[], [[540, 1020]], [[540, 1020]], [[540, 1020]], [[540, 1020]], [[540, 1020]], []];
}
