import { initialOf, segments, whenWords } from "@/lib/community-text";
import {
  CREATOR_AUTHOR,
  type LessonComment,
  MAX_COMMENTER_NAME,
  MAX_LESSON_COMMENT,
  type Thread,
  countShown,
} from "@/lib/lesson-comments-rules";

const NOTICES: Record<string, { text: string; warn?: boolean }> = {
  posted: { text: "Posted." },
  deleted: { text: "Deleted." },
  hidden: { text: "Hidden. Only you and whoever wrote it can see it now." },
  shown: { text: "Shown again to every student." },
  empty: { text: "Write something first.", warn: true },
  name: { text: "Add the name other students will see, then post again.", warn: true },
  slow: { text: "That is a lot of comments at once. Wait a minute, then post again.", warn: true },
  parent: { text: "That comment is no longer there.", warn: true },
  replies: { text: "That comment has as many answers as it can take. Start a new comment instead.", warn: true },
  full: { text: "This lesson has as many comments as it can keep.", warn: true },
  gone: { text: "That comment is no longer there.", warn: true },
  off: { text: "Comments are switched off for this course.", warn: true },
};

function Words({ text }: { text: string }) {
  return (
    <p className="cm-text mt-1 text-[0.9375rem]" style={{ color: "var(--st-text)" }}>
      {segments(text).map((part, i) =>
        part.kind === "link" ? (
          <a key={i} href={part.href} target="_blank" rel="nofollow ugc noopener noreferrer">
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

type Where = { handle: string; product: string; lesson: string };

function Fields({ where, action }: { where: Where; action: string }) {
  return (
    <>
      <input type="hidden" name="handle" value={where.handle} />
      <input type="hidden" name="product" value={where.product} />
      <input type="hidden" name="lesson" value={where.lesson} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}

/** The name box, only for a student who has not chosen one yet. */
function NameField({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <label className="block">
      <span className="st-label">Your name, as other students see it</span>
      <input className="st-field mt-2" name="name" required maxLength={MAX_COMMENTER_NAME} autoComplete="given-name" placeholder="Dana" />
    </label>
  );
}

function One({
  comment,
  reply,
  answers = 0,
  reader,
  storeName,
  where,
  now,
}: {
  comment: LessonComment;
  reply: boolean;
  answers?: number;
  reader: string;
  storeName: string;
  where: Where;
  now: number;
}) {
  const creator = reader === CREATOR_AUTHOR;
  const fromCreator = comment.by === CREATOR_AUTHOR;
  const name = fromCreator ? storeName : comment.name || "A student";
  const mine = comment.by === reader;
  return (
    <div id={`c-${comment.id}`} className={`flex gap-3 ${comment.hidden ? "opacity-60" : ""}`}>
      <span aria-hidden="true" className={`cm-face ${fromCreator ? "cm-face-creator" : ""} ${reply ? "h-8 w-8 text-sm" : "h-10 w-10"}`}>
        {initialOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold" style={{ color: "var(--st-text)" }}>{name}</span>
          {fromCreator ? <span className="cm-badge cm-badge-creator">Creator</span> : null}
          {comment.hidden ? <span className="cm-badge cm-badge-warn">Hidden</span> : null}
          <span className="st-muted">{whenWords(comment.at, now)}</span>
        </p>
        <Words text={comment.text} />
        {mine || creator ? (
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
            {creator && !fromCreator ? (
              <form action="/api/store/course/comment" method="post">
                <Fields where={where} action={comment.hidden ? "show" : "hide"} />
                <input type="hidden" name="id" value={comment.id} />
                <button type="submit" className="st-footer-link inline-flex min-h-11 items-center font-semibold">
                  {comment.hidden ? "Show" : "Hide"}
                </button>
              </form>
            ) : null}
            <form action="/api/store/course/comment" method="post">
              <Fields where={where} action="delete" />
              <input type="hidden" name="id" value={comment.id} />
              <button type="submit" className="st-footer-link inline-flex min-h-11 items-center font-semibold">
                {answers > 0 ? "Delete with its answers" : "Delete"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The comments under a lesson, for a student of the course or its creator.
 * Plain forms that post to /api/store/course/comment: nothing here needs
 * a script to work.
 */
export function LessonComments({
  threads,
  reader,
  storeName,
  hidden,
  myName,
  notice,
  now,
}: {
  threads: Thread[];
  /** CREATOR_AUTHOR, or the student's key. */
  reader: string;
  storeName: string;
  /** The fields every form carries: which store, product and lesson. */
  hidden: { handle: string; product: string; lesson: string };
  /** The name this student already chose, or "". */
  myName: string;
  notice: string;
  now: number;
}) {
  const creator = reader === CREATOR_AUTHOR;
  const count = countShown(threads);
  const flash = NOTICES[notice];
  return (
    <section id="comments" aria-labelledby="comments-title" className="st-card p-5 sm:p-8">
      <h2 id="comments-title" className="font-display text-xl font-semibold tracking-[-0.01em]" style={{ color: "var(--st-text)" }}>
        {count ? `Questions and comments (${count})` : "Questions and comments"}
      </h2>
      <p className="st-muted mt-1 text-sm">
        {creator
          ? "What your students write under this lesson. You answer here as the creator; a student you answer gets an email with your words."
          : "Seen by the creator and the other students of this course, under the name you choose. Your email address is never shown."}
      </p>

      {flash ? (
        <p className={`cm-flash mt-4 ${flash.warn ? "cm-flash-warn" : ""}`} role={flash.warn ? "alert" : "status"}>
          {flash.text}
        </p>
      ) : null}

      <form action="/api/store/course/comment" method="post" className="mt-5 space-y-3">
        <Fields where={hidden} action="post" />
        <NameField show={!creator && !myName} />
        <label className="block">
          <span className="st-label">{creator ? "Write to your students" : "Ask a question or share what you made"}</span>
          <textarea className="st-field mt-2" name="text" rows={3} required maxLength={MAX_LESSON_COMMENT} />
        </label>
        <button type="submit" className="btn st-btn">Post</button>
        {myName && !creator ? <p className="st-muted text-xs">{`You post as ${myName}.`}</p> : null}
      </form>

      {threads.length ? (
        <ol className="mt-8 space-y-6">
          {threads.map(({ comment, replies }) => (
            <li key={comment.id} className="space-y-3">
              <One comment={comment} reply={false} answers={replies.length} reader={reader} storeName={storeName} where={hidden} now={now} />
              {replies.length ? (
                <ol className="cm-thread ml-5 space-y-3">
                  {replies.map((r) => (
                    <li key={r.id}>
                      <One comment={r} reply reader={reader} storeName={storeName} where={hidden} now={now} />
                    </li>
                  ))}
                </ol>
              ) : null}
              {comment.hidden ? null : (
              <details className="cm-reply ml-[3.25rem]">
                <summary className="st-footer-link inline-flex text-sm font-semibold">Answer</summary>
                <form action="/api/store/course/comment" method="post" className="mt-2 space-y-3">
                  <Fields where={hidden} action="post" />
                  <input type="hidden" name="parent" value={comment.id} />
                  <NameField show={!creator && !myName} />
                  <label className="block">
                    <span className="sr-only">{`Your answer to ${comment.by === CREATOR_AUTHOR ? storeName : comment.name}`}</span>
                    <textarea className="st-field" name="text" rows={2} required maxLength={MAX_LESSON_COMMENT} />
                  </label>
                  <button type="submit" className="btn st-btn">Post the answer</button>
                </form>
              </details>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="st-muted mt-6 text-sm">Nothing here yet. The first question often helps everyone who comes after.</p>
      )}
    </section>
  );
}
