/**
 * One product, several prices.
 *
 * A week of meal plans for $27 and five weeks for $39. The same photo pack
 * personal or commercial. A membership at three levels. In each case it is one
 * thing the buyer already wants, offered at the size that fits them, and the
 * creator writes one product card instead of three that compete with each
 * other on their own page.
 *
 * Stan's help centre lists this among its most requested features and says
 * there is no native way to do it. That is the whole reason it is here.
 *
 * Two rules hold the shape of it:
 *
 *   The price is never sent by the buyer. The form posts an option id, the
 *   server finds that option on the stored product, and the amount charged is
 *   the one the creator saved. A page that posted the price would be a page
 *   where anybody can buy anything for a cent.
 *
 *   Each option delivers its own thing. A five-week plan that hands over the
 *   one-week file is a refund and an apology, so an option carries its own
 *   file or its own link, exactly as a product without options does. An option
 *   with neither is not offered to a buyer at all.
 *
 * A product with no options is not a special case in disguise: it is the
 * normal one, with its own single price and its own delivery, and every store
 * written before this existed simply has none.
 */
import { type ProductFile, parseProductFile } from "@/lib/product-file";
import { MAX_LINK_LENGTH } from "@/lib/product-link";

/**
 * How many prices one product may carry.
 *
 * Three, because a person choosing between more than three on a phone is
 * being given homework rather than a choice, and because good, better and
 * best is the shape this has taken everywhere it works.
 */
export const MAX_OPTIONS = 3;

/** Long enough for "5 weeks" or "Commercial licence". */
export const MAX_OPTION_LABEL_LENGTH = 40;

export type ProductOption = {
  /**
   * Unique across the whole store, not just this product.
   *
   * That is what lets an option hold a file under the same folder rule a
   * product does — stores/<store>/<id>/<file> — with no second path shape to
   * get wrong, and it means an id read from a form can never be mistaken for
   * another one.
   */
  id: string;
  /** What the buyer reads on the button: "1 week", "Commercial licence". */
  label: string;
  priceCents: number;
  /** What this option hands over. One or the other, never both. */
  file: ProductFile | null;
  link: string | null;
};

/** Whatever came back from storage, made safe to use. */
export function parseOptions(raw: unknown): ProductOption[] {
  if (!Array.isArray(raw)) return [];
  const options: ProductOption[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Partial<ProductOption>;
    if (typeof value.id !== "string" || !value.id) continue;
    if (typeof value.label !== "string" || !value.label) continue;
    if (typeof value.priceCents !== "number") continue;
    if (!Number.isInteger(value.priceCents) || value.priceCents < 0) continue;
    options.push({
      id: value.id,
      label: value.label.slice(0, MAX_OPTION_LABEL_LENGTH),
      priceCents: value.priceCents,
      file: parseProductFile(value.file),
      link:
        typeof value.link === "string" && value.link
          ? value.link.slice(0, MAX_LINK_LENGTH)
          : null,
    });
    if (options.length >= MAX_OPTIONS) break;
  }
  return options;
}

/** Whether this option has something to hand over once it is paid for. */
export function optionDelivers(option: ProductOption): boolean {
  return option.file !== null || option.link !== null;
}

/** The cheapest of them, which is the figure a page leads with. */
export function lowestPriceCents(
  options: ProductOption[],
  fallback: number,
): number {
  if (options.length === 0) return fallback;
  return options.reduce(
    (low, option) => Math.min(low, option.priceCents),
    options[0].priceCents,
  );
}
