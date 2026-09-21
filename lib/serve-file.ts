/**
 * Handing a stored file to whoever has earned it.
 *
 * Two doors lead here — a paid order and a free copy asked for by email — and
 * both decide for themselves whether the person in front of them may have the
 * file. What happens after that decision is the same for both, so it lives in
 * one place: a door that serves files its own way is a door that one day
 * serves them differently.
 */
import { get, issueSignedToken, presignUrl } from "@vercel/blob";
import {
  DOWNLOAD_URL_SECONDS,
  REDIRECT_ABOVE_BYTES,
  type ProductFile,
} from "@/lib/product-file";
import { recordDelivery } from "@/lib/delivery";

/** A short answer in plain text, never cached and never indexed. */
export function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * A short-lived URL the browser can fetch straight from storage.
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

/**
 * Sends the file, or the answer that says why it could not be sent.
 *
 * Big files go straight from storage. Small ones come through here, because
 * that is what lets us set the name it saves as and force a download rather
 * than opening in a tab. Either way the delivery is counted against the
 * store's month, since that is the one cost that grows with use.
 */
export async function serveFile(file: ProductFile): Promise<Response> {
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
    console.error("serving a file failed", error);
    return plain(502, "We could not fetch the file right now.");
  }
}
