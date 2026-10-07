import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { readListings } from "@/lib/catalog";
import { communityVisitor } from "@/lib/community-page";
import { ITEM_ID } from "@/lib/community-text";
import { VIDEO_ROOM_NOTE, isVideoRoom, roomKind } from "@/lib/call-rooms";
import { MEET_NAMES } from "@/lib/call-setup";
import { eventMeetings } from "@/lib/event-meetings";
import {
  eventClock,
  eventTime,
  eventWhenWords,
  isOver,
  joinWindow,
  lengthWords,
  mayAttend,
  readEvent,
  rsvpNumbers,
  wayInFor,
} from "@/lib/community-events";
import { Carry, CommunityBar, NOTICES, PostText, ticketKind } from "@/components/community-parts";
import { DateLeaf, placesWords } from "@/components/community-events";
import { DoorTimer, LocalTime, RoomEmbed } from "@/components/community-event-room";
import { VideoEmbed } from "@/components/video-embed";

type Params = {
  params: Promise<{ handle: string; event: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Live event — Marktmorgen",
  robots: { index: false, follow: false },
};

function clockAt(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(ms));
}

/**
 * One live event: when, what, who is coming, a place to take, the calendar
 * file, and — from fifteen minutes before until the end, to whoever may
 * come — the way in, with the video room inside the page. Afterwards, the
 * replay. Every part of it is asked again on every visit
 * (lib/community-events.ts). This is the one page whose policy lets it frame
 * the room (lib/csp.ts). An event on Google Meet or Zoom opens in their own
 * tab (lib/event-meetings.ts): nothing of theirs is framed or loaded here.
 */
