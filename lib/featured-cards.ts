/**
 * The cards another product block may draw (lib/sales-page.ts, ProductBlock),
 * from the listings the store record already carries (catalog.head: the
 * store's first page of products, and what they offer at checkout). Read
 * from there on purpose: drawing a card costs no request, so a page with one
 * costs what a page without one does (tests/traffic.test.ts). A product past
 * the first page has no card, and the editor says so.
 */
import type { Store } from "@/lib/store";
import type { FeaturedCard } from "@/components/sales-blocks";
import { imageUrl } from "@/lib/product-image";
import { pricePill, productPath } from "@/components/store-product";

export function featuredCards(store: Store, except: string, only?: string[]): Record<string, FeaturedCard> {
  const out: Record<string, FeaturedCard> = {};
  for (const listing of store.catalog.head) {
    if (listing.id === except || listing.hidden) continue;
    if (only && !only.includes(listing.id)) continue;
    out[listing.id] = {
      title: listing.title,
      summary: listing.summary,
      pill: pricePill(store, listing),
      href: productPath(store, listing),
      picture: listing.image ? { src: imageUrl(listing.image), alt: listing.image.alt, width: listing.image.width, height: listing.image.height } : null,
    };
  }
  return out;
}
