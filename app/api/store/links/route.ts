import type { NextRequest } from "next/server";
import {
  addStoreLink,
  editStoreLink,
  moveStoreLink,
  removeStoreLink,
  type LinkResult,
} from "@/lib/store";
import { MAX_LINK_LENGTH, readLink } from "@/lib/product-link";
import { MAX_LINK_TITLE_LENGTH } from "@/lib/store-link";
import { guardStoreWrite, text } from "@/lib/store-request";

const ACTIONS = new Set(["add", "edit", "remove", "move"]);

/** How firmly to answer when a change is refused. */
const STATUS: Record<string, number> = {
  too_many: 409,
  unknown: 404,
};

/**
 * Adds, changes, reorders or removes one of the links on the creator's page.
 *
 * Deliberately a separate route from products. A link takes no money, reaches
 * no Stripe account and delivers nothing, so it shares none of that code and
 * none of its ways of failing.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;

  const { email, body } = guarded;
  const action = text(body.action, 10);
  if (!ACTIONS.has(action)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const id = text(body.id, 40);
  const title = text(body.title, MAX_LINK_TITLE_LENGTH);
  const raw = text(body.url, MAX_LINK_LENGTH);

  if (action !== "add" && !id) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  try {
    let result: LinkResult;
    if (action === "add" || action === "edit") {
      // Checked before anything is written, and the creator is told which way
      // it was wrong rather than just that it failed.
      const read = readLink(raw);
      if (!read.ok) {
        return Response.json(
          { ok: false, error: "link", reason: read.reason },
          { status: 400 },
        );
      }
      result =
        action === "add"
          ? await addStoreLink(email, title, read.url)
          : await editStoreLink(email, id, title, read.url);
    } else if (action === "remove") {
      result = await removeStoreLink(email, id);
    } else {
      const direction = body.direction === "up" ? "up" : "down";
      result = await moveStoreLink(email, id, direction);
    }

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.reason, limit: result.limit },
        { status: STATUS[result.reason] ?? 400 },
      );
    }
    return Response.json({ ok: true, links: result.store.links });
  } catch (error) {
    console.error("changing a link failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
