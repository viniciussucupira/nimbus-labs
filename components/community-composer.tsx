"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { shrink } from "@/components/product-image-editor";
import { IMAGE_ACCEPT, MAX_ALT_LENGTH, MAX_SOURCE_BYTES } from "@/lib/product-image";
import { MAX_POST_TEXT, MAX_POST_TITLE } from "@/lib/community-text";

type SpaceChoice = { id: string; name: string; creatorOnly: boolean };

const MESSAGES: Record<string, string> = {
  unreadable: "That picture could not be opened. Try a JPEG, PNG or WebP.",
  source: "That picture is over 30 MB. Pick a smaller one, or a screenshot of it.",
  too_big: "That picture is still over 1 MB after shrinking. Try a simpler one.",
  slow: "That is a lot of pictures in an hour. Wait a little, then try again.",
  signed_out: "Your session here ended. Reload the page.",
  server_error: "The picture could not be sent. Try again in a moment.",
};

const noSubscription = () => () => {};

function freshId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Writing a post: which space, an optional title, the text, and one picture.
 *
 * It is an ordinary form that posts without any script. With one, it also
 * takes a picture: shrunk in the browser and sent straight to the file store
 * exactly as a product picture is (components/product-image-editor.tsx),
 * then named in the form, where the server checks it again by its first
 * bytes before the post may point at it.
 */
