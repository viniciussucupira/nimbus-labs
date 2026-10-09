/**
 * A sales page's own words, taken out in order and put back (added 9 October
 * 2026), so the whole page can be translated in one step (lib/ai.ts,
 * translatePage): a draft written in English for a store that sells in
 * Spanish, a page copied from a product sold in another language, a store
 * that changes its language.
 *
 * Only words a reader reads are taken: headings, paragraphs, list points,
 * questions and answers, button words, a comparison's cells, the lines under
 * pictures and their descriptions, the search title and line, a headline
 * being tested. Never an id, a picture's file, a video, a product picked for
 * a card, a review picked, a date, a layout, or a comparison's tick or cross.
 * Browser-safe.
 */
import { CELL_NO, CELL_YES, type PageBlock, type SalesPage } from "@/lib/sales-page";

/** A block's own words. */
const TEXT = ["headline", "sub", "heading", "body", "label", "note", "caption", "yesLabel", "noLabel", "columnA", "columnB"] as const;
/** Its lists: points, parts, steps, questions, pictures, rows. */
const LISTS = ["items", "yes", "no", "rows"] as const;
/** The words inside one entry of a list, or inside a block's one picture. */
const PARTS = ["title", "detail", "q", "a", "b", "label", "alt", "caption"] as const;

/** At most this many characters go to the model at once, and each such part is one of the month's jobs. */
export const TRANSLATE_PART_CHARS = 4_000;
/** The most parts one page is translated in. */
export const MAX_TRANSLATE_PARTS = 12;

/** The page with every one of its words passed through `change`, in the same order every time. */
export function mapPageWords(page: SalesPage, change: (words: string) => string): SalesPage {
  const one = <T,>(value: T): T => (typeof value === "string" && value.trim() && value !== CELL_YES && value !== CELL_NO ? (change(value) as T) : value);
  const fields = (record: Record<string, unknown>, keys: readonly string[]) => {
    const out = { ...record };
    for (const key of keys) if (key in out) out[key] = one(out[key]);
    return out;
  };
  const blocks = page.blocks.map((block) => {
    let out = fields(block as unknown as Record<string, unknown>, TEXT);
    for (const key of LISTS) {
      const list = out[key];
      if (!Array.isArray(list)) continue;
      out = {
        ...out,
        [key]: list.map((entry: unknown) =>
          typeof entry === "string" ? one(entry) : entry && typeof entry === "object" ? fields(entry as Record<string, unknown>, PARTS) : entry,
        ),
      };
    }
    if (out.picture && typeof out.picture === "object") out = { ...out, picture: fields(out.picture as Record<string, unknown>, PARTS) };
    return out as unknown as PageBlock;
  });
  return {
    ...page,
    blocks,
    seoTitle: one(page.seoTitle),
    seoDescription: one(page.seoDescription),
    test: page.test ? { ...page.test, headline: one(page.test.headline), sub: one(page.test.sub) } : null,
  };
}

/** Every word a reader reads on the page, in order. */
export function pageWords(page: SalesPage): string[] {
  const all: string[] = [];
  mapPageWords(page, (words) => {
    all.push(words);
    return words;
  });
  return all;
}

/** The page with its words replaced, in the same order; a missing or empty one keeps the original. */
export function withWords(page: SalesPage, words: string[]): SalesPage {
  let at = 0;
  return mapPageWords(page, (original) => {
    const next = words[at];
    at += 1;
    return typeof next === "string" && next.trim() ? next : original;
  });
}

/** The words split into parts of at most TRANSLATE_PART_CHARS characters (a longer single one is a part of its own). */
export function translateParts(words: string[]): string[][] {
  const parts: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const w of words) {
    if (current.length && size + w.length > TRANSLATE_PART_CHARS) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(w);
    size += w.length;
  }
  if (current.length) parts.push(current);
  return parts;
}
