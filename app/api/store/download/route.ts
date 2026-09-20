import type { NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { readOrder } from "@/lib/store-checkout";

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

const plain = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });

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

  const file = order.product.file;
  if (!file) {
    // A product that delivers a link has nothing here to send. The buyer is
    // told where it actually is rather than that their purchase is missing.
    if (order.product.link) {
      return plain(
        409,
        "This product is not a download. Open the order page again and use the link on it.",
      );
    }
    return plain(404, "There is no file on this product.");
  }

  try {
    const result = await get(file.pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return plain(404, "The file is not there any more.");
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("serving a paid file failed", error);
    return plain(502, "We could not fetch the file right now.");
  }
}
