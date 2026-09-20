import type { NextRequest } from "next/server";
import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { ownsDeliveryId, storeForEmail, storeFolder } from "@/lib/store";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_BYTES,
  ownsPath,
} from "@/lib/product-file";

/** How long the creator has to start the upload after asking for the door. */
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

/**
 * Hands the browser a one-off, time-limited door into the private file store.
 *
 * The file never passes through this server. The browser asks here, we check
 * that the person is signed in and that the path they want is inside their own
 * folder, and we sign a URL that accepts one upload of one kind of file up to
 * one size. Everything the signature allows is spelled out in it, so the door
 * cannot be widened by whoever holds it.
 *
 * This route is also where Vercel posts back when an upload finishes. That
 * message carries no session, and is trusted only because it is signed; the
 * signature is checked by the SDK against the store's public key. We do not
 * act on it — the browser tells us about its own upload, and that claim is
 * checked against the store before anything is saved — so it exists here only
 * to be answered politely rather than retried five times.
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
      // The docs are explicit that this is where a route like ours has to
      // prove who is asking. Everything below runs before any URL is signed.
      getSignedToken: async (pathname, clientPayload) => {
        const email = await emailForSession(
          request.cookies.get(SESSION_COOKIE)?.value,
        );
        if (!email) throw new Error("signed_out");

        const store = await storeForEmail(email);
        if (!store) throw new Error("none");

        let productId = "";
        try {
          const parsed = JSON.parse(clientPayload ?? "{}") as {
            productId?: unknown;
          };
          productId = typeof parsed.productId === "string" ? parsed.productId : "";
        } catch {
          throw new Error("invalid");
        }
        // A price option owns a folder exactly as a product does, and its id
        // is unique across the store, so one check covers both.
        if (!ownsDeliveryId(store, productId)) throw new Error("unknown");

        const folder = await storeFolder(email);
        if (!ownsPath(pathname, folder, productId)) throw new Error("invalid");

        return {
          // Scoped to this one path, so the token cannot sign anything else.
          // There is nothing to cache: a token that fits one upload fits no
          // other one.
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_FILE_BYTES,
            validUntil: Date.now() + UPLOAD_WINDOW_MS,
          }),
          urlOptions: {
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_FILE_BYTES,
            validUntil: Date.now() + UPLOAD_WINDOW_MS,
            // Two files of the same name never fight, and an upload can never
            // quietly replace something that is already selling.
            addRandomSuffix: true,
            allowOverwrite: false,
          },
        };
      },
    });

    return Response.json(answer);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "server_error";
    const known = ["signed_out", "none", "unknown", "invalid"].includes(reason);
    if (!known) console.error("signing an upload failed", error);
    return Response.json(
      { ok: false, error: known ? reason : "server_error" },
      { status: reason === "signed_out" ? 401 : known ? 400 : 500 },
    );
  }
}
