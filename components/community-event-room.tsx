"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/**
 * The parts of a live event's page that need the browser: the time in the
 * reader's own zone, a page that opens its door by itself when the moment
 * comes, and the video room shown inside the page.
 *
 * The room's address reaches this file only when the server decided this
 * reader may have it now (lib/community-events.ts, wayInFor); nothing here
 * decides who gets in.
 */

const noop = () => () => {};

/** "Your time: Tue, Oct 6, 3:00 PM", when the reader's zone is not the event's. Nothing before the page runs. */
export function LocalTime({
  ms,
  tz,
  locale = "en-US",
  template = "Your time: {time}",
}: {
  ms: number;
  tz: string;
  /** How the store's language writes a date (lib/store-language.ts). */
  locale?: string;
  /** "Your time: {time}", in the store's language. */
  template?: string;
}) {
  const words = useSyncExternalStore(
    noop,
    () => {
      try {
        const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!own || own === tz) return "";
        const text = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(ms));
        return template.replace("{time}", text);
      } catch {
        return "";
      }
    },
    () => "",
  );
  return words ? <span className="st-muted block text-sm">{words}</span> : null;
}

/**
 * Reloads what the page shows when the door opens and when the event ends,
 * if the page is open then: nobody has to know to press reload at the start.
 * Only moments within the next twelve hours are waited for.
 */
export function DoorTimer({ at }: { at: number[] }) {
  const router = useRouter();
  useEffect(() => {
    const now = Date.now();
    const timers = at
      .filter((t) => t > now && t - now < 12 * 3_600_000)
      .map((t) => window.setTimeout(() => router.refresh(), t - now + 1_500));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [at, router]);
  return null;
}

/**
 * The private video room, inside the page when asked for, with a way to open
 * it in a tab of its own instead. Nothing is loaded from Jitsi until the
 * reader presses Join: the page alone never turns a camera on.
 */
const ENGLISH_ROOM = { leave: "Leave the room here", join: "Join here", newTab: "Open in a new tab", title: "" };

export function RoomEmbed({
  room,
  title,
  name,
  note,
  words = ENGLISH_ROOM,
}: {
  room: string;
  title: string;
  name: string;
  note: string;
  /** In the store's language; `title` is the frame's whole label. */
  words?: { leave: string; join: string; newTab: string; title: string };
}) {
  const [joined, setJoined] = useState(false);
  // The name goes in the part of the address after "#", which the browser
  // keeps to itself: Jitsi's page reads it, its server never sees it.
  const src = name ? `${room}#userInfo.displayName=${encodeURIComponent(JSON.stringify(name))}` : room;
  return (
    <div>
      {joined ? (
        <div className="ev-room">
          <iframe
            src={src}
            title={words.title || `${title}: the video room`}
            allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {joined ? (
          <button type="button" className="cm-pill" onClick={() => setJoined(false)}>
            {words.leave}
          </button>
        ) : (
          <button type="button" className="btn st-btn" onClick={() => setJoined(true)}>
            {words.join}
          </button>
        )}
        <a href={room} target="_blank" rel="noopener noreferrer" className={joined ? "cm-pill" : "cm-pill cm-pill-wide"}>
          {words.newTab}
        </a>
      </div>
      <p className="st-muted mt-3 text-sm">{note}</p>
    </div>
  );
}
