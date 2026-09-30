import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { postNumbers, readMembers, readPosts } from "@/lib/community";
import { mayMessage, pairOf, requestCount } from "@/lib/community-dm";
import { unreadCount } from "@/lib/community-notify";
import { communityViewer, visibleSpaces } from "@/lib/community-access";
import { type SearchKind, MAX_QUERY_LENGTH, queryWords, search, searchEverything } from "@/lib/community-search";
import { walkCommunity } from "@/lib/community-walk";
import { eventsFound, lessonsFound, membersFound } from "@/lib/community-found";
import { readableTime } from "@/lib/call-setup";
import { pollViews } from "@/lib/community-polls";
import { CommunityBar, Face, NOTICES, PostCard } from "@/components/community-parts";
import { ConfirmDeletes } from "@/components/community-composer";

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Search — Nimbus Labs",
  robots: { index: false, follow: false },
};

const TABS: { kind: SearchKind; label: string; one: string; many: string }[] = [
  { kind: "post", label: "Posts", one: "post", many: "posts" },
  { kind: "lesson", label: "Lessons", one: "lesson", many: "lessons" },
  { kind: "event", label: "Events", one: "event", many: "events" },
  { kind: "member", label: "People", one: "person", many: "people" },
];

const isKind = (value: unknown): value is SearchKind =>
  value === "post" || value === "lesson" || value === "event" || value === "member";

/**
 * What has been said, taught, planned and joined here.
 *
 * Four things are searched from the one box: the posts and the comments under
 * them, the lessons of the courses this store sells, the events on its
 * calendar, and the people who chose to be listed. Measured against the field
 * on 30 September 2026 rather than guessed at — Skool searches posts, comments,
 * course content and members; Circle adds events and messages; Mighty Networks
 * searches posts, comments, coursework, members and events; Whop documents
 * search of its marketplace and its messages alone; Stan documents no search at
 * all. A community that could only find posts was behind three of them.
 *
 * Every result is asked about at the same door its own page uses. A space kept
 * for the buyers of one product is absent from these results for everybody
 * else, and so are its posts. A lesson is shown only to somebody who holds the
 * product its course is sold with — a lesson's title is content, and a course
 * that can be read down the side of a search box has been given away. An event
 * goes through the very gate its page goes through. A member appears only if
 * they asked to be listed.
 */
