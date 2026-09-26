"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import {
  ACCENTS,
  THEMES,
  type StoreLook,
  type ThemeId,
  lookColours,
  lookStyle,
  normaliseHex,
} from "@/lib/store-look";
import { MAX_PHOTO_BYTES, PHOTO_SIDE, photoUrl } from "@/lib/photo-limits";

const MESSAGES: Record<string, string> = {
  theme: "Pick one of the themes before saving.",
  accent: "That colour could not be read. Pick one of the swatches or your own.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  too_big: "That picture is still too big after shrinking. Try another one.",
  type: "That picture could not be read. Try a JPEG, PNG or WebP.",
  empty: "That picture could not be read. Try a JPEG, PNG or WebP.",
  unreadable: "That picture could not be read. Try a JPEG, PNG or WebP.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Status =
  | { kind: "idle" }
  | { kind: "working"; what: "look" | "photo" }
  | { kind: "error"; message: string };

/** Crops the middle square of a picture and shrinks it to a small file. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    const side = Math.min(w, h);
    if (!side) throw new Error("unreadable");

    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIDE;
    canvas.height = PHOTO_SIDE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("unreadable");
    // A transparent picture saved as JPEG would turn black behind the face.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, PHOTO_SIDE, PHOTO_SIDE);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, PHOTO_SIDE, PHOTO_SIDE);

    const encode = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

    let blob = await encode("image/webp", 0.86);
    // Older Safari cannot write WebP and quietly hands back a PNG instead.
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", 0.86);
    let quality = 0.86;
    while (blob && blob.size > MAX_PHOTO_BYTES && quality > 0.4) {
      quality -= 0.12;
      blob = await encode("image/jpeg", quality);
    }
    if (!blob) throw new Error("unreadable");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(blob);
  });
}

/** The theme, the colour and the photo of the public page, with a live preview. */
export function LookEditor({
  look,
  photoId,
  name,
  handle,
}: {
  look: StoreLook;
  photoId: string | null;
  name: string;
  handle: string;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeId>(look.theme);
  const [accent, setAccent] = useState(look.accent);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const preset = ACCENTS.some((option) => option.hex === accent);
  const changed = theme !== look.theme || accent !== look.accent;
  const colours = useMemo(() => lookColours({ theme, accent }), [theme, accent]);
  // Said out loud when the page will not paint exactly what was picked, so the
  // creator is never left wondering why their button is darker than their logo.
  const adjusted = colours.accent !== accent;

  async function post(path: string, body: unknown): Promise<{ ok?: boolean; error?: string }> {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  }

  async function saveLook() {
    if (status.kind === "working") return;
    setStatus({ kind: "working", what: "look" });
    try {
      const data = await post("/api/store/look", { theme, accent });
      if (data.ok) {
        setStatus({ kind: "idle" });
        toast("Look saved.");
        router.refresh();
        return;
      }
      setStatus({ kind: "error", message: MESSAGES[data.error ?? ""] ?? MESSAGES.server_error });
    } catch {
      setStatus({ kind: "error", message: MESSAGES.server_error });
    }
  }

  async function choosePhoto(file: File | undefined) {
    if (!file || status.kind === "working") return;
    setStatus({ kind: "working", what: "photo" });
    try {
      let data64: string;
      try {
        data64 = await toBase64(await shrink(file));
      } catch {
        setStatus({ kind: "error", message: MESSAGES.unreadable });
        return;
      }
      const data = await post("/api/store/photo", { photo: data64 });
      if (data.ok) {
        setStatus({ kind: "idle" });
        toast("Photo updated.");
        router.refresh();
        return;
      }
      setStatus({ kind: "error", message: MESSAGES[data.error ?? ""] ?? MESSAGES.server_error });
    } catch {
      setStatus({ kind: "error", message: MESSAGES.server_error });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (status.kind === "working") return;
    setStatus({ kind: "working", what: "photo" });
    try {
      const data = await post("/api/store/photo", { remove: true });
      if (data.ok) {
        setStatus({ kind: "idle" });
        toast("Photo removed.");
        router.refresh();
        return;
      }
      setStatus({ kind: "error", message: MESSAGES[data.error ?? ""] ?? MESSAGES.server_error });
    } catch {
      setStatus({ kind: "error", message: MESSAGES.server_error });
    }
  }

  const working = status.kind === "working";

  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="look-title">
      <h2 id="look-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
        How your page looks
      </h2>
      <p className="mt-2 text-ink-soft">
        Your photo, a theme and your colour. Every colour is checked so that the words on your page stay easy to read.
      </p>

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0 space-y-7">
          {/* Photo */}
          <div>
            <p className="field-label">Your photo</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {photoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl(photoId)}
                  alt="Your photo as it shows on your page"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover ring-1 ring-line"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid h-16 w-16 place-items-center rounded-full bg-sand text-2xl font-semibold text-ink-mute"
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className={`btn btn-secondary btn-sm cursor-pointer ${working ? "pointer-events-none opacity-60" : ""}`}>
                  <Icon name="camera" size={16} />
                  {photoId ? "Choose another photo" : "Choose a photo"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={working}
                    onChange={(event) => choosePhoto(event.target.files?.[0])}
                  />
                </label>
                {photoId ? (
                  <button
                    type="button"
                    onClick={removePhoto}
                    disabled={working}
                    className="btn btn-ghost btn-sm"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <p className="field-hint mt-2">
              The middle square is used and shrunk to {PHOTO_SIDE} pixels before it leaves your device. It is saved as soon as you pick it.
            </p>
          </div>

          {/* Theme */}
          <fieldset>
            <legend className="field-label">Theme</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {THEMES.map((option) => {
                const c = lookColours({ theme: option.id, accent });
                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[var(--r-sm)] border border-line-strong bg-white p-3 transition hover:border-violet-brand has-[:checked]:border-violet-brand has-[:checked]:bg-lilac has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-brand"
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={option.id}
                      checked={theme === option.id}
                      onChange={() => setTheme(option.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid h-12 w-10 shrink-0 grid-rows-[1fr_auto] overflow-hidden rounded-[8px] ring-1 ring-line"
                      style={{ background: option.id === "bold" ? `linear-gradient(135deg, ${c.accent}, ${c.accent2})` : c.bg }}
                    >
                      <span />
                      <span className="m-1 h-2.5 rounded-[3px]" style={{ background: option.id === "bold" ? c.card : c.accent }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Colour */}
          <fieldset>
            <legend className="field-label">Your colour</legend>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {ACCENTS.map((option) => (
                <label
                  key={option.hex}
                  title={option.label}
                  className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-full ring-offset-2 transition has-[:checked]:ring-2 has-[:checked]:ring-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-brand"
                  style={{ background: option.hex }}
                >
                  <input
                    type="radio"
                    name="accent"
                    value={option.hex}
                    checked={accent === option.hex}
                    onChange={() => setAccent(option.hex)}
                    className="sr-only"
                  />
                  <span className="sr-only">{option.label}</span>
                  {accent === option.hex ? <Icon name="check" size={18} className="text-white" /> : null}
                </label>
              ))}
              <label
                className={`flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-brand ${
                  preset ? "border-line-strong text-ink-soft" : "border-ink text-ink"
                }`}
              >
                <span aria-hidden="true" className="h-5 w-5 rounded-full ring-1 ring-line" style={{ background: accent }} />
                Your own
                <input
                  type="color"
                  value={accent}
                  onChange={(event) => {
                    const hex = normaliseHex(event.target.value);
                    if (hex) setAccent(hex);
                  }}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="field-hint mt-2">
              {adjusted
                ? "Your colour is darkened or lightened a little on buttons so that the words on them can be read. The preview shows exactly what your page will show."
                : "The preview shows exactly what your page will show."}
            </p>
          </fieldset>

          {status.kind === "error" ? (
            <p className="notice notice-error" role="alert">{status.message}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveLook}
              disabled={working || !changed}
              className="btn btn-primary"
            >
              {working && status.what === "look" ? "Saving…" : "Save the look"}
            </button>
            {changed ? (
              <button
                type="button"
                onClick={() => {
                  setTheme(look.theme);
                  setAccent(look.accent);
                  setStatus({ kind: "idle" });
                }}
                className="btn btn-ghost"
              >
                Undo changes
              </button>
            ) : null}
            {working && status.what === "photo" ? (
              <span className="flex items-center gap-2 text-sm text-ink-soft" role="status">
                <span className="spinner" aria-hidden="true" /> Saving your photo…
              </span>
            ) : null}
          </div>
        </div>

        {/* Live preview, not interactive: a picture of the page, not the page. */}
        <div aria-hidden="true" className="min-w-0">
          <p className="field-label">Preview</p>
          <div
            className={`st-page st-theme-${theme} pointer-events-none mt-3 overflow-hidden rounded-[1.25rem] ring-1 ring-line`}
            style={lookStyle({ theme, accent }) as React.CSSProperties}
          >
            <div className={theme === "bold" ? "st-band px-4 pb-6 pt-6 text-center" : "px-4 pb-1 pt-6 text-center"}>
              {photoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(photoId)} alt="" width={56} height={56} className="st-avatar" style={{ width: 56, height: 56 }} />
              ) : (
                <span className="st-avatar st-avatar-initial" style={{ width: 56, height: 56, fontSize: "1.5rem" }}>
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="font-display mt-3 block text-base font-semibold">{name}</span>
              <span className="st-muted block text-xs font-semibold">@{handle}</span>
            </div>
            <div className="space-y-2.5 px-3 pb-4 pt-4">
              <div className="st-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">Your product</span>
                  <span className="st-price text-xs">$27</span>
                </div>
                <span className="btn st-btn btn-block btn-sm mt-3 text-sm">Buy for $27</span>
              </div>
              <div className="st-card px-3 py-2.5 text-center text-sm font-semibold">A link of yours</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
