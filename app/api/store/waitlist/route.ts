import type { NextRequest } from "next/server";
import { guardStoreWrite } from "@/lib/store-request";
import { isFree } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { launch, setSoon, waitlistViews } from "@/lib/waitlist";

/**
 * The studio's waitlist switches.
 *
 * `{ action: "soon", id, on }` marks a paid product coming soon (a waitlist
 * instead of a buy button) or takes the mark off without emailing anyone;
 * `{ action: "launch", id, note, address }` puts it on sale and starts the
 * one email to everyone who confirmed.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "products", 4_000);
  if (!guarded.ok) return guarded.response;
  const { store, body } = guarded;
  const id = typeof body.id === "string" ? body.id.slice(0, 40) : "";
  const product = id ? await readListing(store, id) : null;
  if (!product) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
  if (!store.statsId) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });

  try {
    if (body.action === "soon") {
      if (body.on === true && isFree(product)) return Response.json({ ok: false, error: "free" }, { status: 400 });
      await setSoon(store, product.id, body.on === true);
    } else if (body.action === "launch") {
      const result = await launch(store, product, { note: body.note, address: body.address });
      if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    } else {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const views = await waitlistViews(store, [product.id]);
    return Response.json({ ok: true, view: views[product.id] ?? { soon: false, confirmed: 0, waiting: 0, launch: null } });
  } catch (error) {
    console.error("changing a waitlist failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
