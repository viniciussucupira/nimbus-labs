/**
 * The links on a store page that are not for sale.
 *
 * This is the "in bio" half of link in bio. A creator's page is where they
 * send everyone, so it has to be able to point at the rest of their life —
 * the YouTube channel, the Instagram, the newsletter, the booking page they
 * already pay someone else for. A page that can only take money and can never
 * send anyone anywhere is a checkout, not a bio.
 *
 * A link is not a product. It has no price, it never reaches Stripe, and
 * nothing is delivered for it. That is why it lives here instead of as a
 * product with an empty price: a free thing and a thing that is not for sale
 * are different, and the page says which is which.
 *
 * The address itself is checked by readLink in lib/product-link.ts, the same
 * check a paid delivery link gets. Somebody is about to be sent wherever this
 * points and the person who typed it is not us, so it is https only, with no
 * credentials in it and no address that only resolves on the visitor's own
 * machine.
 */

/** How many a store may list. The same ceiling products have. */
export const MAX_STORE_LINKS = 20;

/** Long enough for "Book a call with me", short enough to read as a button. */
export const MAX_LINK_TITLE_LENGTH = 60;

export type StoreLink = {
  id: string;
  /** What the button says. The creator's words, not the site's name. */
  title: string;
  /** Where it goes, normalised by readLink before it is ever stored. */
  url: string;
  addedAt: string;
};

/** Whatever came back from storage, made safe to render. */
export function parseStoreLinks(raw: unknown): StoreLink[] {
  if (!Array.isArray(raw)) return [];
  const links: StoreLink[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Partial<StoreLink>;
    if (typeof value.id !== "string" || !value.id) continue;
    if (typeof value.title !== "string" || !value.title) continue;
    if (typeof value.url !== "string" || !value.url) continue;
    links.push({
      id: value.id,
      title: value.title.slice(0, MAX_LINK_TITLE_LENGTH),
      url: value.url,
      addedAt: typeof value.addedAt === "string" ? value.addedAt : "",
    });
    if (links.length >= MAX_STORE_LINKS) break;
  }
  return links;
}
