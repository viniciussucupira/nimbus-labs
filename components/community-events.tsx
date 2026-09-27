import Link from "next/link";
import type { Store } from "@/lib/store";
import {
  type CommunityEvent,
  eventTime,
  eventWhenWords,
  isOver,
  joinWindow,
  lengthWords,
} from "@/lib/community-events";

/**
 * The pieces the community's events pages are made of: the date on its
 * little calendar leaf, and one event in a list. What the creator wrote
 * reaches the page as text through React, which escapes it.
 */

/** The month and the day, on a leaf, in the event's own time zone. */
export function DateLeaf({ event, size = "md" }: { event: Pick<CommunityEvent, "start" | "tz" | "cancelled">; size?: "md" | "lg" }) {
  const month = new Intl.DateTimeFormat("en-US", { timeZone: event.tz, month: "short" }).format(new Date(event.start));
  const day = new Intl.DateTimeFormat("en-US", { timeZone: event.tz, day: "numeric" }).format(new Date(event.start));
  return (
    <span aria-hidden="true" className={`ev-leaf ${size === "lg" ? "ev-leaf-lg" : ""} ${event.cancelled ? "ev-leaf-off" : ""}`}>
      <span className="ev-leaf-month">{month}</span>
      <span className="ev-leaf-day">{day}</span>
    </span>
  );
}

/** How many are coming, and how many places are left, in a few words. */
export function placesWords(event: CommunityEvent, going: number): string {
  const people = `${going} going`;
  if (!event.cap) return people;
  const left = Math.max(0, event.cap - going);
  return left === 0 ? `${people} · full` : `${people} · ${left} of ${event.cap} ${event.cap === 1 ? "place" : "places"} left`;
}

/** One event in a list: its date, title, time, and what the reader's part in it is. */
export function EventCard({
  store,
  event,
  going,
  mine,
  locked,
  now,
}: {
  store: Store;
  event: CommunityEvent;
  going: number;
  mine: boolean;
  /** Kept for the buyers of products this reader does not have. */
  locked: boolean;
  /** When the page is drawn (eventClock). */
  now: number;
}) {
  const href = `/@${store.handle}/community/events/${event.id}`;
  const over = isOver(event, now);
  const live = !event.cancelled && !over && event.start <= now;
  const open = joinWindow(event, now).open;
  const labelId = `event-${event.id}`;
  return (
    <article aria-labelledby={labelId} className={`st-card ev-card p-4 sm:p-5 ${event.cancelled ? "cm-hidden" : ""}`}>
      <div className="flex items-start gap-4">
        <DateLeaf event={event} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap gap-1.5">
            {event.cancelled ? <span className="cm-badge cm-badge-warn">Cancelled</span> : null}
            {live ? <span className="cm-badge cm-badge-creator ev-live">On now</span> : null}
            {!live && open ? <span className="cm-badge cm-badge-accent">Doors open</span> : null}
            {mine && !over && !event.cancelled ? <span className="cm-badge cm-badge-accent">You are going</span> : null}
            {locked ? <span className="cm-badge">For some members</span> : null}
            {over && event.replay ? <span className="cm-badge cm-badge-accent">Replay</span> : null}
          </p>
          <h3 id={labelId} className="font-display mt-1.5 break-words text-lg font-semibold leading-snug tracking-[-0.01em]">
            <Link href={href} className="st-title-link">{event.title}</Link>
          </h3>
          <p className="st-muted mt-1 text-sm">{`${eventTime(event)} · ${lengthWords(event.minutes)}`}</p>
          {!event.cancelled ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
              <span>{eventWhenWords(event, now)}</span>
              <span className="st-muted">{over ? `${going} RSVP'd` : placesWords(event, going)}</span>
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
