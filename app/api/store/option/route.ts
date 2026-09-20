import type { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import {
  addOption,
  editOption,
  moveOption,
  removeOption,
  type OptionResult,
} from "@/lib/store";
import { MAX_OPTION_LABEL_LENGTH } from "@/lib/product-option";
import { guardStoreWrite, text } from "@/lib/store-request";

const ACTIONS = new Set(["add", "edit", "remove", "move"]);

/** How firmly to answer when a change is refused. */
const STATUS: Record<string, number> = {
  too_many: 409,
  unknown: 404,
};

/**
 * Adds, changes, reorders or removes one price option on a product.
 *
 * A price is set here and read back on the server at checkout, never sent by
 * the buyer, so this route is the only place an amount enters. The file an
 * option delivers is attached by the same routes a product's file is, because
 * an option holds one exactly as a product does.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;

  const { email, body } = guarded;
  const action = text(body.action, 10);
  if (!ACTIONS.has(action)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // On "add" this names the product the option goes on; on everything else it
  // names the option itself.
  const id = text(body.id, 40);
  const label = text(body.label, MAX_OPTION_LABEL_LENGTH);
  const price = text(body.price, 20);

  if (!id) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  try {
    let result: OptionResult;
    if (action === "add") {
      result = await addOption(email, id, label, price);
    } else if (action === "edit") {
      result = await editOption(email, id, label, price);
    } else if (action === "remove") {
      result = await removeOption(email, id);
    } else {
      const direction = body.direction === "up" ? "up" : "down";
      result = await moveOption(email, id, direction);
    }

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.reason, limit: result.limit },
        { status: STATUS[result.reason] ?? 400 },
      );
    }

    // Deliberately after the write, and best effort. A file left behind costs
    // a fraction of a cent; an option pointing at nothing costs a sale.
    for (const file of result.removed) {
      await del(file.pathname).catch((error: unknown) => {
        console.error("could not delete the file of a removed option", error);
      });
    }

    return Response.json({ ok: true, products: result.store.products });
  } catch (error) {
    console.error("changing a price option failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
