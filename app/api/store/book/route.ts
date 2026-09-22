import { type NextRequest, after } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { canSellProduct } from "@/lib/store-checkout";
import { holdAndCheckout, isCallProduct, releaseOwnHold } from "@/lib/calls";
import { countHit } from "@/lib/visit";

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

  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (sender && host) {
    try {
      if (new URL(sender).host !== host) return new Response("forbidden", { status: 403 });
    } catch {
      return new Response("forbidden", { status: 403 });
    }
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return new Response("Too large", { status: 413 });
  }

  let handle = "";
  let productId = "";
  let start = NaN;
  let tz = "";
  try {
    const form = await request.formData();
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
  const product = store.products.find((item) => item.id === productId);
  if (!product || !isCallProduct(product)) {
    return new Response(null, { status: 303, headers: { Location: `${origin}/@${store.handle}` } });
  }

  const back = (status: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${origin}/@${store.handle}/book/${product.id}?status=${status}`, "Cache-Control": "no-store" },
    });

  if (!canSellProduct(store, product)) return back("unavailable");
  if (!Number.isFinite(start)) return back("invalid");

  // A buyer who went back from Stripe's page to pick again lets go of the
  // time they were holding, after that checkout is closed at Stripe.
  const previous = request.cookies.get(HOLD_COOKIE)?.value ?? "";
  if (previous) await releaseOwnHold(store, previous).catch(() => {});

  const result = await holdAndCheckout({ store, product, start, buyerTz: tz, origin });
  if (!result.ok) return back(result.reason);
  after(() => countHit(request, store, { kind: "checkout", id: product.id }));
  const secure = origin.startsWith("https://") ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: result.url,
      "Cache-Control": "no-store",
      "Set-Cookie": `${HOLD_COOKIE}=${result.session}; Path=/api/store/book; Max-Age=1860; HttpOnly; SameSite=Lax${secure}`,
    },
  });
}
