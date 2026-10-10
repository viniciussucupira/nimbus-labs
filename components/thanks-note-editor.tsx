"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { useLeaveGuard } from "@/components/leave-guard";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";
import { MAX_NOTE_BODY, MAX_NOTE_HEADING, MAX_NOTE_LABEL, type ThanksNote } from "@/lib/thanks-note";
import { videoAddress } from "@/lib/sales-page";
import { MAX_LINK_LENGTH } from "@/lib/product-link";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  video: "That video address is not one we can play. Paste a YouTube, Vimeo or Loom link, or leave it empty.",
  link: "The button needs the full https address of the page it opens, like https://discord.gg/yourgroup.",
  label: "Give the button its words, like “Join the group”, or empty the address.",
  empty: "Write something, add a video or a button, or press Remove to have no note.",
  unknown: "That product is no longer in your store. Reload the page.",
  signed_out: "Your session ended. Log in again.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Fields = { heading: string; body: string; video: string; label: string; url: string };

function fieldsOf(note: ThanksNote | null): Fields {
  return {
    heading: note?.heading ?? "",
    body: note?.body ?? "",
    video: note?.video ? videoAddress(note.video) : "",
    label: note?.button?.label ?? "",
    url: note?.button?.url ?? "",
  };
}

/**
 * A product's note after paying (lib/thanks-note.ts): what the buyer reads on
 * the thank-you page under what they bought, and in their confirmation email.
 */
export function ThanksNoteEditor({ productId, productTitle, storeName, initial }: { productId: string; productTitle: string; storeName: string; initial: ThanksNote | null }) {
  const [saved, setSaved] = useState<Fields>(() => fieldsOf(initial));
  const [fields, setFields] = useState<Fields>(saved);
  const [has, setHas] = useState(initial !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(fields) !== JSON.stringify(saved);
  useLeaveGuard(dirty && !busy);

  async function send(note: Fields | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/thanks-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, note }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; note?: ThanksNote | null };
      if (!data.ok) {
        setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
        return;
      }
      const kept = fieldsOf(data.note ?? null);
      setSaved(kept);
      setFields(kept);
      setHas(Boolean(data.note));
      toast(note ? "Note saved. Buyers see it after paying." : "Note removed.");
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields({ ...fields, [key]: event.target.value });
  const count = (value: string, max: number) => <span className="text-xs tabular-nums text-ink-mute">{`${value.length}/${max}`}</span>;

  return (
    <section id="after-paying" aria-labelledby="after-paying-title" className="card mt-6 scroll-mt-32 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="after-paying-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
            After paying: a note from you
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            {`What buyers of ${productTitle} read on the thank-you page, under what they bought, and in their confirmation email: what to do first, a welcome video, one button to your group, a booking or a next step.`}
          </p>
        </div>
        <span className={`tag ${has ? "tag-live" : ""}`}>{has ? "On" : "None"}</span>
      </div>
      <div className="mt-5 space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="note-heading" className="field-label">Heading (optional)</label>
            {count(fields.heading, MAX_NOTE_HEADING)}
          </div>
          <input id="note-heading" className="field" maxLength={MAX_NOTE_HEADING} value={fields.heading} placeholder={`A note from ${storeName}`} onChange={set("heading")} />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="note-body" className="field-label">Your note</label>
            {count(fields.body, MAX_NOTE_BODY)}
          </div>
          <textarea
            id="note-body"
            className="field"
            rows={5}
            maxLength={MAX_NOTE_BODY}
            value={fields.body}
            placeholder={"Thank you for joining! Start with the first lesson today, then come and say hello in the group.\n\n- Read the welcome guide\n- Join the group"}
            onChange={set("body")}
          />
          <p className="mt-1 text-xs text-ink-soft">A blank line starts a new paragraph, a line starting with &ldquo;- &rdquo; is a point, and a full https address becomes a link.</p>
        </div>
        <div>
          <label htmlFor="note-video" className="field-label">Video (optional)</label>
          <input id="note-video" className="field" inputMode="url" value={fields.video} placeholder="https://www.youtube.com/watch?v=…" onChange={set("video")} />
          <p className="mt-1 text-xs text-ink-soft">From YouTube, Vimeo or Loom. It loads only when the buyer presses play.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="note-label" className="field-label">Button words (optional)</label>
            <input id="note-label" className="field" maxLength={MAX_NOTE_LABEL} value={fields.label} placeholder="Join the group" onChange={set("label")} />
          </div>
          <div>
            <label htmlFor="note-url" className="field-label">Where the button goes</label>
            <input id="note-url" className="field" inputMode="url" maxLength={MAX_LINK_LENGTH} value={fields.url} placeholder="https://" onChange={set("url")} />
          </div>
        </div>
        <p className="text-xs text-ink-soft">The button opens in a new tab, with the site it leads to written under it.</p>
      </div>
      {error ? (
        <p className="notice notice-error mt-4" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} aria-busy={busy} onClick={() => void send(fields)}>
          {busy ? "Saving…" : "Save the note"}
        </button>
        {has ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void send(null)}>
            Remove
          </button>
        ) : null}
      </div>
    </section>
  );
}
