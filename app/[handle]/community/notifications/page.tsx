import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { readMembers } from "@/lib/community";
import { communityViewer } from "@/lib/community-access";
import { whenWords } from "@/lib/community-text";
import { type Notice, markSeen, noticesFor } from "@/lib/community-notify";
import { requestCount } from "@/lib/community-dm";
import { CommunityBar, Face, authorName } from "@/components/community-parts";

type Params = { params: Promise<{ handle: string }> };

export const metadata: Metadata = {
  title: "What happened — Nimbus Labs",
  robots: { index: false, follow: false },
};

const WHAT: Record<Notice["kind"], (who: string) => string> = {
  reply: (who) => `${who} answered your post`,
  answer: (who) => `${who} answered your comment`,
  mention: (who) => `${who} named you`,
};

/**
 * What happened to this person: somebody answered their post, answered their
 * comment, or named them.
 *
 * Only things that happened to THEM. There is no "new activity in the
 * community" here, because that is not news about anybody, and a list that
 * fills with it is a list people learn to ignore.
 *
 * Opening the page marks it looked at. Somebody who came to read it has read
 * it, and asking them to also press something to say so is a badge that
 * outlives its own truth.
 */
export default async function NotificationsPage({ params }: Params) {
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
  const { config, key } = viewer;
  const { notices } = await noticesFor(id, key);
  const members = await readMembers(id, notices.map((n) => n.by));
  const waiting = config.dm.on ? await requestCount(id, key) : 0;
  // Read is read. Done after the list is built, so this visit still shows
  // what was new when they arrived.
  await markSeen(id, key);

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <CommunityBar store={store} config={config} tab={null} signedIn messages={config.dm.on} requests={waiting} />
      <main id="content" className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <p className="mb-4">
          <Link href={home} className="cm-quiet-link text-sm font-semibold underline underline-offset-4">Back to the feed</Link>
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">What happened</h1>
        <p className="st-muted mt-1 text-sm">
          Only things that happened to you: somebody answered your post, answered your comment, or named you with an @.
        </p>

        {notices.length === 0 ? (
          <div className="st-note mt-6 text-center">
            <p className="font-bold" style={{ color: "var(--st-text)" }}>Nothing yet</p>
            <p className="mt-1 text-sm">
              {/* The creator has no member record and no chosen name: their
                  handle is @creator, in every community, always. */}
              {viewer.owner
                ? "When somebody answers you or writes @creator, it shows up here."
                : viewer.member?.h
                  ? `When somebody answers you or writes @${viewer.member.h}, it shows up here.`
                  : "Choose a name on your own page, and people will be able to name you with an @."}
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {notices.map((notice, i) => {
              const who = authorName(store, notice.by, members);
              const link = notice.comment
                ? `${home}/post/${notice.post}#comment-${notice.comment}`
                : `${home}/post/${notice.post}`;
              return (
                <li key={`${notice.at}-${i}`}>
                  <Link href={link} className="cm-dm-row">
                    <Face store={store} author={notice.by} name={who} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{WHAT[notice.kind](who)}</span>
                      {notice.words ? <span className="st-muted block truncate text-sm">{notice.words}</span> : null}
                    </span>
                    <time className="st-muted shrink-0 text-xs font-semibold" dateTime={new Date(notice.at * 1000).toISOString()}>
                      {whenWords(notice.at)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
