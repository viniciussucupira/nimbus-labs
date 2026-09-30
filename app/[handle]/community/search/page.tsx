import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { postNumbers, readMembers, readPosts } from "@/lib/community";
import { requestCount } from "@/lib/community-dm";
import { communityViewer, visibleSpaces } from "@/lib/community-access";
import { MAX_QUERY_LENGTH, queryWords, search } from "@/lib/community-search";
import { pollViews } from "@/lib/community-polls";
import { CommunityBar, NOTICES, PostCard } from "@/components/community-parts";
import { ConfirmDeletes } from "@/components/community-composer";

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Search — Nimbus Labs",
  robots: { index: false, follow: false },
};

/**
 * What has been said here before.
 *
 * A post matches when its title, its text or any comment under it holds every
 * word searched for. The thread is the answer, so a comment is never a result
 * on its own — it is what makes its post findable.
 *
 * The gate is asked here exactly as the feed asks it: a space kept for the
 * buyers of some products is absent from these results for everybody else,
 * and so are its posts. Searching is not a way around a door.
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
  const { config, owner, key, canWrite } = viewer;

  const wanted = queryWords(asked);
  const page = wanted.length ? await search(id, asked, before) : { posts: [], next: null, used: [] };
  const spaces = await visibleSpaces(store, config, { owner, email: viewer.email });
  const mineIds = new Set(spaces.map((s) => s.id));
  // A space this viewer is gated out of hides its posts here too. A post in a
  // space that no longer exists is not gated, and stays findable.
  const shut = new Set(config.spaces.filter((s) => s.only.length && !mineIds.has(s.id)).map((s) => s.id));
  const found = (await readPosts(id, page.posts)).filter((p) => (owner || !p.hid) && !shut.has(p.sp));
  const [members, numbers, polls] = await Promise.all([
    readMembers(id, found.map((p) => p.a)),
    postNumbers(id, found, key),
    pollViews(id, found, key, owner),
  ]);
  // The words that were actually looked for: "the" and "to" narrow nothing
  // down and are dropped, and saying so beats letting somebody wonder why
  // their phrase behaved oddly.
  const dropped = wanted.length !== page.used.length || (asked.trim() !== "" && wanted.length === 0);
  // The badge on the Messages link: nothing to read, nothing shown.
  const waiting = config.dm.on ? await requestCount(id, key) : 0;

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <ConfirmDeletes />
      <CommunityBar store={store} config={config} tab={null} signedIn query={asked} messages={config.dm.on} requests={waiting} />
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
            Type in the box above to look through every post here and every comment under them. A post is found by the
            words in it and by the words of the answers it got.
          </p>
        ) : wanted.length === 0 ? (
          <p className="st-muted mt-2">
            Those are all words too common to narrow anything down. Try the words that would only appear in what you are
            looking for.
          </p>
        ) : (
          <>
            <p className="st-muted mt-2 text-sm">
              {found.length === 0
                ? "Nothing here holds all of those words."
                : `${found.length === 1 ? "1 post holds" : `${found.length} posts hold`} all of ${page.used.length === 1 ? "that word" : "those words"}. Newest first.`}
              {dropped && page.used.length ? ` Searched for: ${page.used.join(", ")}.` : ""}
            </p>
            {found.length === 0 ? (
              <div className="st-note mt-5 text-center">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>No match</p>
                <p className="mt-1 text-sm">
                  Every word has to be there. Fewer words find more, and words are matched whole — “pay” does not find
                  “payment”.
                </p>
              </div>
            ) : (
              <ul className="mt-5 space-y-4">
                {found.map((post) => (
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
            )}
            {page.next ? (
              <p className="mt-6 text-center">
                <Link
                  href={`${home}/search?q=${encodeURIComponent(asked)}&before=${page.next}`}
                  className="cm-pill cm-pill-wide"
                >
                  Older matches
                </Link>
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
