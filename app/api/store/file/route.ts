import type { NextRequest } from "next/server";
import { readKind } from "@/lib/catalog";
import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { studioAccess } from "@/lib/studio-route";
import { ownsDeliveryId, storeFolder } from "@/lib/store";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_BYTES,
  ownsPath,
} from "@/lib/product-file";
import { ITEM_ID_PATTERN, findLesson, readCourses } from "@/lib/course";
import { fromAnotherSite, limited } from "@/lib/request-guard";

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
      // The docs are explicit that this is where a route like ours has to
      // prove who is asking. Everything below runs before any URL is signed.
      getSignedToken: async (pathname, clientPayload) => {
        // Who, which store and whether their role has "products"
        // (lib/studio-route.ts); the folder below is that store's own.
        const access = await studioAccess(request, "products");
        if (!access.ok) throw new Error(access.reason === "no_store" ? "none" : access.reason);
        const { store, ref } = access.access;

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
        // is unique across the store, so one check covers both. A lesson of
        // one of the store's courses owns one too.
        if (!ownsDeliveryId(store, productId)) {
          const courseIds = (await readKind(store, "course")).flatMap((p) => (p.course ? [p.course.id] : []));
          const courses = ITEM_ID_PATTERN.test(productId) ? await readCourses(courseIds) : new Map();
          const isLesson = [...courses.values()].some((course) => findLesson(course, productId) !== null);
          if (!isLesson) throw new Error("unknown");
        }

        const folder = await storeFolder(ref);
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
    const known = ["signed_out", "none", "unknown", "invalid", "forbidden", "gone"].includes(reason);
    if (!known) console.error("signing an upload failed", error);
    return Response.json(
      { ok: false, error: known ? reason : "server_error" },
      { status: reason === "signed_out" ? 401 : reason === "forbidden" || reason === "gone" ? 403 : known ? 400 : 500 },
    );
  }
}
