import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage, type Store } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { CREATOR, type Comment, type Member, postNumbers, readComments, readMembers, readPost } from "@/lib/community";
import { communityViewer } from "@/lib/community-access";
import { ITEM_ID, MAX_COMMENT_TEXT, whenWords } from "@/lib/community-text";
import {
  ActButton,
  Carry,
  CommunityBar,
  CreatorBadge,
  Face,
  NOTICES,
  PostCard,
  PostText,
  authorName,
} from "@/components/community-parts";
import { ConfirmDeletes } from "@/components/community-composer";

type Params = { params: Promise<{ handle: string; post: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export const metadata: Metadata = {
  title: "Post — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Who = { key: string; owner: boolean; canWrite: boolean };

function CommentItem({
  store,
  post,
  comment,
  members,
  who,
  replies,
}: {
  store: Store;
  post: string;
  comment: Comment;
  members: Map<string, Member>;
  who: Who;
  replies?: React.ReactNode;
}) {
  const name = authorName(store, comment.a, members);
  const mine = comment.a === who.key;
  const top = !comment.parent;
  const extra = { comment: comment.id };
  return (
    <li id={`comment-${comment.id}`} className="scroll-mt-28">
      <div className={`flex items-start gap-3 ${comment.hid ? "cm-hidden" : ""}`}>
        <Face store={store} author={comment.a} name={name} size={top ? 36 : 30} />
        <div className="min-w-0 flex-1">
          <div className="cm-bubble">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold leading-tight">
              <span className="break-words">{name}</span>
              {comment.a === CREATOR ? <CreatorBadge /> : null}
              {comment.hid ? <span className="cm-badge cm-badge-warn">Hidden from members</span> : null}
            </p>
            <PostText text={comment.text} className="mt-1 text-[0.95rem]" />
          </div>
          <div className="st-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs font-semibold">
            <time dateTime={new Date(comment.at * 1000).toISOString()}>{whenWords(comment.at)}</time>
            {who.canWrite && !who.owner && !mine ? (
              <ActButton store={store} action="report" post={post} from="post" extra={extra} className="cm-quiet-link cm-mini">Report</ActButton>
            ) : null}
            {who.owner ? (
              <ActButton store={store} action={comment.hid ? "unhide-comment" : "hide-comment"} post={post} from="post" extra={extra} className="cm-quiet-link cm-mini">
                {comment.hid ? "Show" : "Hide"}
              </ActButton>
            ) : null}
            {who.canWrite && (who.owner || mine) ? (
              <ActButton store={store} action="delete-comment" post={post} from="post" extra={extra} className="cm-quiet-link cm-mini cm-danger" confirm={top ? "Delete this comment and its replies?" : "Delete this reply?"}>
                Delete
              </ActButton>
            ) : null}
          </div>
          {who.canWrite && top ? (
            <details className="cm-reply mt-1">
              <summary className="cm-quiet-link cm-mini inline-flex px-1 text-xs font-semibold">Reply</summary>
            <form id={`reply-${comment.id}`} action="/api/store/community" method="post" className="mt-2 scroll-mt-28">
              <Carry store={store} action="comment" post={post} from="post" />
              <input type="hidden" name="parent" value={comment.id} />
              <label htmlFor={`reply-text-${comment.id}`} className="sr-only">{`Reply to ${name}`}</label>
              <div className="flex gap-2">
                <input id={`reply-text-${comment.id}`} name="text" required maxLength={MAX_COMMENT_TEXT} placeholder={`Reply to ${name}…`} className="st-field min-w-0 flex-1 !min-h-[40px] !py-2 text-sm" autoComplete="off" />
                <button type="submit" className="cm-pill">Reply</button>
              </div>
            </form>
            </details>
          ) : null}
          {replies}
        </div>
      </div>
    </li>
  );
}

/** One post on its own page, with every comment under it. */
export default async function CommunityPostPage({ params, searchParams }: Params) {
  const { handle: raw, post: postId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityViewer(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  if (viewer.state !== "in") redirect(home);
  const id = store.community.id;
  const post = ITEM_ID.test(postId) ? await readPost(id, postId) : null;
  if (!post || (post.hid && !viewer.owner)) redirect(`${home}?n=gone`);

  const { config, owner, key, canWrite } = viewer;
  const query = await searchParams;
  const notice = NOTICES[typeof query.n === "string" ? query.n : ""] ?? null;
  const all = await readComments(id, post.id);
  const [members, numbers] = await Promise.all([readMembers(id, [post.a, ...all.map((c) => c.a)]), postNumbers(id, [post], key)]);
  const who: Who = { key, owner, canWrite };
  const visible = (c: Comment) => owner || !c.hid;
  const tops = all.filter((c) => !c.parent);
  const repliesOf = (c: Comment) => all.filter((r) => r.parent === c.id && visible(r));

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <ConfirmDeletes />
      <CommunityBar store={store} config={config} tab="feed" signedIn />
      <main id="content" className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <p className="mb-4">
          <Link href={home} className="cm-quiet-link text-sm font-semibold underline underline-offset-4">Back to the feed</Link>
        </p>
        {notice ? <p className={`cm-flash mb-5 ${notice.tone === "warn" ? "cm-flash-warn" : ""}`} role="status">{notice.text}</p> : null}

        <PostCard store={store} post={post} config={config} members={members} numbers={numbers.get(post.id)} viewer={who} from="post" full />

        <section id="comments" aria-labelledby="comments-title" className="st-card mt-4 scroll-mt-28 p-5 sm:p-6">
          <h2 id="comments-title" className="text-base font-bold">{`Comments (${all.filter(visible).length})`}</h2>
          {tops.length === 0 ? (
            <p className="st-muted mt-2 text-sm">No comments yet.</p>
          ) : (
            <ul className="mt-4 space-y-5">
              {tops.map((comment) => {
                const replies = repliesOf(comment);
                if (!visible(comment)) {
                  // A hidden comment whose replies are not: they keep their place.
                  if (replies.length === 0) return null;
                  return (
                    <li key={comment.id} id={`comment-${comment.id}`}>
                      <p className="st-muted text-sm italic">The creator hid this comment.</p>
                      <ul className="cm-thread mt-3 space-y-4">
                        {replies.map((r) => (
                          <CommentItem key={r.id} store={store} post={post.id} comment={r} members={members} who={who} />
                        ))}
                      </ul>
                    </li>
                  );
                }
                return (
                  <CommentItem
                    key={comment.id}
                    store={store}
                    post={post.id}
                    comment={comment}
                    members={members}
                    who={who}
                    replies={
                      replies.length ? (
                        <ul className="cm-thread mt-3 space-y-4">
                          {replies.map((r) => (
                            <CommentItem key={r.id} store={store} post={post.id} comment={r} members={members} who={who} />
                          ))}
                        </ul>
                      ) : null
                    }
                  />
                );
              })}
            </ul>
          )}

          {canWrite ? (
            <form id="reply" action="/api/store/community" method="post" className="mt-6 scroll-mt-28">
              <Carry store={store} action="comment" post={post.id} from="post" />
              <label htmlFor="comment-text" className="st-label">Add a comment</label>
              <textarea id="comment-text" name="text" required rows={3} maxLength={MAX_COMMENT_TEXT} className="st-field mt-2 resize-y" placeholder="Say something kind and useful" />
              <div className="mt-3 flex justify-end">
                <button type="submit" className="btn st-btn">Comment</button>
              </div>
            </form>
          ) : viewer.member?.muted ? (
            <p className="st-muted mt-6 text-sm">{NOTICES.muted.text}</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
