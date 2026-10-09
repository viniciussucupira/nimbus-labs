/**
 * "What buyers say" on the store page (added 9 October 2026): the newest
 * reviews with words, from every product, kept on the store's own record so
 * the page shows them without reading anything more.
 *
 * Kept again after every change that could alter them — a review written,
 * changed or deleted by its buyer, hidden or shown by the creator, or its
 * purchase refunded — from the store's own list of reviews, newest first.
 * Only reviews on the page whose stars count are kept: never a hidden one,
 * never a refunded one. Nothing is picked for its stars: these are simply
 * the newest, and the page says so.
 */
import { studioReviews } from "@/lib/reviews";
import { readListings } from "@/lib/catalog";
import { type Store, setQuotes, storeRef } from "@/lib/store";
import { MAX_STORE_QUOTES, type StoreQuote, quoteText } from "@/lib/store-quotes-rules";

/** Words shorter than this say too little to quote. */
const MIN_QUOTE = 20;
/** How far down the newest reviews are looked for three with words. */
const LOOK_AT = 40;

/** Reads the newest reviews and keeps the ones to quote on the store's record. Never throws. */
export async function refreshStoreQuotes(store: Store): Promise<void> {
  if (!store.statsId) return;
  try {
    const { rows } = await studioReviews(store.statsId, { queue: false, offset: 0, limit: LOOK_AT });
    const quotes: StoreQuote[] = [];
    for (const row of rows) {
      if (row.hidden || row.refunded || row.text.replace(/\s+/g, " ").trim().length < MIN_QUOTE) continue;
      quotes.push({ p: row.productId, ti: "", r: row.rating, t: quoteText(row.text), n: row.name, at: row.editedAt || row.createdAt });
      if (quotes.length >= MAX_STORE_QUOTES) break;
    }
    // Each product's title as it is now, for the line under its review.
    const titles = new Map((await readListings(store, [...new Set(quotes.map((q) => q.p))])).map((p) => [p.id, p.title]));
    for (const quote of quotes) quote.ti = titles.get(quote.p) ?? "";
    const same = JSON.stringify(quotes) === JSON.stringify(store.quotes);
    if (!same) await setQuotes(storeRef(store), quotes);
  } catch (error) {
    console.error("keeping a store's newest reviews failed", error);
  }
}
