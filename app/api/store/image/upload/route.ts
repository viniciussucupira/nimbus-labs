import type { NextRequest } from "next/server";
import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { imageFolder, storeForEmail } from "@/lib/store";
import { IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES, ownsImagePath } from "@/lib/product-image";

/** How long the creator has to start the upload after asking for the door. */
const UPLOAD_WINDOW_MS = 5 * 60 * 1000;

/**
 * Hands the browser a one-off door into the file store for one product
 * picture.
 *
 * The same shape as the door for paid files (app/api/store/file), made
 * narrower: the path has to be a fresh name in this account's own picture
 * folder, the file has to be a JPEG or a WebP, and it may weigh a megabyte at
 * most. Everything the signature allows is spelled out in it, and nothing
 * can be written over, so the door cannot be used to replace a picture that
 * is already on somebody's page.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    } catch {
      return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  try {
    const answer = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const email = await emailForSession(request.cookies.get(SESSION_COOKIE)?.value);
        if (!email) throw new Error("signed_out");
        const store = await storeForEmail(email);
        if (!store) throw new Error("none");

        let productId = "";
        try {
          const parsed = JSON.parse(clientPayload ?? "{}") as { productId?: unknown };
          productId = typeof parsed.productId === "string" ? parsed.productId : "";
        } catch {
          throw new Error("invalid");
        }
        // A picture belongs to a product of this store, never to an option.
        if (!store.products.some((product) => product.id === productId)) throw new Error("unknown");
        if (!ownsImagePath(pathname, await imageFolder(email))) throw new Error("invalid");

        const rules = {
          allowedContentTypes: [...IMAGE_CONTENT_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          validUntil: Date.now() + UPLOAD_WINDOW_MS,
        };
        return {
          token: await issueSignedToken({ pathname, operations: ["put"], ...rules }),
          urlOptions: { ...rules, addRandomSuffix: false, allowOverwrite: false },
        };
      },
    });
    return Response.json(answer);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "server_error";
    const known = ["signed_out", "none", "unknown", "invalid"].includes(reason);
    if (!known) console.error("signing a picture upload failed", error);
    return Response.json(
      { ok: false, error: known ? reason : "server_error" },
      { status: reason === "signed_out" ? 401 : known ? 400 : 500 },
    );
  }
}
