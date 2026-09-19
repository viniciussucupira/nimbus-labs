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
  type ProductResult,
} from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";

const ACTIONS = new Set(["add", "edit", "remove", "move"]);

/** How firmly to answer when a change is refused. */
const STATUS: Record<string, number> = {
  too_many: 409,
  unknown: 404,
};

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
