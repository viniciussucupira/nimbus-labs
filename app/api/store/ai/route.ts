import type { NextRequest } from "next/server";
import { guardStoreWrite, text } from "@/lib/store-request";
import { withinLimit } from "@/lib/request-guard";
import { reviewPage, writeEmail, writeOutline, writePage, writeProduct } from "@/lib/ai";
import { factsFor } from "@/lib/answers";
import { parsePage } from "@/lib/sales-page";
import { coachChecks, steepestDrop } from "@/lib/page-coach";
import { readPageFacts } from "@/lib/page-facts-read";
import { readDepth, reachShares } from "@/lib/page-depth";
import { LANGUAGES } from "@/lib/store-language";
import { isFree } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { readAbout } from "@/lib/product-about";
import { formatMoney } from "@/lib/money";
import { AI_PER_MINUTE, EMAIL_GOALS, type EmailGoal, MAX_AI_NOTES, type ProductKind } from "@/lib/ai-rules";

const KINDS: ProductKind[] = ["download", "link", "course", "membership", "call", "bundle"];

/**
 * The writing help (lib/ai.ts): `{ kind: "product" | "page" | "review" | "outline" | "email", … }`.
 * It writes into the studio's own boxes and saves nothing: whatever comes back
 * is the creator's to read, change and keep, or not.
 *
 * Who may ask is who may write that thing: products and courses need the
 * products permission, an email the one to write drafts (lib/team-roles.ts).
 */
export async function POST(request: NextRequest) {
  // A review sends the page being edited, which may be long (lib/sales-page.ts, MAX_PAGE_BYTES).
  const guarded = await guardStoreWrite(request, (body) => (body.kind === "email" ? "draft" : "products"), 140_000);
  if (!guarded.ok) return guarded.response;
  const { body, store } = guarded;
  const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });
  if (!(await withinLimit("ai", store.sid || store.handle, AI_PER_MINUTE, 60))) return fail("slow", 429);
  const notes = text(body.notes, MAX_AI_NOTES + 100);

  const answer = async <T,>(result: Promise<{ ok: true; value: T; left: number } | { ok: false; reason: string }>) => {
    const done = await result;
    if (!done.ok) return fail(done.reason, done.reason === "failed" ? 502 : 400);
    return Response.json({ ok: true, value: done.value, left: done.left });
  };

  if (body.kind === "product") {
    const kind = KINDS.includes(body.productKind as ProductKind) ? (body.productKind as ProductKind) : "download";
    return answer(writeProduct(store, { title: text(body.title, 200), price: text(body.price, 40), kind, notes }));
  }
  if (body.kind === "page") {
    // The product is read here, from the store's own record, rather than taken
    // from the browser: what the page is drafted from is what the product is.
    const product = await readListing(store, text(body.product, 40));
    if (!product) return fail("unknown", 404);
    const about = product.about ? await readAbout(store.statsId, product.id) : "";
    const kind = isFree(product)
      ? "free"
      : product.course
        ? "course"
        : product.call
          ? "call"
          : product.recurring
            ? "membership"
            : product.bundle
              ? "bundle"
              : product.file
                ? "download"
                : "link";
    return answer(
      writePage(store, {
        title: product.title,
        price: isFree(product) ? "" : formatMoney(product.priceCents, store.currency),
        kind,
        summary: product.summary,
        about,
        notes,
      }),
    );
  }
  if (body.kind === "review") {
    // The page as it stands in the editor, saved or not, held to the same
    // rules as a saved one; the product itself is read from the store.
    const product = await readListing(store, text(body.product, 40));
    if (!product) return fail("unknown", 404);
    const page = parsePage(body.page);
    const [about, facts, depth] = await Promise.all([
      product.about ? readAbout(store.statsId, product.id) : Promise.resolve(""),
      readPageFacts(store, product),
      readDepth(store.statsId, product.id).catch(() => ({ visitors: 0, stopped: {} })),
    ]);
    const missing = coachChecks({ page, productTitle: product.title, free: isFree(product), picture: Boolean(product.image), facts })
      .filter((c) => !c.done)
      .map((c) => c.label);
    const reach = reachShares(page.blocks.map((b) => b.id), depth.stopped, depth.visitors);
    const drop = steepestDrop(page.blocks, reach);
    return answer(
      reviewPage(store, {
        facts: factsFor(store, product, about, page),
        missing,
        drop: drop ? `${drop.lost} of every 100 readers stop before the "${drop.kind}" section, out of ${depth.visitors} counted.` : "",
        language: LANGUAGES[store.language].english,
        free: isFree(product),
        notes,
      }),
    );
  }
  if (body.kind === "outline") {
    return answer(writeOutline(store, { title: text(body.title, 200), notes }));
  }
  if (body.kind === "email") {
    const goal = EMAIL_GOALS.some((g) => g.id === body.goal) ? (body.goal as EmailGoal) : "update";
    return answer(writeEmail(store, { goal, product: text(body.product, 200), link: text(body.link, 400), notes }));
  }
  return fail("invalid");
}
