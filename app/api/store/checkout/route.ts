import { startGift } from "@/lib/gifts";
import { isSoon } from "@/lib/waitlist";
import { type NextRequest, after } from "next/server";
import { linkOrigin, originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle, syncTakesBuyer } from "@/lib/store";
import { canSellProduct, createCheckout } from "@/lib/store-checkout";
import { countHit } from "@/lib/visit";
import { releaseStockHold, withStockHold } from "@/lib/stock";
import { activePlan } from "@/lib/product-extras";
import { activeFunnel, funnelProductIds } from "@/lib/funnel";
import { affiliateCookieName, attributionFor } from "@/lib/affiliates";
import { viaCookieName } from "@/lib/affiliate-setting";
import { rememberPlan } from "@/lib/plans";
import { UPSELL_COOKIE, newUpsellKey } from "@/lib/upsell";
import { HOLD_SECONDS } from "@/lib/stripe-account";
import { BUYER_COOKIE, BUYER_COOKIE_SECONDS, newBuyerKey } from "@/lib/learn";
import { canWrite } from "@/lib/mail";
import { outOfKeys } from "@/lib/licence-keys";
import { clientAddress, fromAnotherSite, limited, withinLimit } from "@/lib/request-guard";
import { readListings, readProduct } from "@/lib/catalog";
import { MIN_BUNDLE_ITEMS, deliverableItems } from "@/lib/bundle-rules";
import { cameFrom } from "@/lib/came-from";
import { codeCookieName, readLinkCode } from "@/lib/code-link";

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

  // Refused before anything else is read: another site, by Origin or by
  // Sec-Fetch-Site (lib/request-guard.ts).
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });

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
  // Bought for somebody else (lib/gifts.ts): who, from whom, and a message.
  let giftTo = "";
  let giftFrom = "";
  let giftMessage = "";
  try {
    const form = await (await limited(request, 8_000)).formData();
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
    const read = (name: string, max: number) => {
      const value = form.get(name);
      return typeof value === "string" ? value.slice(0, max) : "";
    };
    giftTo = read("gift_to", 300);
    giftFrom = read("gift_from", 200);
    giftMessage = read("gift_message", 2_000);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!handle || !productId) return new Response("Bad request", { status: 400 });

  const store = await storeForHandle(handle);
  if (!store) return new Response("No such store.", { status: 404 });

  // In full: the checkout asks its questions and may be followed by offers.
  const product = await readProduct(store, productId);
  if (!product) return away(`/@${store.handle}`);

  // Each press opens a checkout on the creator's Stripe account and may hold
  // a limited unit for half an hour, so one connection gets twenty in ten
  // minutes per store: far past any buyer, and short of a script holding
  // every unit to keep real buyers out.
  if (!(await withinLimit("checkout", `${clientAddress(request)}|${store.handle}`, 20, 600))) {
    return away(`/@${store.handle}?status=slow`);
  }

  // Refused here rather than at Stripe, so a buyer never reaches a card form
  // for something that could not have been delivered anyway.
  if (!canSellProduct(store, product)) return away(`/@${store.handle}`);
  // Coming soon: its page takes a waitlist sign-up, and no checkout opens (lib/waitlist.ts).
  if (await isSoon(store, product.id).catch(() => false)) return away(`/@${store.handle}/p/${product.id}#waitlist`);
  // A bundle that holds too little that can be handed over right now is not sold.
  if (product.bundle && deliverableItems(product, await readListings(store, product.bundle)).length < MIN_BUNDLE_ITEMS) {
    return away(`/@${store.handle}`);
  }
  // A call is booked for a time on its own page, never bought without one.
  if (product.call) return away(`/@${store.handle}/book/${product.id}`);
  // Every license key in the pool is given: nobody is charged for one that
  // does not exist. The creator was emailed when the pool ran low.
  if (await outOfKeys(store, product).catch(() => false)) return away(`/@${store.handle}?status=soldout`);

  // A gift: written down before its checkout opens, and its checkout is one
  // plain payment with nothing added and no offer after it.
  let gift: string | undefined;
  if (giftTo.trim()) {
    const started = await startGift(store, product, { to: giftTo, from: giftFrom, message: giftMessage }).catch(() => null);
    if (!started) return away(`/@${store.handle}?status=error`);
    if (!started.ok) return away(`/@${store.handle}/p/${product.id}?gift=${started.reason}#gift`);
    gift = started.gift.id;
  }

  try {
    // A buyer who went back from Stripe's page hands back the unit they held
    // before holding another.
    const previous = request.cookies.get(HOLD_COOKIE)?.value ?? "";
    if (previous) await releaseStockHold(store, product, previous).catch(() => {});

    // When offers follow the payment, this browser gets a secret, and only
    // its fingerprint travels with the charge.
    const inPlan = !gift && plan && activePlan(product) !== null;
    const upsell = !gift && !inPlan && !store.tax.enabled && activeFunnel(await readListings(store, funnelProductIds(product.funnel)), product) ? newUpsellKey() : null;
    // Sent by an affiliate within the store's window: credited to them. A
    // lookup that fails never stops the sale; it is only not credited.
    const via = await attributionFor(store, product.id, {
      via: request.cookies.get(viaCookieName(store.handle))?.value,
      session: request.cookies.get(affiliateCookieName(store.handle))?.value,
    }).catch(() => null);
    // A course opens right away in the browser that paid for it.
    // So does a course in a bundle.
    const buyer = !gift && (product.course || product.bundle) ? newBuyerKey() : null;
    const held = await withStockHold(store, product, (holding) =>
      createCheckout(store, product, linkOrigin(request, store), optionId, {
        bump,
        held: holding,
        upsellKey: upsell?.fingerprint,
        plan: inPlan,
        buyerKey: buyer?.fingerprint,
        // Kept only where the box was offered: the creator writes to their
        // list here, or sends this product's buyers to their email platform.
        news: news && (canWrite(store) || syncTakesBuyer(store, product.id)),
        via,
        gift,
        // Which of the creator's links this sale came from, read off the page
        // the button was pressed on (lib/came-from.ts). Nothing is stored and
        // nobody is identified: the tag rides to Stripe with the payment.
        cameFrom: cameFrom(request.headers.get("referer"), new URL(origin).hostname),
        // A code that came in a link to this store (lib/code-link.ts), applied
        // by Stripe only if it is one of the creator's live codes.
        code: readLinkCode(request.cookies.get(codeCookieName(store.handle))?.value) || undefined,
      }),
    );
    if (!held.ok) return away(`/@${store.handle}?status=${held.reason}`);
    // Written down before the buyer leaves, so the plan — or a membership that
    // ends after a set number of payments — is given its end whether or not
    // they come back from paying.
    const ends = inPlan || (product.recurring !== null && product.recurring.payments > 0);
    if (ends && store.stripeAccountId) await rememberPlan(store.stripeAccountId, held.value.id);
    // Counted once the buyer is on their way, so the count never slows them.
    after(() => countHit(request, store, { kind: "checkout", id: product.id }));
    const headers = new Headers({ Location: held.value.url, "Cache-Control": "no-store" });
    const secure = origin.startsWith("https://") ? "; Secure" : "";
    if (product.stock !== null) {
      headers.append("Set-Cookie", `${HOLD_COOKIE}=${held.value.id}; Path=/api/store/checkout; Max-Age=${HOLD_SECONDS}; HttpOnly; SameSite=Lax${secure}`);
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
    return away(`/@${store.handle}?status=error`);
  }
}
