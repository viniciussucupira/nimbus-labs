import type { NextRequest } from "next/server";
import { jsonAccess } from "@/lib/studio-route";
import { readPage } from "@/lib/sales-page-store";
import { readCounts } from "@/lib/headline-test";

/** How a product's headline test is going: `?id=<product>` (lib/headline-test.ts). */
export async function GET(request: NextRequest) {
  const access = await jsonAccess(request, "products");
  if (access instanceof Response) return access;
  const id = (request.nextUrl.searchParams.get("id") ?? "").slice(0, 40);
  const store = access.store;
  if (!store || !id) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
  try {
    const page = await readPage(store.statsId, id);
    if (!page.test) return Response.json({ ok: false, error: "none" }, { status: 404 });
    const counts = await readCounts(store.statsId, id, page.test.id);
    return Response.json({ ok: true, counts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("reading a headline test failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
