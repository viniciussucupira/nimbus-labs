import type { NextRequest } from "next/server";
import { priceToCents, setProductExtras } from "@/lib/store";
import { MAX_STOCK, MIN_BUMP_CENTS, parseStock } from "@/lib/product-extras";
import { guardStoreWrite, text } from "@/lib/store-request";

/**
 * Sets or clears a product's limited quantity or its order bump.
 *
 * `{ id, stock: 50 }` or `{ id, stock: null }`;
 * `{ id, bump: { productId, price: "9", pitch } }` or `{ id, bump: null }`;
 * `{ id, upsell: {...} }` or `{ id, upsell: null }`, the same shape.
 * The price is read as text, like every other price the studio sends.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, 2_000);
  if (!guarded.ok) return guarded.response;
  const body = guarded.body;
  const id = text(body.id, 40);
  if (!id) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  const change: Parameters<typeof setProductExtras>[2] = {};
  if ("stock" in body) {
    if (body.stock === null) change.stock = null;
    else {
      const stock = parseStock(body.stock);
      if (stock === null) return Response.json({ ok: false, error: "stock", max: MAX_STOCK }, { status: 400 });
      change.stock = stock;
    }
  }
  if ("bump" in body) {
    if (body.bump === null) change.bump = null;
    else {
      const raw = body.bump && typeof body.bump === "object" ? (body.bump as Record<string, unknown>) : {};
      const productId = text(raw.productId, 40);
      const cents = priceToCents(text(raw.price, 12));
      if (!productId) return Response.json({ ok: false, error: "target" }, { status: 400 });
      if (cents === null || cents < MIN_BUMP_CENTS) return Response.json({ ok: false, error: "price" }, { status: 400 });
      const pitch = text(raw.pitch, 400).replace(/\s+/g, " ").trim().slice(0, 140);
      change.bump = { productId, priceCents: cents, pitch };
    }
  }
  if ("upsell" in body) {
    if (body.upsell === null) change.upsell = null;
    else {
      const raw = body.upsell && typeof body.upsell === "object" ? (body.upsell as Record<string, unknown>) : {};
      const productId = text(raw.productId, 40);
      const cents = priceToCents(text(raw.price, 12));
      if (!productId) return Response.json({ ok: false, error: "target" }, { status: 400 });
      if (cents === null || cents < MIN_BUMP_CENTS) return Response.json({ ok: false, error: "price" }, { status: 400 });
      const pitch = text(raw.pitch, 400).replace(/\s+/g, " ").trim().slice(0, 140);
      change.upsell = { productId, priceCents: cents, pitch };
    }
  }
  if (change.stock === undefined && change.bump === undefined && change.upsell === undefined) {
    return Response.json({ ok: false, error: "unknown" }, { status: 400 });
  }

  try {
    const result = await setProductExtras(guarded.email, id, change);
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, products: result.store.products });
  } catch (error) {
    console.error("saving product extras failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