export default async function CommunityEventPage({ params, searchParams }: Params) {
  const { handle: raw, event: eventId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@") || !ITEM_ID.test(eventId)) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityVisitor(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  if (viewer.state !== "in") redirect(home);
  const id = store.community.id;
  const event = await readEvent(id, eventId);
  if (!event) notFound();
  const query = await searchParams;
  const notice = NOTICES[typeof query.n === "string" ? query.n : ""] ?? null;
  const now = eventClock();

  const [allowed, numbers, meetings] = await Promise.all([
    mayAttend(store, viewer.config, event, { owner: viewer.owner, email: viewer.email }),
    rsvpNumbers(id, [event], viewer.owner ? null : viewer.key),
    // A Google Meet or Zoom event: the link its record says was given — the
    // meeting's own, or the private room when it could not be made.
    event.where === "meet" ? eventMeetings(store, [event]).catch(() => null) : null,
  ]);
  const meeting = meetings?.get(event.id) ?? null;
  const going = numbers.get(event.id)?.going ?? 0;
  const mine = numbers.get(event.id)?.mine ?? false;
  const over = isOver(event, now);
  const door = joinWindow(event, now);
  const way = wayInFor(event, { owner: viewer.owner, mayAttend: allowed, going: mine }, now, meeting?.link || null);
  const place = event.where === "meet" && event.meet && meeting?.made && !meeting.gone ? event.meet : null;
  const whereWords = place ? MEET_NAMES[place] : event.where === "link" ? "Online meeting" : "Private video room";
  const openWords = roomKind(way) === "meet" ? "Join on Google Meet" : roomKind(way) === "zoom" ? "Join on Zoom" : "Open the meeting";
  // The host's own way into a Zoom meeting: a fresh start link asked of Zoom on the click, never kept (app/api/integrations/zoom/host).
  const hostLink =
    viewer.owner && place === "zoom" && meeting && roomKind(way) === "zoom"
      ? `/api/integrations/zoom/host?${new URLSearchParams({ scope: meeting.scope, ...(store.sid ? { store: store.sid } : {}) })}`
      : null;
  const full = event.cap > 0 && going >= event.cap;
  const room = way && isVideoRoom(way) ? way : null;
  const doorsOpenAt = clockAt(door.opensAt, event.tz);
  const forProducts = allowed ? [] : (await readListings(store, event.only.filter((p) => viewer.config.access.includes(p)))).map((p) => ({ id: p.id, title: p.title, kind: ticketKind(p, store.currency) }));
  const labelId = "event-title";

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <CommunityBar store={store} config={viewer.config} tab="events" signedIn />
      {!over && !event.cancelled ? <DoorTimer at={[door.opensAt, door.closesAt]} /> : null}
      <main id="content" className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <p>
          <Link href={`${home}/events`} className="cm-quiet-link text-sm font-semibold underline underline-offset-4">All events</Link>
        </p>
        {notice ? <p className={`cm-flash mt-4 ${notice.tone === "warn" ? "cm-flash-warn" : ""}`} role="status">{notice.text}</p> : null}

        <article aria-labelledby={labelId} className={`st-card mt-4 p-5 sm:p-7 ${event.cancelled ? "cm-hidden" : ""}`}>
          <div className="flex items-start gap-4">
            <DateLeaf event={event} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap gap-1.5">
                <span className={`cm-badge ${!event.cancelled && !over && event.start <= now ? "cm-badge-creator ev-live" : event.cancelled ? "cm-badge-warn" : "cm-badge-accent"}`}>
                  {eventWhenWords(event, now)}
                </span>
                {mine && !over && !event.cancelled ? <span className="cm-badge cm-badge-accent">You are going</span> : null}
              </p>
              <h1 id={labelId} className="font-display mt-2 break-words text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">{event.title}</h1>
              <p className="mt-2 font-semibold">
                <time dateTime={new Date(event.start).toISOString()}>{eventTime(event)}</time>
                <span className="st-muted font-normal">{` · ${lengthWords(event.minutes)}`}</span>
              </p>
              <LocalTime ms={event.start} tz={event.tz} />
              <p className="st-muted mt-1 text-sm">
                {`${whereWords} · hosted by ${store.name}${event.cancelled ? "" : over ? ` · ${going} RSVP'd` : ` · ${placesWords(event, going)}`}`}
              </p>
            </div>
          </div>

          {!allowed ? (
            <div className="st-note mt-6" role="status">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>This event is for members who have</p>
              {forProducts.length ? (
                <ul className="mt-2 space-y-2">
                  {forProducts.map((p) => (
                    <li key={p.id}>
                      <Link href={`/@${store.handle}/p/${p.id}`} className="cm-row">
                        <span className="min-w-0 break-words font-semibold">{p.title}</span>
                        <span className="st-muted shrink-0 text-sm">{p.kind}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm">{`A product ${store.name} no longer offers here.`}</p>
              )}
              <p className="mt-3 text-sm">{`If you bought one with another address, sign out on your You page and come back in with that one.`}</p>
            </div>
          ) : event.cancelled ? (
            <p className="cm-flash cm-flash-warn mt-6">{`${store.name} canceled this event, and everyone who had RSVP'd was emailed. There is nothing for you to do.`}</p>
          ) : !over ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {viewer.owner ? (
                <span className="cm-pill cm-pill-still">{`You host · ${going} going`}</span>
              ) : mine ? (
                <>
                  <span className="cm-pill cm-pill-on" role="status">You are going</span>
                  <form action="/api/store/community/rsvp" method="post">
                    <Carry store={store} action="notgoing" from="feed" />
                    <input type="hidden" name="event" value={event.id} />
                    <button type="submit" className="cm-pill">Cancel my RSVP</button>
                  </form>
                </>
              ) : full ? (
                <span className="cm-pill cm-pill-still">Every place is taken</span>
              ) : (
                <form action="/api/store/community/rsvp" method="post">
                  <Carry store={store} action="going" from="feed" />
                  <input type="hidden" name="event" value={event.id} />
                  <button type="submit" className="btn st-btn">{event.cap ? "RSVP and take a place" : "RSVP"}</button>
                </form>
              )}
              <a href={`/api/store/community/calendar?h=${encodeURIComponent(store.handle)}&e=${event.id}`} className="cm-pill">Add to calendar (.ics)</a>
            </div>
          ) : null}

          {allowed && !event.cancelled && !over ? (
            <section aria-labelledby="ev-join" className="ev-join mt-6">
              <h2 id="ev-join" className="text-base font-bold">Join</h2>
              {way ? (
                <>
                  {viewer.owner && !door.open ? (
                    <p className="st-muted mt-1 text-sm">{`Only you see this now. Members see the way in from ${doorsOpenAt}. Open the room a few minutes early.`}</p>
                  ) : (
                    <p className="st-muted mt-1 text-sm">{event.start <= now ? "It is on now." : `The doors are open. It starts at ${clockAt(event.start, event.tz)}.`}</p>
                  )}
                  {room ? (
                    <div className="mt-4">
                      <RoomEmbed room={room} title={event.title} name={viewer.owner ? store.name : viewer.member?.n ?? ""} note={VIDEO_ROOM_NOTE} />
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {hostLink ? (
                          <a href={hostLink} target="_blank" rel="noopener noreferrer" className="btn st-btn">Start in Zoom as the host</a>
                        ) : null}
                        <a href={way} target="_blank" rel="noopener noreferrer" className={hostLink ? "cm-pill" : "btn st-btn"}>{openWords}</a>
                        <span className="st-muted min-w-0 break-all text-sm">{way}</span>
                      </div>
                      {place && !viewer.owner ? (
                        <p className="st-muted mt-2 text-sm">
                          {place === "google" ? `Google Meet may ask you to wait until ${store.name} lets you in.` : `Zoom lets you in once ${store.name} starts the meeting; if they use a waiting room, they admit you from there.`}
                        </p>
                      ) : null}
                    </>
                  )}
                </>
              ) : door.open && event.cap > 0 && !mine ? (
                <p className="st-muted mt-1 text-sm">Places are limited: the way in shows to those who RSVP&apos;d.</p>
              ) : (
                <p className="st-muted mt-1 text-sm">
                  {`The way in shows here from ${doorsOpenAt}, 15 minutes before the start, to ${event.cap ? "everyone with a place" : "every member who can come"}. Keep this page open and it appears by itself.`}
                </p>
              )}
            </section>
          ) : null}

          {event.about ? <PostText text={event.about} className="mt-6" /> : null}

          {over && !event.cancelled ? (
            <section aria-labelledby="ev-replay" className="mt-6">
              <h2 id="ev-replay" className="text-base font-bold">Replay</h2>
              {event.replay && allowed ? (
                <div className="mt-3">
                  <VideoEmbed video={event.replay} title={event.title} poster={null} />
                </div>
              ) : (
                <p className="st-muted mt-1 text-sm">{allowed ? `This event has ended. ${store.name} has not posted a replay yet.` : "The replay is for the members this event was for."}</p>
              )}
            </section>
          ) : null}
        </article>
      </main>
    </div>
  );
}