export default async function CommunitySearchPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityViewer(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  if (viewer.state !== "in") redirect(home);

  const id = store.community.id;
  const query = await searchParams;
  const asked = (typeof query.q === "string" ? query.q : "").slice(0, MAX_QUERY_LENGTH);
  const notice = NOTICES[typeof query.n === "string" ? query.n : ""] ?? null;
  const beforeRaw = typeof query.before === "string" ? Number(query.before) : NaN;
  const before = Number.isInteger(beforeRaw) && beforeRaw > 0 ? beforeRaw : null;
  const chosen: SearchKind | null = isKind(query.k) ? query.k : null;
  const { config, owner, key, canWrite, email } = viewer;

  const wanted = queryWords(asked);

  // Everything written before the index reached past posts is put into it once,
  // here, the first time anybody searches. It happens before the search rather
  // than after it, because a first search that answers "nothing" about a course
  // full of answers is worse than a first search that takes a moment.
  if (wanted.length) await walkCommunity(store).catch(() => {});

  // All four at once, so the tabs can carry real numbers rather than making
  // somebody press each one to find out whether it holds anything. Each comes
  // back with its own first page, so the tab being read needs nothing more —
  // unless it is being paged, which is one search for that one kind.
  const pages = wanted.length ? await searchEverything(id, asked) : null;
  // Nobody pressed a tab yet, so open the first one holding anything. Landing
  // on an empty Posts tab with four lessons sitting one press away reads as
  // "nothing found", and the member has to notice a small number to learn
  // otherwise. Posts when everything is empty, so the page is never tabless.
  const tab: SearchKind =
    chosen ?? (pages ? (TABS.find((t) => pages[t.kind].total > 0)?.kind ?? "post") : "post");
  const first = pages?.[tab] ?? { posts: [], next: null, used: [], total: 0 };
  const page = before !== null && pages ? await search(id, asked, before, tab) : first;
  const used = pages?.post.used ?? [];

  const spaces = await visibleSpaces(store, config, { owner, email });
  const mineIds = new Set(spaces.map((s) => s.id));
  // A space this viewer is gated out of hides its posts here too. A post in a
  // space that no longer exists is not gated, and stays findable.
  const shut = new Set(config.spaces.filter((s) => s.only.length && !mineIds.has(s.id)).map((s) => s.id));

  // Only the tab being read is opened: the other three are counted, not built.
  const gate = { owner, email, key };
  const posts =
    tab === "post" && page.posts.length
      ? (await readPosts(id, page.posts)).filter((p) => (owner || !p.hid) && !shut.has(p.sp))
      : [];
  const lessons = tab === "lesson" ? await lessonsFound(store, config, page.posts, gate) : [];
  const events = tab === "event" ? await eventsFound(store, config, page.posts, gate) : [];
  const people = tab === "member" ? await membersFound(id, page.posts) : [];

  const [members, numbers, polls] = await Promise.all([
    readMembers(id, posts.map((p) => p.a)),
    postNumbers(id, posts, key),
    pollViews(id, posts, key, owner),
  ]);
  // The words that were actually looked for: "the" and "to" narrow nothing
  // down and are dropped, and saying so beats letting somebody wonder why
  // their phrase behaved oddly.
  const dropped = wanted.length !== used.length || (asked.trim() !== "" && wanted.length === 0);
  // The badge on the Messages link: nothing to read, nothing shown.
  const waiting = config.dm.on ? await requestCount(id, key) : 0;
  const news = await unreadCount(id, key);

  const shown = tab === "post" ? posts.length : tab === "lesson" ? lessons.length : tab === "event" ? events.length : people.length;
  const here = TABS.find((t) => t.kind === tab)!;
  const link = (kind: SearchKind) => `${home}/search?q=${encodeURIComponent(asked)}${kind === "post" ? "" : `&k=${kind}`}`;
  // Some of what the index found on this page is behind a door this reader is
  // not through. Counted against THIS page and never against the total, which
  // spans every page: "4 more are in something you do not have" under a page
  // of twenty, with sixty more to come, would be a sentence that is simply
  // false.
  const held = page.posts.length - shown;

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <ConfirmDeletes />
      <CommunityBar store={store} config={config} tab={null} signedIn query={asked} messages={config.dm.on} requests={waiting} news={news} room={config.chat.on} />
      <main id="content" className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <p className="mb-4">
          <Link href={home} className="cm-quiet-link text-sm font-semibold underline underline-offset-4">Back to the feed</Link>
        </p>
        {notice ? <p className={`cm-flash mb-5 ${notice.tone === "warn" ? "cm-flash-warn" : ""}`} role="status">{notice.text}</p> : null}

        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          {asked.trim() ? `Search: ${asked.trim()}` : "Search"}
        </h1>

        {!asked.trim() ? (
          <p className="st-muted mt-2">
            Type in the box above to look through the posts here and every comment under them, the lessons of the courses
            you have, what is on the calendar, and the people in the directory.
          </p>
        ) : wanted.length === 0 ? (
          <p className="st-muted mt-2">
            Those are all words too common to narrow anything down. Try the words that would only appear in what you are
            looking for.
          </p>
        ) : (
          <>
            {/* Four tabs, each carrying how many matched. A tab with nothing in
                it is still drawn and still says nothing, because a tab that
                disappears makes somebody wonder where it went. */}
            <nav className="cm-tabs mt-4" aria-label="What to search">
              {TABS.map((t) => {
                const n = pages?.[t.kind].total ?? 0;
                const on = t.kind === tab;
                return (
                  <Link
                    key={t.kind}
                    href={link(t.kind)}
                    className="cm-tab"
                    aria-current={on ? "page" : undefined}
                  >
                    {t.label}
                    <span className="cm-tab-n">{n}</span>
                  </Link>
                );
              })}
            </nav>

            <p className="st-muted mt-3 text-sm">
              {shown === 0
                ? `No ${here.many} hold all of those words.`
                : `${shown === 1 ? `1 ${here.one} holds` : `${shown} ${here.many} hold`} all of ${used.length === 1 ? "that word" : "those words"}.`}
              {dropped && used.length ? ` Searched for: ${used.join(", ")}.` : ""}
              {held > 0
                ? ` ${held === 1 ? "One more match on this page is" : `${held} more matches on this page are`} in something you do not have.`
                : ""}
            </p>

            {shown === 0 ? (
              <div className="st-note mt-5 text-center">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>No match</p>
                <p className="mt-1 text-sm">
                  Every word has to be there. Fewer words find more, and words are matched whole — “pay” does not find
                  “payment”.
                </p>
              </div>
            ) : null}

            {tab === "post" ? (
              <ul className="mt-5 space-y-4">
                {posts.map((post) => (
                  <li key={post.id}>
                    <PostCard
                      store={store}
                      post={post}
                      config={config}
                      members={members}
                      numbers={numbers.get(post.id)}
                      poll={polls.get(post.id)}
                      viewer={{ key, owner, canWrite }}
                      from="feed"
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "lesson" ? (
              <ul className="mt-5 space-y-3">
                {lessons.map((lesson) => (
                  <li key={`${lesson.product.id}.${lesson.lessonId}`} className="st-card p-4">
                    <Link
                      href={`/@${store.handle}/course/${lesson.product.id}/${lesson.lessonId}`}
                      className="font-bold underline underline-offset-4"
                      style={{ color: "var(--st-text)" }}
                    >
                      {lesson.title}
                    </Link>
                    <p className="st-muted mt-1 text-sm">{`${lesson.unit} · ${lesson.product.title}`}</p>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "event" ? (
              <ul className="mt-5 space-y-3">
                {events.map(({ event, state }) => (
                  <li key={event.id} className="st-card p-4">
                    <Link
                      href={`${home}/events/${event.id}`}
                      className="font-bold underline underline-offset-4"
                      style={{ color: "var(--st-text)" }}
                    >
                      {event.title}
                    </Link>
                    <p className="st-muted mt-1 text-sm">
                      {readableTime(event.start, event.tz)}
                      {state === "cancelled" ? " · Cancelled" : state === "over" ? " · Over" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "member" ? (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {people.map((person) => (
                  <li key={person.k} className="st-card flex items-center gap-3 p-4">
                    <Face store={store} author={person.k} name={person.n} size={44} />
                    <div className="min-w-0">
                      <p className="cm-text font-bold">{person.n}</p>
                      {person.h ? <p className="st-muted text-xs font-semibold">{`@${person.h}`}</p> : null}
                      {person.k !== key && !mayMessage(config.dm, key, person.k) ? (
                        <p className="mt-1">
                          <Link href={`${home}/messages/${pairOf(key, person.k)}`} className="cm-quiet-link cm-mini text-xs font-semibold">
                            Message
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {page.next ? (
              <p className="mt-6 text-center">
                <Link href={`${link(tab)}&before=${page.next}`} className="cm-pill cm-pill-wide">
                  {tab === "member" ? "Members who joined earlier" : tab === "lesson" ? "Later lessons" : "Older matches"}
                </Link>
              </p>
            ) : null}

            {/* Video is not listened to: saying so beats a creator searching
                for something they only ever said out loud and quietly
                concluding the search is broken. */}
            {tab === "lesson" ? (
              <p className="st-muted mt-5 text-xs">
                Lessons are found by their title, their module and their written text. What is spoken inside a video is
                not searched.
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
