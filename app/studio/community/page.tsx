import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { centsToPrice, isFree, storeForEmail } from "@/lib/store";
import { SITE_URL } from "@/lib/site-url";
import {
  type Member,
  directorySize,
  memberPage,
  postCount,
  readComment,
  readConfig,
  readMembers,
  readPost,
  reportQueue,
} from "@/lib/community";
import { announcementReach, canAnnounceByEmail } from "@/lib/community-mail";
import { CommunityStudio, type QueueRow, type StudioMember } from "@/components/community-studio";

export const metadata: Metadata = {
  title: "Community — Nimbus Labs",
  robots: { index: false, follow: false },
};

/** How many members the studio lists, most recently seen first. */
const MEMBERS_SHOWN = 500;

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 180)}…` : flat;
}

/** Where a creator runs their community: on or off, who gets in, spaces, reports, members. */
export default async function StudioCommunityPage() {
  const cookieStore = await cookies();
  const email = await emailForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect("/signin");
  const store = await storeForEmail(email);
  if (!store) redirect("/studio");

  const id = store.community?.id ?? null;
  const config = id ? await readConfig(id) : null;

  let queue: QueueRow[] = [];
  let members: StudioMember[] = [];
  let totals = { members: 0, listed: 0, posts: 0, reach: 0 };
  if (id && config) {
    const [reports, first, listed, posts, reach] = await Promise.all([
      reportQueue(id, 100),
      memberPage(id, "0", 1000),
      directorySize(id),
      postCount(id),
      announcementReach(id),
    ]);
    // Everyone, when the community is small; the most recently seen when it is not.
    let all: Member[] = first.members;
    let cursor = first.next;
    for (let page = 0; cursor !== "0" && page < 60; page += 1) {
      const next = await memberPage(id, cursor, 1000);
      all = all.concat(next.members);
      cursor = next.next;
    }
    all.sort((a, b) => b.seen - a.seen);
    members = all.slice(0, MEMBERS_SHOWN).map((m) => ({
      key: m.k,
      email: m.e,
      name: m.n,
      joined: m.at,
      seen: m.seen,
      muted: m.muted,
      removed: m.removed,
      listed: m.dir && Boolean(m.n),
      mail: m.mail,
    }));
    totals = { members: first.total, listed, posts, reach };

    const rows = await Promise.all(
      reports.map(async (r) => {
        const post = await readPost(id, r.target.post);
        if (!post) return null;
        const comment = r.target.kind === "comment" ? await readComment(id, post.id, r.target.comment) : null;
        if (r.target.kind === "comment" && !comment) return null;
        return { r, post, comment, author: comment ? comment.a : post.a };
      }),
    );
    const found = rows.filter((x): x is NonNullable<typeof x> => x !== null);
    const names = await readMembers(id, found.map((x) => x.author));
    queue = found.map(({ r, post, comment, author }) => ({
      key: r.key,
      kind: r.target.kind,
      count: r.count,
      at: r.at,
      text: excerpt(comment ? comment.text : [post.title, post.text].filter(Boolean).join(" — ") || "(a picture)"),
      author: author === "creator" ? store.name : names.get(author)?.n || "A member without a name",
      authorEmail: author === "creator" ? "" : names.get(author)?.e ?? "",
      hidden: comment ? comment.hid : post.hid,
      href: `/@${store.handle}/community/post/${post.id}${comment ? `#comment-${comment.id}` : ""}`,
    }));
  }

  const products = store.products.map((p) => ({
    id: p.id,
    title: p.title,
    free: isFree(p),
    kind: isFree(p)
      ? "Free, for a confirmed address"
      : p.recurring
        ? `Membership · $${centsToPrice(p.priceCents)} — while it is paid`
        : p.course
          ? `Course · $${centsToPrice(p.priceCents)}`
          : p.call
            ? `Call · $${centsToPrice(p.priceCents)}`
            : `$${centsToPrice(p.priceCents)}`,
  }));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-3">
          <Link href="/" className="shrink-0 rounded-[10px]" aria-label="Nimbus Labs, home">
            <Logo />
          </Link>
          <Link href="/studio" className="btn btn-secondary btn-sm">Back to the studio</Link>
        </div>
      </header>

      <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
        <p className="eyebrow">Community</p>
        <h1 className="t-h2 mt-3">A place for your buyers</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Posts, comments and likes in spaces you set up, a member directory people choose to join, and
          announcements you can also email. You choose which products let people in; each visit is checked against
          your own Stripe account, so a membership that stops being paid stops opening it. Members come in with a
          link to their inbox, with no account or password to make.
        </p>

        <CommunityStudio
          handle={store.handle}
          address={`${SITE_URL}/@${store.handle}/community`}
          on={Boolean(store.community?.on)}
          config={config}
          products={products}
          queue={queue}
          members={members}
          totals={totals}
          canEmail={canAnnounceByEmail(store)}
        />
      </main>
    </div>
  );
}
