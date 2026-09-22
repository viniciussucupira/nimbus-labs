import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { UPSELL_COOKIE, takeUpsell } from "@/lib/upsell";

const MAX_BODY_BYTES = 1_000;

/**
 * The buyer pressed the one-click offer on the thanks page. Charged to the
 * card they just used, only from the browser that paid, once.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (sender && host) {
    try {
      if (new URL(sender).host !== host) return new Response("forbidden", { status: 403 });
    } catch {
      return new Response("forbidden", { status: 403 });
    }
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return new Response("Too large", { status: 413 });
  }

  let handle = "";
  let session = "";
  try {
    const form = await request.formData();
    const h = form.get("handle");
    const s = form.get("session_id");
    handle = typeof h === "string" ? normaliseHandle(h) : "";
    session = typeof s === "string" ? s.slice(0, 220) : "";
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!handle || !session) return new Response("Bad request", { status: 400 });

  const store = await storeForHandle(handle);
  if (!store) return new Response("No such store.", { status: 404 });

  const result = await takeUpsell({
    store,
    session,
    secret: request.cookies.get(UPSELL_COOKIE)?.value,
    origin,
  });
  const back = (status: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `${origin}/@${store.handle}/thanks?session_id=${encodeURIComponent(session)}&upsell=${status}`,
        "Cache-Control": "no-store",
      },
    });
  if (result.kind === "confirm") {
    return new Response(null, { status: 303, headers: { Location: result.url, "Cache-Control": "no-store" } });
  }
  return back(result.kind);
}
