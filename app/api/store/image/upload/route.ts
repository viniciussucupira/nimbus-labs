import type { NextRequest } from "next/server";
import { hasProduct } from "@/lib/catalog";
import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { studioAccess } from "@/lib/studio-route";
import { imageFolder } from "@/lib/store";
import { IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES, ownsImagePath } from "@/lib/product-image";
import { fromAnotherSite, limited } from "@/lib/request-guard";

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
  // Refused before anything else is read: another site, by Origin or by
  // Sec-Fetch-Site (lib/request-guard.ts).
  if (fromAnotherSite(request)) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: HandleUploadPresignedBody;
  try {
    body = (await (await limited(request, 16_000)).json()) as HandleUploadPresignedBody;
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  try {
    const answer = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        // Who, which store and whether their role has "products"
        // (lib/studio-route.ts); the folder below is that store's own.
        const access = await studioAccess(request, "products");
        if (!access.ok) throw new Error(access.reason === "no_store" ? "none" : access.reason);
        const { store, ref } = access.access;

        let productId = "";
        try {
          const parsed = JSON.parse(clientPayload ?? "{}") as { productId?: unknown };
          productId = typeof parsed.productId === "string" ? parsed.productId : "";
        } catch {
          throw new Error("invalid");
        }
        // A picture belongs to a product of this store, never to an option.
        if (!hasProduct(store, productId)) throw new Error("unknown");
        if (!ownsImagePath(pathname, await imageFolder(ref))) throw new Error("invalid");

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
    const known = ["signed_out", "none", "unknown", "invalid", "forbidden", "gone"].includes(reason);
    if (!known) console.error("signing a picture upload failed", error);
    return Response.json(
      { ok: false, error: known ? reason : "server_error" },
      { status: reason === "signed_out" ? 401 : reason === "forbidden" || reason === "gone" ? 403 : known ? 400 : 500 },
    );
  }
}
