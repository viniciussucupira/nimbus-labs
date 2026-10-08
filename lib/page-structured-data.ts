/**
 * What a sales page tells search engines beyond the product itself (added
 * 8 October 2026), built only from what the page shows:
 *
 *   - its questions and answers, as an FAQPage, so search engines and the
 *     AI answer engines that read the same markup can quote the creator's
 *     own answers; only questions that have an answer, and not ones kept to
 *     computers, since search engines read the page as a phone shows it;
 *   - where the page sits — the store, then the product — as a
 *     BreadcrumbList, which search results show in place of a bare address.
 *
 * Pure: the page passes in its blocks and addresses.
 */
import type { PageBlock } from "@/lib/sales-page";

/** The most questions put in the markup: what a search result could ever show and more. */
const MAX_FAQ_MARKUP = 30;

export function faqData(blocks: PageBlock[]): object | null {
  const items: { q: string; a: string }[] = [];
  for (const block of blocks) {
    if (block.kind !== "faq" || block.screens === "computer") continue;
    for (const item of block.items) {
      const q = item.q.trim();
      const a = item.a.trim();
      if (q && a && !items.some((seen) => seen.q.toLowerCase() === q.toLowerCase())) items.push({ q, a });
    }
  }
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.slice(0, MAX_FAQ_MARKUP).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbData(store: { name: string; url: string }, product: { title: string; url: string }): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: store.name, item: store.url },
      { "@type": "ListItem", position: 2, name: product.title, item: product.url },
    ],
  };
}
