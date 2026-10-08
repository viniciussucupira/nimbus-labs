import type { Metadata } from "next";
import { forVisitor } from "@/lib/visitor";
import { connection } from "next/server";
import { cache } from "react";
import { type Listing, type Store, normaliseHandle, storeForPage } from "@/lib/store";
import { readListing, readListings } from "@/lib/catalog";
import { canSell, canSellProduct } from "@/lib/store-checkout";
import { lookStyle } from "@/lib/store-look";
import { imageUrl } from "@/lib/product-image";
import { stockLeft } from "@/lib/stock";
import { outOfKeys } from "@/lib/licence-keys";
import { isSoon } from "@/lib/waitlist";
import { sellsInTestMode } from "@/lib/stripe-connect";
import { summaryOf } from "@/lib/reviews";
import { bumpTargets } from "@/lib/product-extras";
import { CARD_COVER_FROM, CARD_HEIGHTS, placeFrom, tagged } from "@/lib/embed-rules";
import { PriceTag, pageAction, productPath } from "@/components/store-product";
import { RatingLine } from "@/components/review-list";

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * One product as a card for the creator's own website (lib/embed-rules.ts):
 * its picture, title, price, rating and the buy button, filling whatever
 * frame it is pasted in, with the button kept at the bottom.
 *
 * Everything on it decides what it does by the rules the product's own page
 * follows (pageAction in components/store-product.tsx): straight to Stripe's
 * checkout when there is nothing to choose first, to the product's page when
 * there is (a price option, a plan, a time to book, an email for something
 * free), and a plain sentence when it cannot be bought. Every way out opens a
 * new tab, so the creator's page stays where it was.
 *
 * It sets no cookie, counts no visit and asks for no session: it is drawn on
 * every page of the creator's site that holds it, read or not.
 */
const load = cache(async (raw: string, id: string): Promise<{ store: Store | null; product: Listing | null }> => {
  let decoded = "";
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { store: null, product: null };
  }
  const store = await storeForPage(normaliseHandle(decoded.replace(/^@/, ""))).catch(() => null);
  if (!store) return { store: null, product: null };
  // A draft is not on sale, and its card says so as its page would.
  const product = await readListing(store, id).catch(() => null);
  return { store, product: product && !product.hidden ? product : null };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, product: id } = await params;
  const { store, product } = await load(handle, id);
  return {
    title: store && product ? `${product.title} — ${store.name}` : "Not on sale",
    robots: { index: false, follow: false },
  };
}

/**
 * The page under the frame shows through; the card is the only thing drawn.
 * Its picture runs across the top in a frame tall enough for it, and sits
 * beside the title in one that is not (lib/embed-rules.ts, CARD_HEIGHTS).
 */
const SEE_THROUGH =
  "html,body{background:transparent!important;min-height:0!important;height:100%;margin:0}" +
  `.em-cover{display:none}@media (min-height:${CARD_COVER_FROM}px){.em-cover{display:block}.em-thumb{display:none}}` +
  // The summary gets whole lines only: as many as the card has room for
  // under its title, never one cut through the middle.
  ".em-sum{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:var(--lines,2)}" +
  `@media (max-height:${CARD_COVER_FROM - 1}px){.em-sum[data-picture]{-webkit-line-clamp:1}}`;

/** Past about this many characters a title takes two lines on the card, and the summary gives one up. */
const LONG_TITLE = 30;

