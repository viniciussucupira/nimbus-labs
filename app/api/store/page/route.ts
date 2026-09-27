import type { NextRequest } from "next/server";
import { StoreFullError, isFree, setProductPage } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { guardStoreWrite, text } from "@/lib/store-request";
import { EMPTY_PAGE, MAX_BLOCKS, MAX_PAGE_BYTES, pageProblem, parsePage } from "@/lib/sales-page";
import { writePage } from "@/lib/sales-page-store";

/** Thirty full blocks as JSON, with room to spare; the record itself is held to MAX_PAGE_BYTES. */
const MAX_BODY_BYTES = 200_000;

/**
 * Saves a product's page of blocks (lib/sales-page.ts), or clears it.
 *
 * `{ id, page: { blocks, seoTitle, seoDescription, next } }`, or
 * `{ id, page: null }` for the plain page again. Every rule the product's
 * page applies is applied here first, and a page that would be saved
 * differently from how it was sent is refused with the reason, so the
 * studio never says "saved" about something it did not save.
 */
export async function POST(request: NextRequest) {
  // A product's page is part of the product (lib/team-roles.ts): owner, Admin, Editor.
  const guarded = await guardStoreWrite(request, "products", MAX_BODY_BYTES);
  if (!guarded.ok) return guarded.response;
  const body = guarded.body;
  const id = text(body.id, 40);
  if (!id || !("page" in body)) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  const store = guarded.store;
  const product = await readListing(store, id);
  if (!product) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  const raw = body.page && typeof body.page === "object" ? (body.page as Record<string, unknown>) : null;
  const page = raw ? parsePage(raw) : { ...EMPTY_PAGE, blocks: [] };
  if (raw) {
    if (Array.isArray(raw.blocks) && raw.blocks.length > MAX_BLOCKS) return Response.json({ ok: false, error: "too_many" }, { status: 400 });
    const problem = pageProblem(raw, page);
    if (problem) return Response.json({ ok: false, error: problem }, { status: 400 });
    if (JSON.stringify(page).length > MAX_PAGE_BYTES) return Response.json({ ok: false, error: "too_big" }, { status: 400 });
    // What is shown after a free sign-up is another product of this store,
    // one that costs money; a paid product's page shows nothing after.
    const sentNext = typeof raw.next === "string" && raw.next ? raw.next : null;
    if (sentNext) {
      const next = await readListing(store, sentNext);
      if (!isFree(product) || !next || next.id === product.id || isFree(next)) {
        return Response.json({ ok: false, error: "next" }, { status: 400 });
      }
    }
  }

  const has = page.blocks.length > 0 || page.seoTitle !== "" || page.seoDescription !== "" || page.next !== null;
  try {
    const marked = await setProductPage(guarded.ref, id, has);
    if (!marked.ok) return Response.json({ ok: false, error: marked.reason }, { status: 400 });
    if (!marked.store.statsId) return Response.json({ ok: false, error: "server_error" }, { status: 500 });
    await writePage(marked.store.statsId, id, page);
    return Response.json({ ok: true, blocks: page.blocks.length });
  } catch (error) {
    if (error instanceof StoreFullError) return Response.json({ ok: false, error: "store_full" }, { status: 409 });
    console.error("saving a product page failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
