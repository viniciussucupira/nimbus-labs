import { type NextRequest, after } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { canSellProduct, createCheckout } from "@/lib/store-checkout";
import { countHit } from "@/lib/visit";
import { releaseStockHold, withStockHold } from "@/lib/stock";
import { activePlan, activeUpsell } from "@/lib/product-extras";
import { rememberPlan } from "@/lib/plans";
import { UPSELL_COOKIE, newUpsellKey } from "@/lib/upsell";
import { BUYER_COOKIE, BUYER_COOKIE_SECONDS, newBuyerKey } from "@/lib/learn";
import { canWrite } from "@/lib/mail";

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
  let plan = false;
  let news = false;
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
    // Paying in instalments only when the buyer picked it.
    plan = form.get("pay") === "plan";
    // Only a box the buyer ticked, and only on a store that can write to them.
    news = form.get("news") === "yes";
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
    const inPlan = plan && activePlan(product) !== null;
    const upsell = !inPlan && !store.tax.enabled && activeUpsell(store.products, product) ? newUpsellKey() : null;
    // A course opens straight away in the browser that paid for it.
    const buyer = product.course ? newBuyerKey() : null;
    const held = await withStockHold(store, product, (expiresAt) =>
      createCheckout(store, product, origin, optionId, {
        bump,
        expiresAt: expiresAt || undefined,
        upsellKey: upsell?.fingerprint,
        plan: inPlan,
        buyerKey: buyer?.fingerprint,
        news: news && canWrite(store),
      }),
    );
    if (!held.ok) return away(`/@${store.handle}?status=${held.reason}`);
    // Written down before the buyer leaves, so the plan is given its end
    // whether or not they come back from paying.
    if (inPlan && store.stripeAccountId) await rememberPlan(store.stripeAccountId, held.value.id);
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
    if (buyer) {
      headers.append("Set-Cookie", `${BUYER_COOKIE}=${buyer.secret}; Path=/api/store/course; Max-Age=${BUYER_COOKIE_SECONDS}; HttpOnly; SameSite=Lax${secure}`);
    }
    return new Response(null, { status: 303, headers });
  } catch (error) {
    console.error("checkout failed", error);
    return away(`/@${store.handle}/thanks?status=error`);
  }
}
