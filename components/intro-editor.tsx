"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { PROVIDER_NAMES, type Video, readVideo, videoAddress } from "@/lib/sales-page";

/**
 * The welcome video under the store's name (lib/store.ts, intro): pasted as
 * it is copied from YouTube, Vimeo or Loom, checked as it is typed, and
 * played on the page only when a visitor presses play.
 */
export function IntroEditor({ intro }: { intro: Video | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(intro ? videoAddress(intro) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const video = url.trim() ? readVideo(url) : null;
  const wrong = url.trim() !== "" && !video;
  const changed = (intro ? videoAddress(intro) : "") !== (video ? videoAddress(video) : url.trim());

  async function save(next: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/store/intro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: next }) });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (data.ok) {
        toast(next ? "Welcome video saved. It plays under your store's name." : "Welcome video removed.");
        router.refresh();
        return;
      }
      setError("It could not be saved just now. Try again in a moment.");
    } catch {
      setError("It could not be saved just now. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!wrong && !saving) void save(url.trim());
      }}
      noValidate
    >
      <label htmlFor="intro-url" className="field-label">Welcome video (optional)</label>
      <input
        id="intro-url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://www.youtube.com/watch?v=…"
        aria-invalid={wrong ? true : undefined}
        aria-describedby="intro-note"
        className="field mt-2"
      />
      <p id="intro-note" className={`mt-1 text-sm ${wrong ? "font-semibold text-danger" : "text-ink-soft"}`}>
        {wrong
          ? "That is not a YouTube, Vimeo or Loom video address."
          : video
            ? `A ${PROVIDER_NAMES[video.provider]} video, under your name. It loads only when a visitor presses play.`
            : "A short hello under your name: who you are and what your store is for. YouTube, Vimeo or Loom."}
      </p>
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={saving || wrong || !changed} className="btn btn-secondary btn-sm">
          {saving ? "Saving…" : "Save the video"}
        </button>
        {intro ? (
          <button type="button" disabled={saving} onClick={() => { setUrl(""); void save(""); }} className="btn btn-ghost btn-sm">
            Remove it
          </button>
        ) : null}
      </div>
    </form>
  );
}
