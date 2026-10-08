/**
 * Sections on a store page, and a line of news across its top. Rules the
 * browser can read too; the store's record keeps both (lib/store.ts).
 *
 * Measured before they were built (7 October 2026): Stan lets a creator name
 * sections and drag products into them, and Kajabi puts an announcement bar
 * across a site. A store here was one unbroken list, which is fine at five
 * products and a wall at fifty.
 *
 * A section is a heading that starts at one product: everything from that
 * product down to the next heading is in it. It is kept as the heading and
 * the id of the product it starts at, nothing else, so:
 *
 *   - moving that product moves its heading with it, and the order of the
 *     store stays the one list the creator already arranges;
 *   - a heading whose product is a draft waits on the next published product
 *     after it; one with nothing published under it is not drawn;
 *   - a heading whose product was removed is dropped the next time the
 *     sections are saved, and is ignored until then.
 *
 * The line of news is the creator's own words, with an optional link to one
 * of their own products. No timer, no counter and no claim of ours: it says
 * what the creator typed, and nothing is added to it.
 */

export type StoreSection = { title: string; at: string };

export const MAX_SECTIONS = 20;
export const MAX_SECTION_TITLE = 60;
export const MAX_ANNOUNCEMENT = 120;

export type Announcement = { text: string; product: string | null };

const PRODUCT_ID = /^[A-Za-z0-9_-]{1,40}$/;

const oneLine = (value: unknown, max: number) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** Sections as stored or sent, made safe to use: a title and a product each, one per product, twenty at most. */
export function parseSections(raw: unknown): StoreSection[] {
  if (!Array.isArray(raw)) return [];
  const out: StoreSection[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const title = oneLine(value.title, MAX_SECTION_TITLE);
    const at = typeof value.at === "string" && PRODUCT_ID.test(value.at) ? value.at : "";
    if (!title || !at || seen.has(at)) continue;
    seen.add(at);
    out.push({ title, at });
    if (out.length >= MAX_SECTIONS) break;
  }
  return out;
}

/** The line of news as stored or sent; null when there is nothing to say. */
export function parseAnnouncement(raw: unknown): Announcement | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const text = oneLine(value.text, MAX_ANNOUNCEMENT);
  if (!text) return null;
  return { text, product: typeof value.product === "string" && PRODUCT_ID.test(value.product) ? value.product : null };
}

/** A product as the store's index lists it: its id, and whether it is a draft. */
export type Listed = { id: string; hidden: boolean };

/**
 * Where each heading is drawn: the published product it sits above. Walks the
 * store's whole list once, so a heading placed on a draft lands on the next
 * published product, and of two headings with nothing published between
 * them only the later one is drawn.
 */
export function sectionHeads(items: Listed[], sections: StoreSection[]): Map<string, string> {
  const starts = new Map(sections.map((section) => [section.at, section.title]));
  const heads = new Map<string, string>();
  let waiting: string | null = null;
  for (const item of items) {
    const title = starts.get(item.id);
    if (title) waiting = title;
    if (!item.hidden && waiting !== null) {
      heads.set(item.id, waiting);
      waiting = null;
    }
  }
  return heads;
}

/**
 * The section a published product is in: the nearest heading at or above it.
 * For the top of a later page of a long store, which begins mid-section.
 */
export function sectionOf(items: Listed[], sections: StoreSection[], productId: string): string | null {
  const heads = sectionHeads(items, sections);
  let current: string | null = null;
  for (const item of items) {
    if (item.hidden) continue;
    if (heads.has(item.id)) current = heads.get(item.id) ?? null;
    if (item.id === productId) return current;
  }
  return null;
}

/**
 * A page of products cut into its sections, in order: each with its heading
 * (null for products above the first heading), and whether that heading
 * began on an earlier page.
 */
export function groupBySection<T extends { id: string }>(
  listings: T[],
  items: Listed[],
  sections: StoreSection[],
): { title: string | null; continued: boolean; products: T[] }[] {
  if (sections.length === 0 || listings.length === 0) return listings.length ? [{ title: null, continued: false, products: listings }] : [];
  const heads = sectionHeads(items, sections);
  const groups: { title: string | null; continued: boolean; products: T[] }[] = [];
  listings.forEach((product, index) => {
    const own = heads.get(product.id) ?? null;
    if (index === 0) {
      const carried = own ?? sectionOf(items, sections, product.id);
      groups.push({ title: carried, continued: own === null && carried !== null, products: [product] });
    } else if (own !== null) {
      groups.push({ title: own, continued: false, products: [product] });
    } else {
      groups[groups.length - 1].products.push(product);
    }
  });
  return groups;
}

/**
 * The sections once a product is gone from the store. A heading that started
 * at it now starts at the product that came next in the creator's order, so
 * a section does not vanish because its first product was removed; when the
 * next product already starts a section of its own, or there is none, the
 * heading goes with the product.
 */
export function sectionsWithout(sections: StoreSection[], order: string[], removed: string): StoreSection[] {
  const next = order[order.indexOf(removed) + 1];
  const follows = order.includes(removed) && next !== undefined && !sections.some((section) => section.at === next);
  return sections.flatMap((section) => (section.at !== removed ? [section] : follows ? [{ ...section, at: next }] : []));
}
