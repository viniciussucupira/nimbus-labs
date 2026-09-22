import type { NextRequest } from "next/server";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { readOrder } from "@/lib/store-checkout";
import { plain, serveFile } from "@/lib/serve-file";
import { upsellDelivery } from "@/lib/upsell";

/**
 * Hands the buyer the file they paid for.
 *
 * The only thing that opens this door is a Stripe session that Stripe itself
 * says is paid, checked on every request rather than written down here. The
 * blob's own URL never leaves the server, because a URL that works is a URL
 * that can be forwarded.
 */
const MESSAGES = {
  unpaid: [402, "This order has not been paid."],
  expired: [410, "This download link has expired."],
  invalid: [404, "We could not find this order."],
  unavailable: [503, "This store cannot take payments yet."],
  error: [502, "We could not check this order right now. Please try again."],
} as const;

export async function GET(request: NextRequest) {
  const handle = normaliseHandle(
    request.nextUrl.searchParams.get("handle") ?? "",
  );
  if (!handle) return plain(400, "Which store?");

  const store = await storeForHandle(handle);
  if (!store) return plain(404, "We could not find this store.");

  const order = await readOrder(
    store,
    request.nextUrl.searchParams.get("session_id") ?? undefined,
  );
  if (order.state !== "paid") {
    const [status, message] = MESSAGES[order.state];
    return plain(status, message);
  }

  // The product taken in one click after paying: only once Stripe said so.
  if (request.nextUrl.searchParams.get("item") === "upsell") {
    const added = await upsellDelivery(store, request.nextUrl.searchParams.get("session_id") ?? "");
    if (!added) return plain(404, "This order has nothing added to it.");
    if (!added.file) {
      return plain(added.link ? 409 : 404, added.link ? "This one is not a download. Open the order page again and use the link on it." : "There is no file on this product.");
    }
    return serveFile(added.file);
  }

  // The product added at checkout has its own file, asked for by name.
  if (request.nextUrl.searchParams.get("item") === "bump") {
    if (!order.bump) return plain(404, "This order has nothing added to it.");
    if (!order.bump.file) {
      return plain(order.bump.link ? 409 : 404, order.bump.link ? "This one is not a download. Open the order page again and use the link on it." : "There is no file on this product.");
    }
    return serveFile(order.bump.file);
  }

  // The file of the option that was bought, when the product has options, and
  // the product's own when it does not. Worked out once, in readOrder, so this
  // route and the page the buyer is looking at can never disagree.
  const file = order.file;
  if (!file) {
    // A product that delivers a link has nothing here to send. The buyer is
    // told where it actually is rather than that their purchase is missing.
    if (order.link) {
      return plain(
        409,
        "This product is not a download. Open the order page again and use the link on it.",
      );
    }
    return plain(404, "There is no file on this product.");
  }

  return serveFile(file);
}
