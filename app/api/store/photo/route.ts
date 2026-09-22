import type { NextRequest } from "next/server";
import { setPhotoId, storeForEmail } from "@/lib/store";
import {
  MAX_PHOTO_BYTES,
  decodePhoto,
  deletePhoto,
  writePhoto,
} from "@/lib/store-photo";
import { guardStoreWrite } from "@/lib/store-request";

/**
 * Puts a photo on the creator's page, or takes it off.
 *
 * The body is JSON: `{ "photo": "<base64>" }` to set one, `{ "remove": true }`
 * to clear it. The size cap is checked before the body is read, and what the
 * bytes are is decided by the bytes themselves.
 *
 * The new picture is written and the store pointed at it before the old one is
 * deleted, so the page never points at a photo that is not there.
 */
export async function POST(request: NextRequest) {
  // Base64 is a third bigger than the bytes it carries, plus the JSON around it.
  const guarded = await guardStoreWrite(request, Math.ceil(MAX_PHOTO_BYTES * 1.4) + 1_000);
  if (!guarded.ok) return guarded.response;

  try {
    if (guarded.body.remove === true) {
      const result = await setPhotoId(guarded.email, null);
      if (!result.ok) {
        return Response.json({ ok: false, error: result.reason }, { status: 400 });
      }
      await deletePhoto(result.was);
      return Response.json({ ok: true, photoId: null });
    }

    const decoded = decodePhoto(guarded.body.photo);
    if (typeof decoded === "string") {
      return Response.json(
        { ok: false, error: decoded },
        { status: decoded === "too_big" ? 413 : 400 },
      );
    }

    // Checked before anything is written, so a signed-in account without a
    // store cannot fill Redis with pictures that belong to nothing.
    if (!(await storeForEmail(guarded.email))) {
      return Response.json({ ok: false, error: "none" }, { status: 400 });
    }

    const id = await writePhoto(decoded.bytes, decoded.type);
    const result = await setPhotoId(guarded.email, id);
    if (!result.ok) {
      await deletePhoto(id);
      return Response.json({ ok: false, error: result.reason }, { status: 400 });
    }
    await deletePhoto(result.was);
    return Response.json({ ok: true, photoId: id });
  } catch (error) {
    console.error("saving the store photo failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
