import { paypalReady, takenBy } from "@/lib/paypal-sales";
import { salePrice } from "@/lib/store-sale";
import { isSoon } from "@/lib/waitlist";
import { canGift } from "@/lib/gift-rules";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cache } from "react";
import { type Listing, type Store, isFree, normaliseHandle, storeForPage } from "@/lib/store";
import { formatMoney, moneyField } from "@/lib/money";
import { readListing, readListings } from "@/lib/catalog";
import { canSell, canSellProduct, sellableOptions } from "@/lib/store-checkout";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { imageUrl } from "@/lib/product-image";
import { type Block, type Piece, aboutBlocks, aboutExcerpt, readAbout } from "@/lib/product-about";
import { activePlan, planWords } from "@/lib/product-extras";
import { activePwyw } from "@/lib/pay-what-you-want";
import { stockLeft } from "@/lib/stock";
import { outOfKeys } from "@/lib/licence-keys";
import { canWrite } from "@/lib/mail";
import { canManage } from "@/lib/membership-manage";
import { canUseDomain } from "@/lib/domains";
import { isHouseStore } from "@/lib/house-store";
import { sellsInTestMode } from "@/lib/stripe-connect";
import { DemoNote } from "@/components/demo-notes";
import { SITE_URL } from "@/lib/site-url";
import { EMPTY_PAGE, type SalesPage } from "@/lib/sales-page";
import { readPage } from "@/lib/sales-page-store";
import { type Summary, REVIEWS_ON_PAGE, average, showsRating, summaryOf, visibleReviews } from "@/lib/reviews";
import { BuyBox, GiftBox, PriceTag, ProductFacts, offNow, pageAction, productPath } from "@/components/store-product";
import { type BlockContext, BlockView, HeroView } from "@/components/sales-blocks";
import { RatingLine, ReviewsSection } from "@/components/review-list";
import { StoreTracking } from "@/components/store-tracking";
import { JsonLd } from "@/components/structured-data";
import { offeredItems } from "@/lib/bundles";
import { MIN_BUNDLE_ITEMS, worthWords } from "@/lib/bundle-rules";

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * A product's own page: its picture, everything the creator wrote about it,
 * and the same buy box the store page has.
 *
 * It exists for the buyer who wants to read before paying, and for the link a
 * creator shares when they talk about one thing rather than the whole store —
 * which is why it has a title, a description and a picture of its own for
 * search engines and for the card a shared link unfolds into.
 *
 * A creator can build it from blocks in the studio (lib/sales-page.ts): a
 * sales page for something paid, or a landing page with the sign-up form for
 * something free, where ads can send people. Without blocks it is the page
 * it has always been. Either way the buyers' verified reviews are on it
 * (lib/reviews.ts) once there are any.
 *
 * The terms here are the store page's terms, drawn by the same components:
 * the same prices, options, plan, box for the product offered alongside,
 * limited quantity and checkout. A page that sold the same thing on
 * different terms would be a page nobody could trust.
 */
const load = cache(async (raw: string, id: string): Promise<{ store: Store; product: Listing; asked: string } | null> => {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  const asked = normaliseHandle(decoded);
  const store = await storeForPage(asked);
  if (!store) return null;
  const product = await readListing(store, id);
  // A draft has no page until the creator publishes it.
  return product && !product.hidden ? { store, product, asked } : null;
});

async function pageOf(store: Store, product: Listing): Promise<SalesPage> {
  return product.page ? readPage(store.statsId, product.id).catch(() => ({ ...EMPTY_PAGE, blocks: [] })) : { ...EMPTY_PAGE, blocks: [] };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, product: id } = await params;
  const found = await load(handle, id);
  if (!found) return { title: "Not found — Marktmorgen" };
  const { store, product } = found;
  const [about, page] = await Promise.all([product.about ? readAbout(store.statsId, product.id) : Promise.resolve(""), pageOf(store, product)]);
  const description =
    page.seoDescription || product.summary || aboutExcerpt(about) || `${product.title}, from the store of ${store.name}.`;
  const title = page.seoTitle || `${product.title} — ${store.name}`;
  const ownDomain = store.domain?.liveAt && canUseDomain(store) ? `https://${store.domain.name}` : null;
  // On the creator's own domain the page's address is the short one, /p/<id>,
  // which the proxy serves there (proxy.ts), as the store page's is "/".
  const canonical = ownDomain ? `${ownDomain}/p/${encodeURIComponent(product.id)}` : productPath(store, product);
  // The picture a shared link unfolds into is drawn from the product's own
  // picture by opengraph-image.tsx beside this page.
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: "website", title, description, url: canonical },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** One line of a description, with its links drawn as links. */
function Line({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((piece, i) =>
        piece.href ? (
          <a key={i} href={piece.href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {piece.text}
          </a>
        ) : (
          <span key={i}>{piece.text}</span>
        ),
      )}
    </>
  );
}

