import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { CREATOR, readMembers } from "@/lib/community";
import { communityViewer } from "@/lib/community-access";
import { room } from "@/lib/community-chat";
import { requestCount } from "@/lib/community-dm";
import { unreadCount } from "@/lib/community-notify";
import { CommunityBar } from "@/components/community-parts";
import { CommunityRoom } from "@/components/community-room";

type Params = { params: Promise<{ handle: string }> };

export const metadata: Metadata = {
  title: "Room — Marktmorgen",
  robots: { index: false, follow: false },
};

/**
 * The room: where a community talks at the speed people talk.
 *
 * The first page of it is drawn on the server, so somebody arriving reads
 * immediately rather than watching a box fill. Everything after that the page
 * asks for itself.
 */
export default async function CommunityChatPage({ params }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityViewer(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  if (viewer.state !== "in") redirect(home);
  const { config, owner, key, canWrite } = viewer;
  if (!config.chat.on) redirect(`${home}?n=chatoff`);

  const id = store.community.id;
  const page = await room(id);
  const members = await readMembers(id, page.messages.map((m) => m.a).filter((a) => a !== CREATOR));
  const names: Record<string, string> = {};
  for (const message of page.messages) {
    names[message.a] = message.a === CREATOR ? store.name : members.get(message.a)?.n || "A member";
  }
  const [waiting, news] = await Promise.all([
    config.dm.on ? requestCount(id, key) : Promise.resolve(0),
    unreadCount(id, key),
  ]);

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <CommunityBar store={store} config={config} tab="chat" signedIn messages={config.dm.on} requests={waiting} news={news} room={config.chat.on} />
      <main id="content" className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <p className="mb-4">
          <Link href={home} className="cm-quiet-link text-sm font-semibold underline underline-offset-4">Back to the feed</Link>
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">The room</h1>
        <p className="st-muted mt-1 text-sm">
          For the hour everybody is here at once. What is worth coming back to belongs in a post.
        </p>

        <CommunityRoom
          handle={store.handle}
          first={page.messages}
          names={names}
          cursor={page.cursor}
          me={key}
          canWrite={canWrite || owner}
          owner={owner}
          creatorOnly={config.chat.creatorOnly}
          slow={config.chat.slow}
          links={config.chat.links}
        />
      </main>
    </div>
  );
}
