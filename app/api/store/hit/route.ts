import type { NextRequest } from "next/server";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { classifySource } from "@/lib/stats";
import { countHit } from "@/lib/visit";

const MAX_BODY_BYTES = 1_500;

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * A store page saying it was opened, or that one of its links was.
 *
 * Sent by the page itself with sendBeacon, so a visit is counted only when a
 * real browser ran the page — not when a crawler or a link preview fetched
 * it. The answer is always empty: nothing here is worth telling the caller,
 * and a caller probing for stores learns nothing either.
 */
export async function POST(request: NextRequest) {
  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (sender && host) {
    try {
      if (new URL(sender).host !== host) return done();
    } catch {
      return done();
    }
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return done();

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return done();
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return done();
  }
  const read = (key: string, max: number) => (typeof body[key] === "string" ? (body[key] as string).slice(0, max) : "");

  const handle = normaliseHandle(read("h", 40));
  if (!handle) return done();
  const store = await storeForHandle(handle).catch(() => null);
  if (!store) return done();

  const kind = read("k", 2);
  if (kind === "v") {
    const source = classifySource({
      referrer: read("r", 500),
      utm: read("u", 60),
      userAgent: request.headers.get("user-agent") ?? "",
      ownHost: (host ?? "").split(":")[0].toLowerCase(),
    });
    await countHit(request, store, { kind: "view", source });
  } else if (kind === "l") {
    const id = read("id", 40);
    if (store.links.some((link) => link.id === id)) await countHit(request, store, { kind: "link", id });
  }
  return done();
}
