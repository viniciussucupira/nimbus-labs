import { isSoon } from "@/lib/waitlist";
import { type NextRequest, after } from "next/server";
import { linkOrigin, originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { canSellProduct } from "@/lib/store-checkout";
import { holdAndCheckout, isCallProduct, releaseOwnHold } from "@/lib/calls";
import { countHit } from "@/lib/visit";
import { HOLD_SECONDS } from "@/lib/stripe-account";
import { affiliateCookieName, attributionFor } from "@/lib/affiliates";
import { viaCookieName } from "@/lib/affiliate-setting";
import { clientAddress, fromAnotherSite, limited, withinLimit } from "@/lib/request-guard";
import { readProduct } from "@/lib/catalog";

/** The checkout this browser last opened for a call, so going back frees it. */
const HOLD_COOKIE = "nl_call_hold";

const MAX_BODY_BYTES = 1_000;

/**
 * A buyer picked a time. It is checked again, held, and the buyer is sent to
 * Stripe to pay on the creator's own account.
 *
 * The time is the only thing read from the form besides the ids; the price is
 * the creator's, read from their record here.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);

  // Refused before anything else is read: another site, by Origin or by
  // Sec-Fetch-Site (lib/request-guard.ts).
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return new Response("Too large", { status: 413 });
  }

  let handle = "";
  let productId = "";
  let start = NaN;
  let tz = "";
  try {
    const form = await (await limited(request, MAX_BODY_BYTES)).formData();
    const read = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    handle = normaliseHandle(read("handle"));
    productId = read("product").slice(0, 40);
    const rawStart = read("start");
    start = /^\d{12,14}$/.test(rawStart) ? Number(rawStart) : NaN;
    tz = read("tz").slice(0, 64);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!handle || !productId) return new Response("Bad request", { status: 400 });

  const store = await storeForHandle(handle);
  if (!store) return new Response("No such store.", { status: 404 });
  // In full: the questions the creator asks are put on the checkout.
  const product = await readProduct(store, productId);
  if (!product || !isCallProduct(product)) {
    return new Response(null, { status: 303, headers: { Location: `${origin}/@${store.handle}` } });
  }

  const back = (status: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${origin}/@${store.handle}/book/${product.id}?status=${status}`, "Cache-Control": "no-store" },
    });

  if (!canSellProduct(store, product)) return back("unavailable");
  if (await isSoon(store, product.id).catch(() => false)) return back("unavailable");
  if (!Number.isFinite(start)) return back("invalid");
  // Each try holds a time for half an hour while Stripe's page is open, so
  // one connection gets fifteen in ten minutes per store: enough to change
  // one's mind many times, not enough to hold a creator's whole week.
  if (!(await withinLimit("book", `${clientAddress(request)}|${store.handle}`, 15, 600))) return back("slow");

  // A buyer who went back from Stripe's page to pick again lets go of the
  // time they were holding, after that checkout is closed at Stripe.
  const previous = request.cookies.get(HOLD_COOKIE)?.value ?? "";
  if (previous) await releaseOwnHold(store, previous).catch(() => {});

  // Sent by an affiliate within the store's window: credited to them.
  const via = await attributionFor(store, product.id, {
    via: request.cookies.get(viaCookieName(store.handle))?.value,
    session: request.cookies.get(affiliateCookieName(store.handle))?.value,
  }).catch(() => null);
  const result = await holdAndCheckout({ store, product, start, buyerTz: tz, origin: linkOrigin(request, store), via });
  if (!result.ok) return back(result.reason);
  after(() => countHit(request, store, { kind: "checkout", id: product.id }));
  const secure = origin.startsWith("https://") ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: result.url,
      "Cache-Control": "no-store",
      "Set-Cookie": `${HOLD_COOKIE}=${result.session}; Path=/api/store/book; Max-Age=${HOLD_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
    },
  });
}
