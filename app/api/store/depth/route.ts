import type { NextRequest } from "next/server";
import { jsonAccess } from "@/lib/studio-route";
import { readPage } from "@/lib/sales-page-store";
import { reachShares, readDepth } from "@/lib/page-depth";

/** How far down a product's sales page visitors read: `?id=<product>` (lib/page-depth.ts). */
export async function GET(request: NextRequest) {
  const access = await jsonAccess(request, "products");
  if (access instanceof Response) return access;
  const id = (request.nextUrl.searchParams.get("id") ?? "").slice(0, 40);
  const store = access.store;
  if (!store || !id) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
  try {
    const [page, depth] = await Promise.all([readPage(store.statsId, id), readDepth(store.statsId, id)]);
    const result = reachShares(page.blocks.map((b) => b.id), depth.stopped, depth.visitors);
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("reading how far a page is read failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
