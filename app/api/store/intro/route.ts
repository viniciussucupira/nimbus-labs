import type { NextRequest } from "next/server";
import { setIntro } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import { readVideo } from "@/lib/sales-page";

/**
 * Saves the welcome video under the store's name: `{ url }`, a YouTube, Vimeo
 * or Loom address as it is copied, or "" to take it away. Only which player
 * and which video is kept (lib/sales-page.ts, readVideo). Part of the page.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page", 2_000);
  if (!guarded.ok) return guarded.response;
  const url = text(guarded.body.url, 500).trim();
  const video = url ? readVideo(url) : null;
  if (url && !video) return Response.json({ ok: false, error: "not_a_video" }, { status: 400 });
  try {
    const store = await setIntro(guarded.ref, video);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 404 });
    return Response.json({ ok: true, intro: store.intro });
  } catch (error) {
    console.error("saving the welcome video failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
