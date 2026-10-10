import type { NextRequest } from "next/server";
import { setOrder } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";
import { isPagePart } from "@/lib/store-order";

/**
 * Saves the order of the parts of the store page: `{ order: ["links",
 * "products", …] }`. Only names of parts are taken; the list is made whole
 * before it is kept (lib/store-order.ts, parseOrder). Part of the page.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page", 2_000);
  if (!guarded.ok) return guarded.response;
  const sent = guarded.body.order;
  if (!Array.isArray(sent) || sent.length > 20 || !sent.every(isPagePart)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  try {
    const store = await setOrder(guarded.ref, sent);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 404 });
    return Response.json({ ok: true, order: store.order });
  } catch (error) {
    console.error("saving the page order failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
