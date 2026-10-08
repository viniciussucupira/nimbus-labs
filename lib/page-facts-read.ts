/**
 * The numbers a "By the numbers" block may show for one product, read from the
 * store (lib/page-facts.ts says what each is and when it is said): its
 * reviews, how many times it was bought when the store shows that, and what
 * a bundle holds now. For the studio and the writing help; the product's own
 * page reads the same things for its other parts and asks pageFacts itself.
 */
import type { Listing, Store } from "@/lib/store";
import { summaryOf } from "@/lib/reviews";
import { SHOWN_FROM, readSoldCounts } from "@/lib/sold-count";
import { offeredItems } from "@/lib/bundles";
import { LANGUAGES } from "@/lib/store-language";
import { type PageFacts, pageFacts } from "@/lib/page-facts";

export async function readPageFacts(store: Store, product: Listing): Promise<PageFacts> {
  const [summary, sold, inside] = await Promise.all([
    summaryOf(store.statsId, product.id).catch(() => null),
    readSoldCounts(store).catch(() => null),
    product.bundle ? offeredItems(store, [product]).then((m) => m.get(product.id) ?? []).catch(() => []) : Promise.resolve(null),
  ]);
  const count = sold?.byProduct[product.id] ?? 0;
  return pageFacts({
    language: store.language,
    locale: LANGUAGES[store.language].locale,
    product,
    bundleItems: inside ? inside.length : null,
    sold: count >= SHOWN_FROM ? count : null,
    reviews: summary,
  });
}
