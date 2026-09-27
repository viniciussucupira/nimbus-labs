import type { NextRequest } from "next/server";
import { del, get, head } from "@vercel/blob";
import {
  StoreFullError,
  imageFolder,
  setImageAlt,
  setProductDisplay,
  setProductImage,
  storeForEmail,
} from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import {
  IMAGE_CONTENT_TYPES,
  MAX_ALT_LENGTH,
  MAX_IMAGE_BYTES,
  type ProductImage,
  isDisplayStyle,
  ownsImagePath,
} from "@/lib/product-image";
import { sniffPhotoType } from "@/lib/store-photo";

const ACTIONS = new Set(["attach", "remove", "alt", "display"]);

/** The first bytes of a stored picture, to see what it really is. */
async function firstBytes(path: string): Promise<Uint8Array | null> {
  const found = await get(path, { access: "private" });
  if (!found || found.statusCode !== 200 || !found.stream) return null;
  const reader = found.stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < 16) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    length += value.length;
  }
  await reader.cancel().catch(() => {});
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

/**
 * A product's picture: put on, taken off, described, and how its card is
 * drawn.
 *
 * `{ action: "attach", id, path, width, height, alt }` after the browser has
 * uploaded it; `{ action: "remove", id }`; `{ action: "alt", id, alt }`;
 * `{ action: "display", id, display: "button" | "callout" | "preview" }`.
 *
 * What the browser says it uploaded is never taken at face value. The path
 * has to be a picture in this account's own folder, the file store is asked
 * how big it really is and what it says it is, and its first bytes have to be
 * a JPEG's or a WebP's. The old picture is deleted only after the record that
 * replaced it is written.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "products", 2_000);
  if (!guarded.ok) return guarded.response;
  const { ref, body } = guarded;
  const action = text(body.action, 10);
  const id = text(body.id, 40);
  if (!ACTIONS.has(action) || !id) return Response.json({ ok: false, error: "invalid" }, { status: 400 });

  const alt = text(body.alt, MAX_ALT_LENGTH * 2).replace(/\s+/g, " ").trim().slice(0, MAX_ALT_LENGTH);

  try {
    if (action === "alt") {
      const done = await setImageAlt(ref, id, alt);
      if (!done.ok) return Response.json({ ok: false, error: done.reason }, { status: 400 });
      return Response.json({ ok: true });
    }
    if (action === "display") {
      if (!isDisplayStyle(body.display)) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      const done = await setProductDisplay(ref, id, body.display);
      if (!done.ok) return Response.json({ ok: false, error: done.reason }, { status: 400 });
      return Response.json({ ok: true });
    }

    let image: ProductImage | null = null;
    if (action === "attach") {
      const store = await storeForEmail(ref);
      if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
      const path = text(body.path, 200);
      if (!ownsImagePath(path, await imageFolder(ref))) {
        return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      }
      const found = await head(path);
      if (found.size > MAX_IMAGE_BYTES) {
        await del(path).catch(() => {});
        return Response.json({ ok: false, error: "too_big" }, { status: 413 });
      }
      const bytes = await firstBytes(path);
      const kind = bytes ? sniffPhotoType(bytes) : null;
      if (!kind || !(IMAGE_CONTENT_TYPES as readonly string[]).includes(kind) || kind !== found.contentType) {
        await del(path).catch(() => {});
        return Response.json({ ok: false, error: "type" }, { status: 400 });
      }
      const side = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 10_000 ? n : 0);
      const width = side(body.width);
      const height = side(body.height);
      if (!width || !height) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      image = { path, width, height, alt, bytes: found.size };
    }

    const result = await setProductImage(ref, id, image);
    if (!result.ok) {
      if (image) await del(image.path).catch(() => {});
      return Response.json({ ok: false, error: result.reason }, { status: result.reason === "unknown" ? 404 : 400 });
    }
    // Best effort, and deliberately after the write.
    if (result.removed && result.removed.path !== image?.path) {
      await del(result.removed.path).catch((error: unknown) => {
        console.error("could not delete a replaced product picture", error);
      });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof StoreFullError) {
      return Response.json({ ok: false, error: "store_full" }, { status: 409 });
    }
    console.error("changing a product picture failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
