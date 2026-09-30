import type { NextRequest } from "next/server";
import { setStoreSale, storeForEmail } from "@/lib/store";
import { MAX_SALE_DAYS, MAX_SALE_NAME, MAX_SALE_PRODUCTS, NO_SALE, SALE_PERCENTS } from "@/lib/store-sale";
import { StripeError, onAccount } from "@/lib/stripe-account";
import { guardStoreWrite } from "@/lib/store-request";

/**
 * Starts, changes or stops the store-wide sale (lib/store-sale.ts).
 *
 * `{ percent, starts, ends, name, all, products }` sets it; `{ percent: 0 }`
 * stops it at once. The coupon is made on the creator's own Stripe account
 * when it is saved, with the sale's end as the last moment Stripe will take
 * it, so the end on the page is an end Stripe keeps too.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings", 16_000);
  if (!guarded.ok) return guarded.response;
  const body = guarded.body;
  const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
  const now = Math.floor(Date.now() / 1000);
  try {
    const store = await storeForEmail(guarded.ref);
    if (!store) return fail("none");
    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, MAX_SALE_NAME) : "";
    const percent = Number(body.percent);
    if (!percent) {
      const result = await setStoreSale(guarded.ref, { ...NO_SALE, name: name || store.sale.name });
      return result.ok ? Response.json({ ok: true, sale: result.store.sale }) : fail(result.reason);
    }
    if (!(SALE_PERCENTS as readonly number[]).includes(percent)) return fail("percent");
    const starts = Math.max(now, Math.floor(Number(body.starts) || now));
    const ends = Math.floor(Number(body.ends));
    if (!(ends > now + 600)) return fail("ends");
    if (!(ends > starts + 3_600)) return fail("short");
    if (ends - starts > MAX_SALE_DAYS * 86_400) return fail("long");
    const all = body.all !== false;
    const ids = new Set(store.catalog.items.map((item) => item.id));
    const products = all
      ? []
      : (Array.isArray(body.products) ? body.products : []).filter((p): p is string => typeof p === "string" && ids.has(p)).slice(0, MAX_SALE_PRODUCTS);
    if (!all && products.length === 0) return fail("products");
    if (!store.stripeAccountId) return fail("stripe");

    const made = await onAccount(
      "POST",
      store.stripeAccountId,
      "/coupons",
      new URLSearchParams({
        percent_off: String(percent),
        duration: "once",
        redeem_by: String(ends),
        name: (name ? `${name}: ${percent}% off` : `Store sale: ${percent}% off`).slice(0, 40),
        "metadata[made_by]": "nimbus-labs",
        "metadata[purpose]": "store-sale",
      }),
    );
    const coupon = typeof made.id === "string" ? made.id : "";
    if (!coupon) return fail("stripe_refused", 502);
    const result = await setStoreSale(guarded.ref, { name, percent, starts, ends, all, products, coupon });
    return result.ok ? Response.json({ ok: true, sale: result.store.sale }) : fail(result.reason);
  } catch (error) {
    if (error instanceof StripeError) {
      console.error("making the sale's coupon failed", error);
      return fail("stripe_refused", 502);
    }
    console.error("saving the sale failed", error);
    return fail("server_error", 500);
  }
}
