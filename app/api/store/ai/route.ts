import type { NextRequest } from "next/server";
import { guardStoreWrite, text } from "@/lib/store-request";
import { withinLimit } from "@/lib/request-guard";
import { describePicture, fillBlock, reviewPage, rewriteBlock, translatePage, writeEmail, writeOutline, writePage, writeProduct } from "@/lib/ai";
import { isRewriteStyle } from "@/lib/block-rewrite-rules";
import { factsFor, missedQuestions } from "@/lib/answers";
import { parsePage } from "@/lib/sales-page";
import { coachChecks, steepestDrop } from "@/lib/page-coach";
import { readPageFacts } from "@/lib/page-facts-read";
import { readDepth, reachShares } from "@/lib/page-depth";
import { LANGUAGES, isLanguage } from "@/lib/store-language";
import { readStats } from "@/lib/stats";
import { isFree } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { readAbout } from "@/lib/product-about";
import { formatMoney } from "@/lib/money";
import { AI_PER_MINUTE, EMAIL_GOALS, type EmailGoal, MAX_AI_NOTES, type ProductKind } from "@/lib/ai-rules";
import { get } from "@/lib/blob";
import { imageType, ownsImagePath } from "@/lib/product-image";
import { imageFolder } from "@/lib/store";

const KINDS: ProductKind[] = ["download", "link", "course", "membership", "call", "bundle"];

/**
 * The writing help (lib/ai.ts): `{ kind: "product" | "page" | "review" | "block" | "fill" | "alt" | "translate" | "outline" | "email", … }`.
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
    const stats = await readStats(store).catch(() => null);
    const views = stats?.windows.d30.viewsByProduct[product.id] ?? 0;
    const started = stats?.windows.d30.checkoutsByProduct[product.id] ?? 0;
    const asked = (await missedQuestions(store, 100).catch(() => []))
      .filter((row) => row.productId === product.id)
      .map((row) => row.question)
      .filter((q, i, all) => all.indexOf(q) === i)
      .slice(0, 8);
    if (asked.length) missing.push(`Answers to what visitors asked this page and it could not answer: ${asked.map((q) => `"${q}"`).join("; ")}`);
    const traffic = views >= 30 ? ` In the last 30 days, this page was opened ${views} times and ${started} checkouts were started.` : "";
    return answer(
      reviewPage(store, {
        facts: factsFor(store, product, about, page),
        missing,
        drop: `${drop ? `${drop.lost} of every 100 readers stop before the "${drop.kind}" section, out of ${depth.visitors} counted.` : ""}${traffic}`.trim(),
        language: LANGUAGES[store.language].english,
        free: isFree(product),
        notes,
      }),
    );
  }
  if (body.kind === "block") {
    // One block, as it stands in the editor, rewritten in the store's language
    // with the rest of the page as context; nothing is saved here.
    const product = await readListing(store, text(body.product, 40));
    if (!product) return fail("unknown", 404);
    if (!isRewriteStyle(body.style)) return fail("invalid");
    const page = parsePage(body.page);
    const block = parsePage({ blocks: [body.block] }).blocks[0];
    if (!block) return fail("invalid");
    const about = product.about ? await readAbout(store.statsId, product.id) : "";
    return answer(
      rewriteBlock(store, { block, style: body.style, facts: factsFor(store, product, about, page), language: LANGUAGES[store.language].english }),
    );
  }
  if (body.kind === "fill") {
    // One empty block written from the product and the page (lib/ai.ts, fillBlock); nothing is saved here.
    const product = await readListing(store, text(body.product, 40));
    if (!product) return fail("unknown", 404);
    const page = parsePage(body.page);
    const block = parsePage({ blocks: [body.block] }).blocks[0];
    if (!block) return fail("invalid");
    const about = product.about ? await readAbout(store.statsId, product.id) : "";
    return answer(fillBlock(store, { block, facts: factsFor(store, product, about, page), language: LANGUAGES[store.language].english }));
  }
  if (body.kind === "alt") {
    // A picture of this store's own, described for someone who cannot see it (lib/ai.ts, describePicture).
    const product = await readListing(store, text(body.product, 40));
    if (!product) return fail("unknown", 404);
    const path = text(body.path, 200);
    const folder = await imageFolder(guarded.ref);
    if (!path || !ownsImagePath(path, folder)) return fail("invalid");
    const found = await get(path, { access: "private" }).catch(() => null);
    if (!found || found.statusCode !== 200 || !found.stream) return fail("invalid");
    const bytes = new Uint8Array(await new Response(found.stream).arrayBuffer());
    return answer(describePicture(store, { bytes, mediaType: imageType(path), productTitle: product.title, language: LANGUAGES[store.language].english }));
  }
  if (body.kind === "translate") {
    // The page as it stands in the editor, every word of it into one of the
    // store languages (lib/ai.ts, translatePage); nothing is saved here.
    const product = await readListing(store, text(body.product, 40));
    if (!product) return fail("unknown", 404);
    const to = isLanguage(body.language) ? body.language : store.language;
    return answer(translatePage(store, { page: parsePage(body.page), language: LANGUAGES[to].english }));
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
