"use client";

import { useRef, useState } from "react";
import { shrink } from "@/components/shrink-image";
import { IMAGE_ACCEPT, MAX_SOURCE_BYTES } from "@/lib/product-image";
import { MAIL_PICTURE_SIDE, MAX_MAIL_PICTURES, MAX_MAIL_PICTURE_BYTES, pictureCount, pictureLine } from "@/lib/mail-picture-rules";

const PROBLEMS: Record<string, string> = {
  picture: "That picture could not be used. Try a JPEG, PNG or WebP photo.",
  big: `That file is too large to start from. Choose one under ${Math.round(MAX_SOURCE_BYTES / 1024 / 1024)} MB.`,
  slow: "That is a lot of pictures in an hour. Wait a little and try again.",
  signed_out: "Your session ended. Log in again.",
  forbidden: "Your role on this store cannot write emails.",
  server_error: "The picture could not be kept just now. Try again in a moment.",
};

/**
 * "Add a picture" under an email's box (lib/mail-picture-rules.ts): the
 * picture is made smaller here, kept, and put into the email as a line of
 * its own where the cursor is, with what it shows typed in its brackets for
 * readers who cannot see it.
 */
export function MailPictureButton({
  body,
  onChange,
  box,
}: {
  body: string;
  onChange: (next: string) => void;
  /** The email's box, for where the cursor is; read when the picture is in. */
  box: () => HTMLTextAreaElement | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const full = pictureCount(body) >= MAX_MAIL_PICTURES;

  async function choose(file: File | undefined) {
    setProblem("");
    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) return setProblem(PROBLEMS.big);
    setBusy(true);
    try {
      const shrunk = await shrink(file, MAIL_PICTURE_SIDE, MAX_MAIL_PICTURE_BYTES, true);
      const picture = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(shrunk.blob);
      });
      const response = await fetch("/api/store/mail/picture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picture }) });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) return setProblem(PROBLEMS[data.error ?? ""] ?? PROBLEMS.server_error);
      const line = pictureLine(alt, data.url);
      const field = box();
      const at = field ? field.selectionStart : body.length;
      const before = body.slice(0, at).replace(/\s+$/, "");
      const after = body.slice(at).replace(/^\s+/, "");
      onChange([before, line, after].filter(Boolean).join("\n\n"));
      setAlt("");
    } catch {
      setProblem(PROBLEMS.picture);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="rounded-[var(--r-sm)] border border-line bg-white p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-48 flex-1">
          <span className="text-sm text-ink-soft">What the picture shows (for readers who cannot see it)</span>
          <input className="field mt-1" maxLength={200} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="The finished loaf, sliced on a board" />
        </label>
        <label className={`btn btn-ghost btn-sm ${busy || full ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
          {busy ? "Adding the picture…" : "Add a picture"}
          <input ref={input} type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={busy || full} onChange={(e) => void choose(e.target.files?.[0])} />
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {full
          ? `This email has ${MAX_MAIL_PICTURES} pictures, the most one can show.`
          : `It goes where the cursor is, as a line of its own; delete the line to take it out. Up to ${MAX_MAIL_PICTURES} per email.`}
      </p>
      {problem ? <p className="notice notice-error mt-2 text-sm" role="alert">{problem}</p> : null}
    </div>
  );
}
