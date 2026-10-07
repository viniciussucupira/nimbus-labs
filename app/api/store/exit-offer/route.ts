import type { NextRequest } from "next/server";
import { setExitOffer } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";

/**
 * Chooses the free product offered once to a visitor about to leave
 * (lib/exit-offer.ts), or switches the offer off with an empty product.
 * Part of how the page works, so it needs the "page" permission.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page");
  if (!guarded.ok) return guarded.response;
  const product = text(guarded.body.product, 40).trim();
  try {
    const result = await setExitOffer(guarded.ref, product || null);
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: result.reason === "unknown" ? 404 : 400 });
    return Response.json({ ok: true, exitOffer: result.store.exitOffer });
  } catch (error) {
    console.error("saving the offer for leaving visitors failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
