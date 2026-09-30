import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { CREATOR, readMembers } from "@/lib/community";
import { communityViewer } from "@/lib/community-access";
import { whenWords } from "@/lib/community-text";
import { type Conversation, inbox } from "@/lib/community-dm";
import { CommunityBar, Face, NOTICES, authorName } from "@/components/community-parts";

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Messages — Nimbus Labs",
  robots: { index: false, follow: false },
};

/**
 * Somebody's own messages: the conversations they are in, and the requests
 * waiting on them.
 *
 * The two lists are apart on purpose. A request is not a conversation yet —
 * it is a stranger asking for one — and mixing them would give an unwanted
 * message the same place in somebody's day as a wanted one. That separation
 * is the whole point of the queue.
 */
export default async function MessagesPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityViewer(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  if (viewer.state !== "in") redirect(home);
  const { config, owner, key } = viewer;
  if (!config.dm.on) redirect(`${home}?n=dmoff`);

  const id = store.community.id;
  const query = await searchParams;
  const notice = NOTICES[typeof query.n === "string" ? query.n : ""] ?? null;
  const [talks, asks] = await Promise.all([inbox(id, key), inbox(id, key, true)]);
  const people = [...talks, ...asks].map((c) => c.other).filter((who) => who !== CREATOR);
  const members = await readMembers(id, people);
  const nameOf = (who: string) => authorName(store, who, members);

  const list = (rows: Conversation[], request: boolean) => (
    <ul className="mt-3 space-y-2">
      {rows.map((c) => (
        <li key={c.pair}>
          <Link href={`${home}/messages/${c.pair}`} className="cm-dm-row">
            <Face store={store} author={c.other} name={nameOf(c.other)} size={40} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="truncate font-bold">{nameOf(c.other)}</span>
                {c.unread ? <span className="cm-badge cm-badge-accent">New</span> : null}
              </span>
              <span className="st-muted block truncate text-sm">
                {c.last ? `${c.last.a === key ? "You: " : ""}${c.last.text}` : "No messages"}
              </span>
            </span>
            <time className="st-muted shrink-0 text-xs font-semibold" dateTime={new Date(c.at * 1000).toISOString()}>
              {whenWords(c.at)}
            </time>
          </Link>
          {request ? (
            <div className="mt-1 flex flex-wrap gap-2 px-1">
              <form action="/api/store/community/messages" method="post">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="action" value="accept" />
                <input type="hidden" name="pair" value={c.pair} />
                <button type="submit" className="cm-pill">Accept</button>
              </form>
              <form action="/api/store/community/messages" method="post">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="action" value="decline" />
                <input type="hidden" name="pair" value={c.pair} />
                <button type="submit" className="cm-quiet-link cm-mini cm-danger text-xs font-semibold">
                  Decline, and hear no more from them
                </button>
              </form>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <CommunityBar store={store} config={config} tab="messages" signedIn messages={config.dm.on} />
      <main id="content" className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <p className="mb-4">
          <Link href={home} className="cm-quiet-link text-sm font-semibold underline underline-offset-4">Back to the feed</Link>
        </p>
        {notice ? <p className={`cm-flash mb-5 ${notice.tone === "warn" ? "cm-flash-warn" : ""}`} role="status">{notice.text}</p> : null}

        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">Messages</h1>
        <p className="st-muted mt-1 text-sm">
          {owner
            ? `Private, between you and one member. Nobody else here can read them — and neither can we.`
            : `Private, between you and one other person. ${store.name} cannot read a conversation they are not in.`}
        </p>

        {asks.length ? (
          <section aria-labelledby="asks-title" className="mt-7">
            <h2 id="asks-title" className="text-lg font-semibold">
              {`${asks.length} ${asks.length === 1 ? "person wants" : "people want"} to message you`}
            </h2>
            <p className="st-muted mt-1 text-sm">
              Nothing here counts as a conversation until you accept it. Decline and it goes, and that person cannot ask
              again.
            </p>
            {list(asks, true)}
          </section>
        ) : null}

        <section aria-labelledby="talks-title" className="mt-7">
          <h2 id="talks-title" className="text-lg font-semibold">Your conversations</h2>
          {talks.length === 0 ? (
            <div className="st-note mt-3 text-center">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>Nothing here yet</p>
              <p className="mt-1 text-sm">
                {config.dm.between
                  ? "Open somebody's name in the members list to write to them."
                  : `Only ${store.name} can be written to here, from their name in the members list.`}
              </p>
            </div>
          ) : (
            list(talks, false)
          )}
        </section>
      </main>
    </div>
  );
}
