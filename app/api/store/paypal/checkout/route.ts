import { type NextRequest, after } from "next/server";
import { linkOrigin, originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { readListings, readProduct } from "@/lib/catalog";
import { MIN_BUNDLE_ITEMS, deliverableItems } from "@/lib/bundle-rules";
import { clientAddress, fromAnotherSite, limited, withinLimit } from "@/lib/request-guard";
import { isSoon } from "@/lib/waitlist";
import { countHit } from "@/lib/visit";
import { openOrder, paypalReady } from "@/lib/paypal-sales";

/**
 * Starts a purchase paid with PayPal, into the creator's own PayPal account
 * (lib/paypal-sales.ts). A plain form, like the Stripe one: the product is
 * looked up by id in the store's own record and the price read from there,
 * never from the form.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  const away = (path: string) => new Response(null, { status: 303, headers: { Location: `${origin}${path}`, "Cache-Control": "no-store" } });

  let handle = "";
  let productId = "";
  try {
    const form = await (await limited(request, 4_000)).formData();
    const h = form.get("handle");
    const p = form.get("product");
    handle = typeof h === "string" ? normaliseHandle(h) : "";
    productId = typeof p === "string" ? p.slice(0, 64) : "";
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!handle || !productId) return new Response("Bad request", { status: 400 });

  const store = await storeForHandle(handle);
  if (!store) return new Response("No such store.", { status: 404 });
  const product = await readProduct(store, productId);
  if (!product) return away(`/@${store.handle}`);
  if (!(await withinLimit("checkout", `${clientAddress(request)}|${store.handle}`, 20, 600))) return away(`/@${store.handle}?status=slow`);
  if (!paypalReady(store, product)) return away(`/@${store.handle}/p/${product.id}`);
  if (await isSoon(store, product.id).catch(() => false)) return away(`/@${store.handle}/p/${product.id}#waitlist`);
  if (product.bundle && deliverableItems(product, await readListings(store, product.bundle)).length < MIN_BUNDLE_ITEMS) {
    return away(`/@${store.handle}`);
  }
  const opened = await openOrder(store, product, linkOrigin(request, store));
  if (!opened.ok) return away(`/@${store.handle}/p/${product.id}?paypal=error`);
  after(() => countHit(request, store, { kind: "checkout", id: product.id }));
  return new Response(null, { status: 303, headers: { Location: opened.url, "Cache-Control": "no-store" } });
}