export function CommunityComposer({
  handle,
  folder,
  spaces,
  current,
  owner,
  from,
  canEmail,
  reach,
  named,
}: {
  handle: string;
  folder: string;
  spaces: SpaceChoice[];
  current: string | null;
  owner: boolean;
  from: "feed" | "space";
  canEmail: boolean;
  reach: number;
  named: boolean;
}) {
  const open = spaces.filter((s) => owner || !s.creatorOnly);
  const initial = open.find((s) => s.id === current)?.id ?? open[0]?.id ?? "";
  const [space, setSpace] = useState(initial);
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ path: string; w: number; h: number; preview: string } | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  // Set once the form is sent, so a second press does not post (and email) twice.
  const [sent, setSent] = useState(false);
  useEffect(() => {
    // Coming back to this page with the browser's Back button: it can be sent again.
    const back = (event: PageTransitionEvent) => {
      if (event.persisted) setSent(false);
    };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, []);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // The picture button is only offered once the script that sends it runs:
  // false in the page as sent, true once it is running in the browser.
  const scripted = useSyncExternalStore(noSubscription, () => true, () => false);
  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.preview);
  }, [image]);

  if (open.length === 0) return null;

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    if (file.size > MAX_SOURCE_BYTES) {
      setError(MESSAGES.source);
      return;
    }
    setBusy(true);
    setPercent(0);
    try {
      let shrunk: Awaited<ReturnType<typeof shrink>>;
      try {
        shrunk = await shrink(file);
      } catch (thrown) {
        setError(thrown instanceof Error && thrown.message === "too_big" ? MESSAGES.too_big : MESSAGES.unreadable);
        return;
      }
      const path = `community/${folder}/${freshId()}.${shrunk.blob.type === "image/jpeg" ? "jpg" : "webp"}`;
      await uploadPresigned(path, shrunk.blob, {
        access: "private",
        handleUploadUrl: "/api/store/community/upload",
        clientPayload: JSON.stringify({ handle }),
        contentType: shrunk.blob.type,
        onUploadProgress: (progress) => setPercent(progress.percentage),
      });
      setImage({ path, w: shrunk.width, h: shrunk.height, preview: URL.createObjectURL(shrunk.blob) });
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : "";
      setError(MESSAGES[Object.keys(MESSAGES).find((k) => message.includes(k)) ?? "server_error"]);
    } finally {
      setBusy(false);
      setPercent(0);
      if (input.current) input.current.value = "";
    }
  }

  const left = MAX_POST_TEXT - text.length;

  return (
    <form
      action="/api/store/community"
      method="post"
      className="st-card p-5 sm:p-6"
      aria-labelledby="composer-title"
      onSubmit={(event) => {
        if (sent || busy) {
          event.preventDefault();
          return;
        }
        setSent(true);
      }}
    >
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="action" value="post" />
      <input type="hidden" name="from" value={from} />
      {image ? (
        <>
          <input type="hidden" name="img" value={image.path} />
          <input type="hidden" name="img_w" value={image.w} />
          <input type="hidden" name="img_h" value={image.h} />
        </>
      ) : null}
      <h2 id="composer-title" className="text-base font-bold">{owner ? "Write to your community" : "Start a post"}</h2>
      {!owner && !named ? (
        <p className="st-muted mt-1 text-sm">
          {"Posts carry the name you choose under "}
          <a href={`/@${handle}/community/you`} className="font-semibold underline underline-offset-4" style={{ color: "var(--st-text)" }}>You</a>
          {". Never your email address."}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <label htmlFor="post-title" className="sr-only">Title, if you want one</label>
          <input id="post-title" name="title" maxLength={MAX_POST_TITLE} placeholder="Title (optional)" className="st-field" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="post-space" className="sr-only">Space</label>
          <select id="post-space" name="space" value={space} onChange={(e) => setSpace(e.target.value)} className="st-field">
            {open.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <label htmlFor="post-text" className="sr-only">What you want to say</label>
      <textarea
        id="post-text"
        name="text"
        rows={4}
        maxLength={MAX_POST_TEXT}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={owner ? "Share news, a question, a win…" : "Ask, share a win, say hello…"}
        className="st-field mt-3 min-h-[7rem] resize-y"
        aria-describedby="post-count"
      />
      <p id="post-count" className="st-muted mt-1 text-right text-xs" aria-live="polite">
        {left < 500 ? `${left} characters left` : "Web addresses become links."}
      </p>

      {image ? (
        <div className="mt-3 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.preview} alt="" width={image.w} height={image.h} className="h-20 w-20 shrink-0 rounded-xl object-cover" style={{ boxShadow: "0 0 0 1px var(--st-line)" }} />
          <div className="min-w-0 flex-1">
            <label htmlFor="post-alt" className="st-label text-sm">What the picture shows</label>
            <input id="post-alt" name="img_alt" maxLength={MAX_ALT_LENGTH} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="For people who cannot see it" className="st-field mt-1" />
            <button type="button" className="cm-quiet-link mt-2 min-h-6 text-sm font-semibold underline underline-offset-4" onClick={() => setImage(null)}>
              Remove the picture
            </button>
          </div>
        </div>
      ) : null}
      {busy ? (
        <div className="mt-3" role="status">
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--st-accent-soft)" }} role="progressbar" aria-label="Sending the picture" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(percent, 4)}%`, background: "var(--st-accent)" }} />
          </div>
          <p className="st-muted mt-1 text-sm">Shrinking and sending the picture…</p>
        </div>
      ) : null}
      {error ? <p className="cm-alert mt-3" role="alert">{error}</p> : null}

      {owner ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Announcement</legend>
          <label className="flex min-h-6 items-start gap-2 text-sm">
            <input type="checkbox" name="kind" value="announcement" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Make it an announcement, labelled so</span>
          </label>
          {announce ? (
            <label className={`flex min-h-6 items-start gap-2 text-sm ${canEmail && reach > 0 ? "" : "st-muted"}`}>
              <input type="checkbox" name="email" value="1" disabled={!canEmail || reach === 0} className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                {!canEmail
                  ? "Emailing announcements is part of Pro, once your email settings are filled in."
                  : reach === 0
                    ? "Nobody has asked for announcement emails yet."
                    : `Also email it to the ${reach} ${reach === 1 ? "member" : "members"} who asked for announcements (counts toward your monthly emails)`}
              </span>
            </label>
          ) : null}
        </fieldset>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {scripted ? (
          <>
            <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => choose(e.target.files?.[0])} />
            <button type="button" className="cm-pill" disabled={busy || image !== null} onClick={() => input.current?.click()}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="9" cy="10" r="1.8" />
                <path d="m4 18 5-5 4 4 3-3 4 4" strokeLinejoin="round" />
              </svg>
              {image ? "One picture per post" : "Add a picture"}
            </button>
          </>
        ) : (
          <span />
        )}
        <button type="submit" className="btn st-btn" disabled={busy || sent} aria-busy={sent}>
          {announce ? "Post the announcement" : "Post"}
        </button>
      </div>
    </form>
  );
}

/** Asks before a delete goes through, where a script runs. Draws nothing. */
export function ConfirmDeletes() {
  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const question = form.dataset.confirm;
      if (question && !window.confirm(question)) event.preventDefault();
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}
