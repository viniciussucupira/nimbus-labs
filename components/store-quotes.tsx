import { Stars } from "@/components/review-stars";
import { blockWords } from "@/lib/buyer-words/blocks";
import { speech } from "@/lib/buyer-words";
import type { Store } from "@/lib/store";
import type { StoreQuote } from "@/lib/store-quotes-rules";

/**
 * "What buyers say" on the store page (lib/store-quotes.ts): the newest
 * reviews with words, each with its stars, the name its buyer chose and the
 * product it is about, linking to that product's reviews. Said to be the
 * newest, because that is all they are.
 */
export function StoreQuotes({ store, quotes, titles }: { store: Store; quotes: StoreQuote[]; titles: Map<string, string> }) {
  if (quotes.length === 0) return null;
  const w = blockWords(store.language);
  const said = speech(store);
  return (
    <section aria-labelledby="quotes-title" className="mt-10">
      <h2 id="quotes-title" className="st-section-title">
        {w.quotesTitle}
      </h2>
      <p className="st-muted -mt-2 mb-4 px-1 text-sm">{w.quotesNote}</p>
      <ul className="space-y-3">
        {quotes.map((quote) => {
          const title = titles.get(quote.p) || quote.ti;
          return (
            <li key={`${quote.p}-${quote.at}`} className="st-card px-5 py-4 sm:px-6">
              <figure>
                <Stars value={quote.r} size={15} label={said.w.starsOutOf5(quote.r)} />
                <blockquote className="mt-2 leading-relaxed [overflow-wrap:anywhere]">{quote.t}</blockquote>
                <figcaption className="st-muted mt-2 text-sm">
                  <span className="font-semibold" style={{ color: "var(--st-text)" }}>
                    {quote.n || said.w.verifiedBuyer}
                  </span>
                  {" · "}
                  {said.w.verifiedPurchase}
                  {title ? (
                    <>
                      {" · "}
                      <a href={`/@${store.handle}/p/${quote.p}#reviews`} className="st-footer-link">
                        {w.quoteAbout(title)}
                      </a>
                    </>
                  ) : null}
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
