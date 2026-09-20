import type { NextRequest } from "next/server";
import { get, issueSignedToken, presignUrl } from "@vercel/blob";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { readOrder } from "@/lib/store-checkout";
import {
  DOWNLOAD_URL_SECONDS,
  REDIRECT_ABOVE_BYTES,
} from "@/lib/product-file";
import { recordDelivery } from "@/lib/delivery";

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

/**
 * A short-lived URL the buyer's browser can fetch straight from storage.
 *
 * Used for large files only. It keeps the bytes out of this function, which
 * halves what delivery costs and removes the time limit a long download on a
 * slow line would otherwise hit. The URL expires in minutes and is signed for
 * one pathname, so forwarding it buys very little.
 */
async function signedDownload(pathname: string): Promise<string | null> {
  try {
    const token = await issueSignedToken({
      pathname,
      operations: ["get"],
      validUntil: Date.now() + DOWNLOAD_URL_SECONDS * 1000,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: "get",
      pathname,
      access: "private",
    });
    return presignedUrl;
  } catch (error) {
    console.error("signing a download failed", error);
    return null;
  }
}

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

  // Big files go straight from storage. Small ones keep coming through here,
  // because that is what lets us set the name it saves as and force a
  // download rather than opening in a tab.
  if (file.bytes > REDIRECT_ABOVE_BYTES) {
    const url = await signedDownload(file.pathname);
    if (!url) return plain(502, "We could not fetch the file right now.");
    await recordDelivery(file.pathname, file.bytes);
    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "private, no-store" },
    });
  }

  try {
    const result = await get(file.pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return plain(404, "The file is not there any more.");
    }

    await recordDelivery(file.pathname, file.bytes);
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
