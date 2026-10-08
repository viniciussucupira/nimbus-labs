/**
 * A product's address in words (added 8 October 2026):
 * /@store/p/knife-skills-5e3f350b52 rather than /@store/p/5e3f350b52.
 *
 * Stan, Gumroad and Kajabi give a product an address a person can read and
 * a search engine can weigh. Here the words come from the product's title by
 * themselves, and the product's id stays at the end, so:
 *
 *   - nothing is stored, nothing has to be unique, and finding the product
 *     costs no request: the id is read off the end of the address and looked
 *     up in the store record every visit already reads;
 *   - every address ever shared keeps working — the bare id, and the words
 *     of a title since changed — and the page names the current one as its
 *     canonical address, so search engines settle on it.
 *
 * A title with no letters this can write (one in Japanese, say) keeps the
 * bare id. Pure and import-free, so any page or email can build a link.
 */

const MAX_SLUG = 60;

/** The title in address words: "Knife Skills: 10 Lessons" → "knife-skills-10-lessons". */
export function slugOf(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (words.length <= MAX_SLUG) return words;
  const cut = words.slice(0, MAX_SLUG);
  const at = cut.lastIndexOf("-");
  return (at > 20 ? cut.slice(0, at) : cut).replace(/-+$/, "");
}

/** The last part of a product's address: its words and its id, or the id alone. */
export function productSegment(product: { id: string; title: string }): string {
  const slug = slugOf(product.title);
  return slug ? `${slug}-${product.id}` : product.id;
}

/**
 * The product an address names, given what ids the store has: the segment
 * itself when it is an id, or the id at its end. Null when it names none.
 */
export function idInSegment(segment: string, isProduct: (id: string) => boolean): string | null {
  let value = segment;
  try {
    value = decodeURIComponent(segment);
  } catch {
    return null;
  }
  if (isProduct(value)) return value;
  // From the right, so the id is found even if an old one had a hyphen in it.
  for (let cut = value.lastIndexOf("-"); cut > 0; cut = value.lastIndexOf("-", cut - 1)) {
    const tail = value.slice(cut + 1);
    if (tail && isProduct(tail)) return tail;
  }
  return null;
}
