import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { communityViewer } from "@/lib/community-access";
import { type CommunityEvent, eventClock, mayAttend, pastEvents, rsvpNumbers, upcomingEvents } from "@/lib/community-events";
import { CommunityBar, NOTICES } from "@/components/community-parts";
import { EventCard } from "@/components/community-events";

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Events — Marktmorgen",
  robots: { index: false, follow: false },
};

/** Past events on one page. */
const PAST_PAGE = 12;

/** The community's live events: what is coming up, soonest first, then what is over, with replays. */
export default async function CommunityEventsPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityViewer(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  // Not in (any more): the community's own door says why, and how to come in.
  if (viewer.state !== "in") redirect(home);
  const id = store.community.id;
  const query = await searchParams;
  const notice = NOTICES[typeof query.n === "string" ? query.n : ""] ?? null;
  const beforeRaw = typeof query.before === "string" ? Number(query.before) : NaN;
  const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? beforeRaw : null;
  const now = eventClock();

  const [upcoming, past] = await Promise.all([before ? Promise.resolve([] as CommunityEvent[]) : upcomingEvents(id, now), pastEvents(id, before, PAST_PAGE, now)]);
  const all = [...upcoming, ...past.events];
  const [numbers, allowed] = await Promise.all([
    rsvpNumbers(id, all, viewer.owner ? null : viewer.key),
    // Asked once for each set of products events are kept for, not once per event.
    (async () => {
      const bySet = new Map<string, Promise<boolean>>();
      return Promise.all(
        all.map((e) => {
          const set = [...e.only].sort().join(",");
          if (!bySet.has(set)) bySet.set(set, mayAttend(store, viewer.config, e, { owner: viewer.owner, email: viewer.email }));
          return bySet.get(set) as Promise<boolean>;
        }),
      );
    })(),
  ]);
  const locked = new Set(all.filter((_, i) => !allowed[i]).map((e) => e.id));
  const card = (event: CommunityEvent) => (
    <li key={event.id}>
      <EventCard
        store={store}
        event={event}
        going={numbers.get(event.id)?.going ?? 0}
        mine={numbers.get(event.id)?.mine ?? false}
        locked={locked.has(event.id)}
        now={now}
      />
    </li>
  );

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <CommunityBar store={store} config={viewer.config} tab="events" signedIn />
      <main id="content" className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{before ? "Past events" : "Events"}</h1>
          {viewer.owner ? (
            <Link href={store.sid ? `/studio/community?store=${store.sid}#events` : "/studio/community#events"} className="cm-pill">Schedule in the studio</Link>
          ) : null}
        </div>
        {notice ? <p className={`cm-flash mt-4 ${notice.tone === "warn" ? "cm-flash-warn" : ""}`} role="status">{notice.text}</p> : null}

        {!before ? (
          <section aria-labelledby="ev-coming" className="mt-6">
            <h2 id="ev-coming" className="st-label text-xs uppercase tracking-[0.08em]">Coming up</h2>
            {upcoming.length ? (
              <ul className="mt-3 space-y-3">{upcoming.map(card)}</ul>
            ) : (
              <div className="st-note mt-3 text-center">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>Nothing scheduled yet</p>
                <p className="mt-1 text-sm">
                  {viewer.owner
                    ? "Schedule a live event in the studio: members RSVP here, get reminder emails if they asked for them, and join from this page."
                    : `When ${store.name} schedules a live event, it shows up here.`}
                </p>
              </div>
            )}
          </section>
        ) : null}

        {past.events.length || before ? (
          <section aria-labelledby="ev-past" className="mt-10">
            <h2 id="ev-past" className="st-label text-xs uppercase tracking-[0.08em]">{before ? "Older" : "Past events"}</h2>
            {past.events.length ? <ul className="mt-3 space-y-3">{past.events.map(card)}</ul> : <p className="st-muted mt-3 text-sm">That is everything.</p>}
            {past.next ? (
              <p className="mt-6 text-center">
                <Link href={`${home}/events?before=${past.next}`} className="cm-pill cm-pill-wide">Older events</Link>
              </p>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
