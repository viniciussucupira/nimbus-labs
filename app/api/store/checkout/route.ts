import { type NextRequest, after } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { canSellProduct, createCheckout } from "@/lib/store-checkout";
import { countHit } from "@/lib/visit";
import { releaseStockHold, withStockHold } from "@/lib/stock";
import { activeUpsell } from "@/lib/product-extras";
import { UPSELL_COOKIE, newUpsellKey } from "@/lib/upsell";

/** The checkout this browser last opened for a limited product. */
const HOLD_COOKIE = "nl_stock_hold";

/**
 * Starts a purchase.
 *
 * The buy button is a plain HTML form, so a store page sells with JavaScript
 * turned off. Nothing here trusts the price or the title the form sends: the
 * product is looked up by id in the store's own record, and the charge is
 * built from that. A form posted from anywhere else can name a product, but
 * never its price.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);

  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (sender && host) {
    try {
      if (new URL(sender).host !== host) {
        return new Response("forbidden", { status: 403 });
      }
    } catch {
      return new Response("forbidden", { status: 403 });
    }
  }

  const away = (path: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${origin}${path}`, "Cache-Control": "no-store" },
    });

  let handle = "";
  let productId = "";
  let optionId = "";
  let bump = false;
  try {
    const form = await request.formData();
    const h = form.get("handle");
    const p = form.get("product");
    // An id, and only an id. The amount that goes to Stripe is read from the
    // option the creator saved, never from this form.
    const o = form.get("option");
    handle = typeof h === "string" ? normaliseHandle(h) : "";
    productId = typeof p === "string" ? p : "";
    optionId = typeof o === "string" ? o : "";
    // Only a ticked box counts. What the addition costs is read from the store.
    bump = form.get("bump") === "yes";
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!handle || !productId) return new Response("Bad request", { status: 400 });

  const store = await storeForHandle(handle);
  if (!store) return new Response("No such store.", { status: 404 });

  const product = store.products.find((item) => item.id === productId);
  if (!product) return away(`/@${store.handle}`);

  // Refused here rather than at Stripe, so a buyer never reaches a card form
  // for something that could not have been delivered anyway.
  if (!canSellProduct(store, product)) return away(`/@${store.handle}`);
  // A call is booked for a time on its own page, never bought without one.
  if (product.call) return away(`/@${store.handle}/book/${product.id}`);

  try {
    // A buyer who went back from Stripe's page hands back the unit they held
    // before holding another.
    const previous = request.cookies.get(HOLD_COOKIE)?.value ?? "";
    if (previous) await releaseStockHold(store, product, previous).catch(() => {});

    // When an upsell follows, this browser gets a secret, and only its
    // fingerprint travels with the charge.
    const upsell = activeUpsell(store.products, product) ? newUpsellKey() : null;
    const held = await withStockHold(store, product, (expiresAt) =>
      createCheckout(store, product, origin, optionId, {
        bump,
        expiresAt: expiresAt || undefined,
        upsellKey: upsell?.fingerprint,
      }),
    );
    if (!held.ok) return away(`/@${store.handle}?status=${held.reason}`);
    // Counted once the buyer is on their way, so the count never slows them.
    after(() => countHit(request, store, { kind: "checkout", id: product.id }));
    const headers = new Headers({ Location: held.value.url, "Cache-Control": "no-store" });
    const secure = origin.startsWith("https://") ? "; Secure" : "";
    if (product.stock !== null) {
      headers.append("Set-Cookie", `${HOLD_COOKIE}=${held.value.id}; Path=/api/store/checkout; Max-Age=1860; HttpOnly; SameSite=Lax${secure}`);
    }
    if (upsell) {
      headers.append("Set-Cookie", `${UPSELL_COOKIE}=${upsell.secret}; Path=/; Max-Age=7200; HttpOnly; SameSite=Lax${secure}`);
    }
    return new Response(null, { status: 303, headers });
  } catch (error) {
    console.error("checkout failed", error);
    return away(`/@${store.handle}/thanks?status=error`);
  }
}
