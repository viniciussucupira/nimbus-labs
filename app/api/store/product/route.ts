import type { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import {
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  addProduct,
  editProduct,
  moveProduct,
  productFile,
  removeProduct,
  setProductLink,
  type ProductResult,
} from "@/lib/store";
import { MAX_LINK_LENGTH, readLink } from "@/lib/product-link";
import { guardStoreWrite, text } from "@/lib/store-request";

const ACTIONS = new Set(["add", "edit", "remove", "move", "link", "unlink"]);

/** How firmly to answer when a change is refused. */
const STATUS: Record<string, number> = {
  too_many: 409,
  unknown: 404,
};

/**
 * The file setters can also fail with "invalid", which describes a pathname
 * rather than a product. Nothing on this path can produce it, and answering
 * with a word the caller has never seen would be worse than "unknown".
 */
function asProductReason(
  reason: "none" | "unknown" | "invalid",
): "none" | "unknown" {
  return reason === "invalid" ? "unknown" : reason;
}

/** Adds, changes, reorders or removes one thing on the creator's store. */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;

  const { email, body } = guarded;
  const action = text(body.action, 10);
  if (!ACTIONS.has(action)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const id = text(body.id, 40);
  const title = text(body.title, MAX_TITLE_LENGTH);
  const summary = text(body.summary, MAX_SUMMARY_LENGTH);
  const price = text(body.price, 20);
  const link = text(body.link, MAX_LINK_LENGTH);

  if (action !== "add" && !id) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  try {
    let result: ProductResult;
    if (action === "add") {
      result = await addProduct(email, title, summary, price);
    } else if (action === "edit") {
      result = await editProduct(email, id, title, summary, price);
    } else if (action === "remove") {
      // Read the file before the product is gone, so the storage it used can
      // be released once the removal is safely written.
      const had = await productFile(email, id);
      result = await removeProduct(email, id);
      if (result.ok && had) {
        await del(had.file.pathname).catch((error: unknown) => {
          console.error("could not delete the file of a removed product", error);
        });
      }
    } else if (action === "link") {
      // The link is checked before anything is written, so a product is never
      // left pointing at something a buyer could not open.
      const read = readLink(link);
      if (!read.ok) {
        return Response.json(
          { ok: false, error: "link", reason: read.reason },
          { status: 400 },
        );
      }
      // Pointing at a link displaces any file that was there. The storage is
      // released only after the record that pointed at it is written.
      const linked = await setProductLink(email, id, read.url);
      if (linked.ok && linked.removed) {
        await del(linked.removed.pathname).catch((error: unknown) => {
          console.error("could not delete a file replaced by a link", error);
        });
      }
      result = linked.ok
        ? { ok: true, store: linked.store }
        : { ok: false, reason: asProductReason(linked.reason) };
    } else if (action === "unlink") {
      const cleared = await setProductLink(email, id, null);
      result = cleared.ok
        ? { ok: true, store: cleared.store }
        : { ok: false, reason: asProductReason(cleared.reason) };
    } else {
      const direction = body.direction === "up" ? "up" : "down";
      result = await moveProduct(email, id, direction);
    }

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.reason, limit: result.limit },
        { status: STATUS[result.reason] ?? 400 },
      );
    }
    return Response.json({ ok: true, products: result.store.products });
  } catch (error) {
    console.error("changing a product failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