function About({ blocks }: { blocks: Block[] }) {
  return (
    <div className="st-about mt-6 leading-relaxed">
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Line pieces={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                <Line pieces={line} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

/**
 * What a search engine is told about the offer: nothing the page does not
 * say. A membership's schedule does not fit the simple shape, so it is named
 * and described without an offer rather than with a wrong one. The rating is
 * there only when the page shows one, with the same average and count.
 */
function productData(store: Store, product: Listing, description: string, soldOut: boolean, summary: Summary | null, soon = false) {
  const url = `${SITE_URL}${productPath(store, product)}`;
  const options = sellableOptions(product);
  const availability = `https://schema.org/${soon ? "OutOfStock" : soldOut ? "SoldOut" : "InStock"}`;
  const offers = product.recurring
    ? null
    : options.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: store.currency.toUpperCase(),
          lowPrice: moneyField(Math.min(...options.map((o) => o.priceCents)), store.currency),
          highPrice: moneyField(Math.max(...options.map((o) => o.priceCents)), store.currency),
          offerCount: options.length,
          availability,
          url,
        }
      : {
          "@type": "Offer",
          priceCurrency: store.currency.toUpperCase(),
          price: isFree(product) ? "0" : moneyField(salePrice(options[0]?.priceCents ?? product.priceCents, offNow(store, product)), store.currency),
          // A sale's price is said with the moment it ends (lib/store-sale.ts).
          ...(offNow(store, product) ? { priceValidUntil: new Date(store.sale.ends * 1000).toISOString().slice(0, 10) } : {}),
          availability,
          url,
        };
  const rated = summary && showsRating(summary) ? summary : null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    url,
    brand: { "@type": "Brand", name: store.name },
    ...(product.image ? { image: `${SITE_URL}${imageUrl(product.image)}` } : {}),
    ...(offers ? { offers } : {}),
    ...(rated
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: average(rated).toFixed(1),
            reviewCount: rated.count,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };
}

export default async function ProductPage({ params, searchParams }: Params) {
  const { handle, product: id } = await params;
  const found = await load(handle, id);
  if (!found) {
    // A product taken off leaves its link leading to the store, not to nothing.
    const decoded = decodeURIComponent(handle);
    const store = decoded.startsWith("@") ? await storeForPage(normaliseHandle(decoded)) : null;
    if (store) redirect(`/@${store.handle}`);
    notFound();
  }
  const { store, product, asked } = found;

  // The same rules the store page follows for the creator's own domain and
  // for an old address of the store.
  const reachedOn = (await headers()).get("x-nimbus-domain");
  if (reachedOn && (store.domain?.name !== reachedOn || !canUseDomain(store))) {
    redirect(`${SITE_URL}${productPath(store, product)}`);
  }
  if (asked !== store.handle && !reachedOn) permanentRedirect(productPath(store, product));

  const selling = canSell(store);
  // Coming soon: a waitlist where the buy box would be (lib/waitlist.ts).
  const soon = await isSoon(store, product.id).catch(() => false);
  const query = searchParams ? await searchParams : {};
  const giftProblem = typeof query.gift === "string" ? query.gift : "";
  // Asked of the store, as on the store page (lib/house-store.ts).
  const rehearsal = selling && sellsInTestMode(store);
  const [about, stock, noKeys, page, summary, related, inside] = await Promise.all([
    product.about ? readAbout(store.statsId, product.id) : Promise.resolve(""),
    stockLeft(store, product).catch(() => null),
    outOfKeys(store, product).catch(() => false),
    pageOf(store, product),
    summaryOf(store.statsId, product.id).catch(() => null),
    // What its order bump offers, drawn in the same box as on the store page.
    product.bump ? readListings(store, [product.bump.productId]) : Promise.resolve([]),
    // What a bundle holds now, each product as it is today (lib/bundles.ts).
    product.bundle ? offeredItems(store, [product]).then((m) => m.get(product.id) ?? []).catch(() => []) : Promise.resolve(null),
  ]);
  const bundleReady = !product.bundle || (inside?.length ?? 0) >= MIN_BUNDLE_ITEMS;
  const worth = inside && product.bundle ? worthWords(inside, product.priceCents, store.currency) : null;
  // What a bundle holds, each with what it costs on its own and its own page
  // when it has one on the store.
  const bundleList =
    inside && inside.length > 0 ? (
      <section className="mt-6" aria-labelledby="inside-title">
        <h2 id="inside-title" className="st-label">{`What is inside: ${inside.length} products`}</h2>
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--st-line)" }}>
          {inside.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5" style={{ borderColor: "var(--st-line)" }}>
              {item.hidden ? (
                <span className="min-w-0 font-semibold">{item.title}</span>
              ) : (
                <Link prefetch={false} href={productPath(store, item)} className="st-title-link min-w-0 font-semibold">
                  {item.title}
                </Link>
              )}
              <span className="st-muted shrink-0 text-sm tabular-nums">
                {`${item.course ? `Course, ${item.course.lessons} ${item.course.lessons === 1 ? "lesson" : "lessons"} \u00b7 ` : ""}${formatMoney(item.priceCents, store.currency)} on its own`}
              </span>
            </li>
          ))}
        </ul>
        {worth ? <p className="mt-3 font-semibold">{worth}</p> : null}
        <p className="st-muted mt-2 text-sm">Each one is yours straight after paying, as if you had bought it on its own.</p>
      </section>
    ) : null;
  const reviews = summary && summary.visible > 0 ? await visibleReviews(store.statsId, product.id, 0, REVIEWS_ON_PAGE).catch(() => []) : [];
  const count = noKeys ? 0 : stock;
  const blocks = aboutBlocks(about);
  const remaining = count !== null && canSellProduct(store, product) ? count : null;
  // Bought for somebody else, where it can be: on sale, not coming soon, not sold out (lib/gift-rules.ts).
  const giftable = selling && !soon && remaining !== 0 && bundleReady && canSellProduct(store, product) && canGift(product);
  const plan = activePlan(product);
  const pwyw = activePwyw(product);
  const description = page.seoDescription || product.summary || aboutExcerpt(about) || product.title;
  const free = isFree(product);
  const built = page.blocks.length > 0;
  // A product with any review — even only hidden ones — says so on its page.
  const anyReviews = summary !== null && summary.visible + summary.hidden > 0;
  const reviewsHref = `/@${store.handle}/p/${product.id}/reviews`;
  const reviewsPart = (heading: string): ReactNode =>
    anyReviews && summary ? (
      <ReviewsSection
        heading={heading}
        summary={summary}
        reviews={reviews}
        storeName={store.name}
        productTitle={product.title}
        moreHref={summary.visible > reviews.length ? reviewsHref : null}
      />
    ) : null;

  // Bought with the creator's own PayPal as well, or instead (lib/paypal-sales.ts).
  const byPayPal = paypalReady(store, product);
  const payments = free ? null : rehearsal && isHouseStore(store) ? (
    <DemoNote />
  ) : rehearsal ? (
    <p className="st-note mt-6 text-sm">
      <strong>This checkout is running in Stripe&apos;s test mode.</strong> No real money moves through it and no
      real card is charged, so do not put a card you own into it.
    </p>
  ) : selling || byPayPal ? (
    <p className="st-muted mt-6 text-center text-sm">
      Payment is taken by {takenBy(selling, byPayPal)} on {store.name}&apos;s own account. Marktmorgen never holds the money and takes none of it.
    </p>
  ) : (
    <p className="st-note mt-6 text-sm">
      <strong>This store cannot take payments yet.</strong> The price above is real, but nothing here can charge a
      card. To buy, write to {store.name} directly.
    </p>
  );

  const buyTerms = (
    <>
      {plan && canSellProduct(store, product) ? (
        <p className="st-muted text-sm font-semibold">{`Pay in full, or in ${planWords(plan, store.currency)}`}</p>
      ) : null}
      {pwyw && canSellProduct(store, product) ? (
        <p className="st-muted text-sm font-semibold">{`You choose the price: ${formatMoney(product.priceCents, store.currency)} or more.`}</p>
      ) : null}
      {remaining !== null ? (
        <p className="mt-1 text-sm font-bold" style={{ color: "var(--st-accent-text)" }}>
          {remaining === 0 ? "Sold out" : `${remaining.toLocaleString("en-US")} left`}
        </p>
      ) : null}
      <BuyBox store={store} product={product} related={related} remaining={remaining} writes={canWrite(store)} selling={selling} ready={bundleReady} soon={soon} />
      {giftable ? <GiftBox store={store} product={product} problem={giftProblem} /> : null}
      {product.recurring && canManage(store) ? (
        <p className="mt-3 text-center text-sm">
          <Link href={`/@${store.handle}/manage`} className="st-footer-link font-semibold">
            Already a member? Manage or cancel
          </Link>
        </p>
      ) : null}
    </>
  );

  const storeChip = (
    <Link href={`/@${store.handle}`} className="st-title-link mx-auto flex w-fit items-center gap-3 rounded-full py-1 pr-2">
      {store.photoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl(store.photoId)} alt="" width={40} height={40} className="st-avatar !mx-0" style={{ width: 40, height: 40 }} />
      ) : (
        <span aria-hidden="true" className="st-avatar st-avatar-initial !mx-0" style={{ width: 40, height: 40, fontSize: "1rem" }}>
          {store.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="font-semibold">{store.name}</span>
    </Link>
  );

  const footer = (
    <div className="mt-10 text-center">
      <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
        {`Everything from ${store.name}`}
      </Link>
      <StoreTracking store={store} />
    </div>
  );

  const shell = (children: ReactNode, wide: boolean) => (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <JsonLd data={productData(store, product, description, remaining === 0, summary, soon)} />
      <main id="content" className={`relative mx-auto ${wide ? "max-w-3xl" : "max-w-2xl"} px-4 pb-16 pt-10 sm:pt-14`}>
        {children}
      </main>
    </div>
  );

  if (!built) {
    return shell(
      <>
        {storeChip}
        <article className="st-card mt-6 overflow-hidden">
          {product.image ? (
            <div className="px-4 pt-4 sm:px-6 sm:pt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(product.image)}
                alt={product.image.alt}
                width={product.image.width}
                height={product.image.height}
                fetchPriority="high"
                className="st-hero-img"
                style={{ aspectRatio: `${product.image.width} / ${product.image.height}` }}
              />
            </div>
          ) : null}

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <h1 className="font-display min-w-0 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">
                {product.title}
              </h1>
              <p className="st-price text-base"><PriceTag store={store} product={product} /></p>
            </div>
            {summary ? <RatingLine summary={summary} href="#reviews" className="mt-2" /> : null}
            <ProductFacts store={store} product={product} bundleItems={inside} linkCourse={false} />
            {product.summary ? <p className="st-muted mt-4 text-lg leading-relaxed">{product.summary}</p> : null}
            {blocks.length > 0 ? <About blocks={blocks} /> : null}
            {bundleList}

            <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--st-line)" }}>
              {buyTerms}
            </div>
          </div>
        </article>

        {payments}
        {anyReviews ? <section className="sp-section">{reviewsPart("Reviews")}</section> : null}
        {footer}
      </>,
      false,
    );
  }

  // Built from blocks: the hero at the top when there is one, then the
  // creator's blocks in their order. Something free has its sign-up form
  // right under the hero, where an ad's visitor lands; something paid has
  // its buy box after the blocks, and the buttons in between lead to it or
  // straight to the checkout.
  const { action, label } = pageAction(store, product, remaining, selling, related, soon);
  const ctx: BlockContext = {
    storeName: store.name,
    productTitle: product.title,
    picture: product.image
      ? { src: imageUrl(product.image), alt: product.image.alt, width: product.image.width, height: product.image.height }
      : null,
    photo: store.photoId ? photoUrl(store.photoId) : null,
    action,
    defaultLabel: label,
  };
  const [first, ...others] = page.blocks;
  const hero = first?.kind === "hero" ? first : null;
  const rest = hero ? others : page.blocks;
  const placed = page.blocks.find((block) => block.kind === "reviews");
  const pill = <p className="st-price text-sm"><PriceTag store={store} product={product} /></p>;
  const rating = summary ? <RatingLine summary={summary} href="#reviews" /> : null;

  const buySection = (
    <section id={free ? "get" : "buy"} className="st-card sp-section scroll-mt-6 p-6 sm:p-8" aria-labelledby="buy-title">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 id="buy-title" className="font-display min-w-0 text-xl font-semibold leading-snug tracking-[-0.01em] sm:text-2xl">
          {free ? `Get ${product.title}` : product.title}
        </h2>
        <p className="st-price text-base"><PriceTag store={store} product={product} /></p>
      </div>
      <ProductFacts store={store} product={product} linkCourse={false} bundleItems={inside} />
      {bundleList}
      <div className="mt-4">{buyTerms}</div>
    </section>
  );

  return shell(
    <div className="sp-body sp-wide">
      {storeChip}
      <div className="mt-8">
        {hero ? (
          <HeroView block={hero} ctx={ctx} pill={pill} rating={rating} />
        ) : (
          <header>
            <div className="flex flex-wrap items-center gap-2">
              {pill}
              {rating}
            </div>
            <h1 className="font-display mt-4 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-5xl">
              {product.title}
            </h1>
            {product.summary ? <p className="st-muted mt-4 text-lg leading-relaxed sm:text-xl">{product.summary}</p> : null}
          </header>
        )}
      </div>
      {free ? buySection : null}
      {rest.map((block) => (
        <BlockView key={block.id} block={block} ctx={ctx} reviews={block.kind === "reviews" ? reviewsPart(block.heading) : null} />
      ))}
      {free ? null : buySection}
      {payments}
      {!placed && anyReviews ? <section className="sp-section">{reviewsPart("Reviews")}</section> : null}
      {footer}
    </div>,
    true,
  );
}
