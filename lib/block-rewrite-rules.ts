/**
 * Rewriting one block of a sales page with the writing help (lib/ai.ts,
 * rewriteBlock), as rules the studio can read too: which blocks it can
 * rewrite, the four ways it can, and the check that keeps it honest.
 *
 * Measured before it was built (8 October 2026): Kajabi's Creator Studio and
 * Mighty Networks' "Make It Better" rewrite a section in place; Stan,
 * Gumroad and Hotmart Pages do not. Here it is the creator's own words,
 * made clearer, shorter, more specific or warmer, in the store's language,
 * one block at a time, with Undo beside it and nothing saved until Save.
 *
 * What it never does is add a fact. Every number in what comes back has to
 * be one already in the block or on the page; a rewrite that brings a new
 * one ("3x faster", "500 students", "30 days") is thrown away whole, so it
 * cannot slip a claim onto a page that the creator never made.
 */
import type { BlockKind, PageBlock } from "@/lib/sales-page";

export type RewriteStyle = "clearer" | "shorter" | "specific" | "warmer";

export const REWRITE_STYLES: { id: RewriteStyle; label: string; ask: string }[] = [
  { id: "clearer", label: "Clearer", ask: "Make it clearer: plain words, one idea per sentence, nothing a buyer has to read twice." },
  { id: "shorter", label: "Shorter", ask: "Make it shorter: keep every fact, cut every word that does not carry one. Aim for about two thirds of the length." },
  { id: "specific", label: "More specific", ask: "Make it more specific: swap vague words for the concrete things the facts name. Do not add anything the facts do not say." },
  { id: "warmer", label: "Warmer", ask: "Make it warmer: speak to one reader as 'you', like a person who made this for them, without hype." },
];

/** The blocks it can rewrite: those made of the creator's words. */
export const REWRITABLE: BlockKind[] = ["hero", "text", "feature", "benefits", "inside", "steps", "bonuses", "fit", "faq", "guarantee", "bio", "cta"];

/**
 * The blocks the writing help can write from nothing (lib/ai.ts, fillBlock),
 * from what the product and the page already say. Not a refund promise, not
 * the creator's story about themselves, not bonuses and not what is inside:
 * those are facts only the creator has, and a draft of them would be a guess
 * on their page.
 */
export const FILLABLE: BlockKind[] = ["benefits", "fit", "steps", "faq"];

export function isRewriteStyle(value: unknown): value is RewriteStyle {
  return REWRITE_STYLES.some((s) => s.id === value);
}

/** Every number written in a text, as digits with their separators dropped: "1,200" and "1200" are one number. */
export function numbersIn(text: string): Set<string> {
  return new Set((text.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]+$/, "").replace(/[.,]/g, "")));
}

/** The words of a block, as one text: what its numbers are read from. */
export function blockText(block: PageBlock): string {
  switch (block.kind) {
    case "hero":
      return `${block.headline}\n${block.sub}`;
    case "text":
    case "feature":
    case "guarantee":
    case "bio":
      return `${block.heading}\n${block.body}`;
    case "benefits":
      return [block.heading, ...block.items].join("\n");
    case "inside":
    case "steps":
    case "bonuses":
      return [block.heading, ...block.items.flatMap((i) => [i.title, i.detail])].join("\n");
    case "fit":
      return [block.heading, block.yesLabel, block.noLabel, ...block.yes, ...block.no].join("\n");
    case "faq":
      return [block.heading, ...block.items.flatMap((i) => [i.q, i.a])].join("\n");
    case "cta":
      return `${block.label}\n${block.note}`;
    default:
      return "";
  }
}

/** Whether a rewrite brings in a number that neither the block nor the page had: if so it is not used. */
export function addsNumbers(before: PageBlock, after: PageBlock, page: string): boolean {
  const known = new Set([...numbersIn(blockText(before)), ...numbersIn(page)]);
  return [...numbersIn(blockText(after))].some((n) => !known.has(n));
}
