import type { NextRequest } from "next/server";
import { type Product, type Store, normaliseHandle, storeForHandle } from "@/lib/store";
import { readOrder } from "@/lib/store-checkout";
import { plain, serveFile } from "@/lib/serve-file";
import { offerRefunded, upsellDelivery } from "@/lib/upsell";
import { findPurchase, ordersGrant } from "@/lib/buyer-orders";
import { stampedCopy, wantsStamp } from "@/lib/pdf-stamp";
import { renewPath } from "@/lib/membership-access";
import { originFrom } from "@/lib/request-origin";
import type { ProductFile } from "@/lib/product-file";

/**
 * Hands the buyer the file they paid for.
 *
 * The only thing that opens this door is a Stripe session that Stripe itself
 * says is paid, checked on every request rather than written down here. The
 * blob's own URL never leaves the server, because a URL that works is a URL
 * that can be forwarded.
 *
 * A membership's file is handed over only while the membership runs, which is
 * read from Stripe in the same request; once it has ended the buyer is sent
 * to a page that says so and offers the way back (lib/membership-access.ts).
 *
 * A PDF on a product whose creator switched stamping on goes out with the
 * buyer's email on every page (lib/pdf-stamp.ts), which can take a few
 * seconds the first time for a big book: hence the longer time limit.
 */
export const maxDuration = 60;

const MESSAGES = {
  unpaid: [402, "This order has not been paid."],
  processing: [402, "This payment is still being confirmed by the bank. Try again once it clears."],
  expired: [410, "This download link has expired."],
  invalid: [404, "We could not find this order."],
  unavailable: [503, "This store cannot take payments yet."],
  error: [502, "We could not check this order right now. Please try again."],
  refunded: [410, "This order was refunded in full, so its download is closed."],
} as const;

/** The file, stamped with its buyer's email when the product asks for it. */
async function deliver(
  product: Product,
  file: ProductFile,
  sale: { reference: string; email: string | null; paidAt: number },
): Promise<Response> {
  if (wantsStamp(product.stamp, file) && sale.email) {
    const copy = await stampedCopy(file, { reference: sale.reference, email: sale.email, paidAt: sale.paidAt });
    if (copy) return serveFile(copy);
  }
  return serveFile(file);
}

function toRenew(request: NextRequest, store: Store, product: Pick<Product, "id">): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `${originFrom(request)}${renewPath(store, product)}`, "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const handle = normaliseHandle(
    request.nextUrl.searchParams.get("handle") ?? "",
  );
  if (!handle) return plain(400, "Which store?");

  const store = await storeForHandle(handle);
  if (!store) return plain(404, "We could not find this store.");

  // Asked for again from the emailed list of purchases: the link's address
  // must still have paid for this one, by Stripe's account of it right now.
  const token = request.nextUrl.searchParams.get("token");
  if (token) {
    let purchase;
    let email: string | null = null;
    try {
      purchase = await findPurchase(store, token, request.nextUrl.searchParams.get("ref") ?? "");
      email = await ordersGrant(store, token);
    } catch (error) {
      console.error("looking up a purchase failed", error);
      return plain(502, "We could not check this purchase right now. Please try again.");
    }
    if (!purchase) {
      return plain(410, "This link has expired, or this purchase is not on it. Ask the store for a new link to your purchases.");
    }
    if (purchase.ended) return toRenew(request, store, { id: purchase.productId });
    const bumped = request.nextUrl.searchParams.get("item") === "bump";
    const delivery = bumped ? purchase.bump : purchase.main;
    if (!delivery) return plain(404, "There is nothing to download on this one.");
    if (!delivery.file) {
      return plain(409, "This one is not a download. Open your purchases again and use the link on it.");
    }
    const owner = store.products.find((p) => p.id === (bumped ? purchase.bumpId : purchase.productId));
    if (!owner) return serveFile(delivery.file);
    return deliver(owner, delivery.file, { reference: purchase.reference, email, paidAt: purchase.paidAt });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  const order = await readOrder(store, sessionId || undefined);
  if (order.state !== "paid") {
    const [status, message] = MESSAGES[order.state];
    return plain(status, message);
  }
  // A membership that has ended hands nothing over any more.
  if (order.membership === "ended") return toRenew(request, store, order.product);
  const sale = { reference: order.reference, email: order.email, paidAt: order.created };

  // A product taken in one click after paying: only once Stripe said so.
  // `step` names which offer, and is left out for the first.
  if (request.nextUrl.searchParams.get("item") === "upsell") {
    const added = await upsellDelivery(
      store,
      request.nextUrl.searchParams.get("session_id") ?? "",
      request.nextUrl.searchParams.get("step") ?? "",
    );
    if (!added) return plain(404, "This order has nothing added to it.");
    // Its own payment, refunded in full since, hands nothing over any more.
    try {
      if (await offerRefunded(store, added.reference)) return plain(410, "This added product was refunded in full, so its download is closed.");
    } catch (error) {
      console.error("checking an added product failed", error);
      return plain(502, "We could not check this order right now. Please try again.");
    }
    if (!added.file) {
      return plain(added.link ? 409 : 404, added.link ? "This one is not a download. Open the order page again and use the link on it." : "There is no file on this product.");
    }
    return deliver(added.product, added.file, { ...sale, reference: added.reference, paidAt: added.paidAt });
  }

  // The product added at checkout has its own file, asked for by name.
  if (request.nextUrl.searchParams.get("item") === "bump") {
    if (!order.bump) return plain(404, "This order has nothing added to it.");
    if (!order.bump.file) {
      return plain(order.bump.link ? 409 : 404, order.bump.link ? "This one is not a download. Open the order page again and use the link on it." : "There is no file on this product.");
    }
    return deliver(order.bump.product, order.bump.file, sale);
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

  return deliver(order.product, file, sale);
}