export default async function EmbedCard({ params, searchParams }: Params) {
  await connection();
  const { handle, product: id } = await params;
  const place = placeFrom((await searchParams).utm_source);
  const loaded = await load(handle, id);
  const product = loaded.product;
  // With the visitor's country, for a fair price for it (lib/fair-price.ts).
  const store = loaded.store ? await forVisitor(loaded.store) : null;

  if (!store || !product) {
    return (
      <div className="flex h-screen items-center justify-center p-4" style={{ background: "transparent" }}>
        <style>{SEE_THROUGH}</style>
        <p className="rounded-3xl bg-white px-5 py-4 text-center text-sm text-ink-soft ring-1 ring-line">
          {store ? (
            <>
              {"This product is no longer on sale. "}
              <a href={tagged(`/@${store.handle}`, place)} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
                {`See ${store.name}`}
              </a>
            </>
          ) : (
            "This product is no longer on sale."
          )}
        </p>
      </div>
    );
  }

  const selling = canSell(store);
  const [soon, stock, noKeys, related, summary] = await Promise.all([
    isSoon(store, product.id).catch(() => false),
    stockLeft(store, product).catch(() => null),
    outOfKeys(store, product).catch(() => false),
    product.bumps.length ? readListings(store, bumpTargets(product)).catch(() => []) : Promise.resolve([]),
    summaryOf(store.statsId, product.id).catch(() => null),
  ]);
  const count = noKeys ? 0 : stock;
  const remaining = count !== null && canSellProduct(store, product) ? count : null;
  const { action, label } = pageAction(store, product, remaining, selling, related, soon);
  const page = tagged(productPath(store, product), place);
  // A product page link with the place on it, and the part of the page it was meant for.
  const into = (href: string) => (href.startsWith("#") ? `${page}${href}` : tagged(href, place));
  const testMode = selling && sellsInTestMode(store);
  const note = testMode
    ? "Test mode: no real card is charged."
    : action.kind === "checkout"
      ? "Secure checkout by Stripe, in a new tab."
      : action.kind === "link"
        ? `Opens on ${store.name}'s store, in a new tab.`
        : "";
  const image = product.image;

  return (
    <div
      className={`st-page st-theme-${store.look.theme} h-screen`}
      style={{ ...(lookStyle(store.look) as React.CSSProperties), background: "transparent" }}
      data-card-height={image ? CARD_HEIGHTS.picture : CARD_HEIGHTS.plain}
    >
      <style>{SEE_THROUGH}</style>
      <article className="st-card flex h-full flex-col overflow-hidden p-4" style={{ boxShadow: "none" }}>
        {image ? (
          <a href={page} target="_blank" rel="noopener" tabIndex={-1} className="em-cover -mx-4 -mt-4 mb-4 h-[160px] shrink-0 overflow-hidden" style={{ background: "var(--st-item)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(image)} alt={image.alt} width={image.width} height={image.height} className="h-full w-full object-cover" decoding="async" />
          </a>
        ) : null}
        <div className="flex items-start gap-3">
          {image ? (
            <a href={page} target="_blank" rel="noopener" tabIndex={-1} className="em-thumb shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(image)} alt={image.alt} width={64} height={64} className="h-16 w-16 rounded-2xl object-cover" decoding="async" />
            </a>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="font-display line-clamp-2 text-[1.0625rem] font-semibold leading-snug">
              <a href={page} target="_blank" rel="noopener" className="st-title-link">
                {product.title}
              </a>
            </h1>
            <p className="st-muted truncate text-sm">{store.name}</p>
          </div>
        </div>
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="st-price text-sm">
            <PriceTag store={store} product={product} />
          </p>
          {summary ? <RatingLine summary={summary} className="text-sm" /> : null}
          {remaining !== null && remaining > 0 && !soon ? (
            <p className="text-sm font-bold" style={{ color: "var(--st-accent-text)" }}>{`${remaining.toLocaleString("en-US")} left`}</p>
          ) : null}
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-hidden">
          {product.summary ? (
            <p
              className="em-sum st-muted text-sm leading-relaxed"
              data-picture={image ? "" : undefined}
              style={{ "--lines": product.title.length > LONG_TITLE ? 1 : 2 } as React.CSSProperties}
            >
              {product.summary}
            </p>
          ) : null}
        </div>
        {action.kind === "checkout" ? (
          <form action="/api/store/checkout" method="post" target="_blank" rel="noopener" className="mt-3" data-checkout="">
            <input type="hidden" name="handle" value={action.handle} />
            <input type="hidden" name="product" value={action.product} />
            <button type="submit" className="btn st-btn btn-block">
              {label}
            </button>
          </form>
        ) : action.kind === "link" ? (
          <a href={into(action.href)} target="_blank" rel="noopener" className="btn st-btn btn-block mt-3">
            {label}
          </a>
        ) : (
          <p className="st-muted mt-3 text-center text-sm font-semibold">{action.text}</p>
        )}
        {note ? <p className="st-muted mt-2 truncate text-center text-xs">{note}</p> : null}
      </article>
    </div>
  );
}
