import type { NextRequest } from "next/server";
import { setProductExtras } from "@/lib/store";
import { MAX_STOCK, parsePlan, parseStock } from "@/lib/product-extras";
import { guardStoreWrite, text } from "@/lib/store-request";
import { StoreFullError } from "@/lib/store";
import { currencyRule, readMoney } from "@/lib/money";

/**
 * Sets or clears a product's limited quantity or its order bump.
 *
 * `{ id, stock: 50 }` or `{ id, stock: null }`;
 * `{ id, bump: { productId, price: "9", pitch } }` or `{ id, bump: null }`;
 * `{ id, plan: { payments: 3, interval: "month", price: "110" } }` or `{ id, plan: null }`.
 * The price is read as text, like every other price the studio sends, in the
 * store's own currency (lib/money.ts).
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "products", 2_000);
  if (!guarded.ok) return guarded.response;
  const body = guarded.body;
  const id = text(body.id, 40);
  if (!id) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  // Prices are typed in the store's currency; the smallest charge is its own.
  const currency = guarded.store.currency;
  const least = currencyRule(currency).minCharge;

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
      const cents = readMoney(text(raw.price, 12), currency);
      if (!productId) return Response.json({ ok: false, error: "target" }, { status: 400 });
      if (cents === null || cents < least) return Response.json({ ok: false, error: "price" }, { status: 400 });
      const pitch = text(raw.pitch, 400).replace(/\s+/g, " ").trim().slice(0, 140);
      change.bump = { productId, priceCents: cents, pitch };
    }
  }
  if ("plan" in body) {
    if (body.plan === null) change.plan = null;
    else {
      const raw = body.plan && typeof body.plan === "object" ? (body.plan as Record<string, unknown>) : {};
      const cents = readMoney(text(raw.price, 12), currency);
      const plan = parsePlan({ payments: Number(raw.payments), interval: raw.interval, amountCents: cents ?? NaN });
      if (!plan || plan.amountCents < least) return Response.json({ ok: false, error: "plan" }, { status: 400 });
      change.plan = plan;
    }
  }
  if (change.stock === undefined && change.bump === undefined && change.plan === undefined) {
    return Response.json({ ok: false, error: "unknown" }, { status: 400 });
  }

  try {
    const result = await setProductExtras(guarded.ref, id, change);
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, product: result.product });
  } catch (error) {
    if (error instanceof StoreFullError) {
      return Response.json({ ok: false, error: "store_full" }, { status: 409 });
    }
    console.error("saving product extras failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
