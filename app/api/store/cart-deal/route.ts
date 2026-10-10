import type { NextRequest } from "next/server";
import { setCartDeal } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";

/**
 * The deal for buying more in one cart (lib/cart-rules.ts), from the studio:
 * `{ on, min, percent }`. Prices are the "settings" permission, as a sale is.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings", 1_000);
  if (!guarded.ok) return guarded.response;
  try {
    const store = await setCartDeal(guarded.ref, { on: guarded.body.on === true, min: guarded.body.min, percent: guarded.body.percent });
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
    return Response.json({ ok: true, deal: store.cartDeal });
  } catch (error) {
    console.error("saving the cart deal failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
