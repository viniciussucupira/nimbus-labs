import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { type Product, type Store, centsToPrice, isFree, normaliseHandle, storeForHandle } from "@/lib/store";
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
import { isConnectInTestMode } from "@/lib/stripe-connect";
import { SITE_URL } from "@/lib/site-url";
import { BuyBox, ProductFacts, pricePill, productPath } from "@/components/store-product";
import { StoreTracking } from "@/components/store-tracking";
import { JsonLd } from "@/components/structured-data";

type Params = {
  params: Promise<{ handle: string; product: string }>;
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
 * The terms here are the store page's terms, drawn by the same components:
 * the same prices, options, plan, box for the product offered alongside,
 * limited quantity and checkout. A page that sold the same thing on
 * different terms would be a page nobody could trust.
 */
async function load(raw: string, id: string): Promise<{ store: Store; product: Product; asked: string } | null> {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  const asked = normaliseHandle(decoded);
  const store = await storeForHandle(asked);
  if (!store) return null;
  const product = store.products.find((item) => item.id === id);
  return product ? { store, product, asked } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, product: id } = await params;
  const found = await load(handle, id);
  if (!found) return { title: "Not found — Nimbus Labs" };
  const { store, product } = found;
  const about = product.about ? await readAbout(store.statsId, product.id) : "";
  const description = product.summary || aboutExcerpt(about) || `${product.title}, from the store of ${store.name}.`;
  const title = `${product.title} — ${store.name}`;
  const ownDomain = store.domain?.liveAt && canUseDomain(store) ? `https://${store.domain.name}` : null;
  const image = product.image
    ? { url: imageUrl(product.image), width: product.image.width, height: product.image.height, alt: product.image.alt || product.title }
    : store.photoId
      ? { url: photoUrl(store.photoId), width: 480, height: 480, alt: store.name }
      : null;
  // On the creator's own domain the page's address is the short one, /p/<id>,
  // which the proxy serves there (proxy.ts), as the store page's is "/".
  const canonical = ownDomain ? `${ownDomain}/p/${encodeURIComponent(product.id)}` : productPath(store, product);
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      ...(image ? { images: [image] } : {}),
    },
    twitter: { card: product.image ? "summary_large_image" : "summary", title, description },
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
 * and described without an offer rather than with a wrong one.
 */
function productData(store: Store, product: Product, description: string, soldOut: boolean) {
  const url = `${SITE_URL}${productPath(store, product)}`;
  const options = sellableOptions(product);
  const availability = `https://schema.org/${soldOut ? "SoldOut" : "InStock"}`;
  const offers = product.recurring
    ? null
    : options.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: centsToPrice(Math.min(...options.map((o) => o.priceCents))),
          highPrice: centsToPrice(Math.max(...options.map((o) => o.priceCents))),
          offerCount: options.length,
          availability,
          url,
        }
      : {
          "@type": "Offer",
          priceCurrency: "USD",
          price: isFree(product) ? "0" : centsToPrice(options[0]?.priceCents ?? product.priceCents),
          availability,
          url,
        };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    url,
    brand: { "@type": "Brand", name: store.name },
    ...(product.image ? { image: `${SITE_URL}${imageUrl(product.image)}` } : {}),
    ...(offers ? { offers } : {}),
  };
}

export default async function ProductPage({ params }: Params) {
  const { handle, product: id } = await params;
  const found = await load(handle, id);
  if (!found) {
    // A product taken off leaves its link leading to the store, not to nothing.
    const decoded = decodeURIComponent(handle);
    const store = decoded.startsWith("@") ? await storeForHandle(normaliseHandle(decoded)) : null;
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
  const rehearsal = selling && isConnectInTestMode();
  const [about, stock, noKeys] = await Promise.all([
    product.about ? readAbout(store.statsId, product.id) : Promise.resolve(""),
    stockLeft(store, product).catch(() => null),
    outOfKeys(store, product).catch(() => false),
  ]);
  const count = noKeys ? 0 : stock;
  const blocks = aboutBlocks(about);
  const remaining = count !== null && canSellProduct(store, product) ? count : null;
  const plan = activePlan(product);
  const pwyw = activePwyw(product);
  const description = product.summary || aboutExcerpt(about) || product.title;

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <JsonLd data={productData(store, product, description, remaining === 0)} />
      <main id="content" className="relative mx-auto max-w-2xl px-4 pb-16 pt-10 sm:pt-14">
        <Link
          href={`/@${store.handle}`}
          className="st-title-link mx-auto flex w-fit items-center gap-3 rounded-full py-1 pr-2"
        >
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
              <p className="st-price text-base">{pricePill(product)}</p>
            </div>
            <ProductFacts store={store} product={product} />
            {product.summary ? <p className="st-muted mt-4 text-lg leading-relaxed">{product.summary}</p> : null}
            {blocks.length > 0 ? <About blocks={blocks} /> : null}

            <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--st-line)" }}>
              {plan && canSellProduct(store, product) ? (
                <p className="st-muted text-sm font-semibold">{`Pay at once, or ${planWords(plan)}`}</p>
              ) : null}
              {pwyw && canSellProduct(store, product) ? (
                <p className="st-muted text-sm font-semibold">
                  {`You choose the price: $${centsToPrice(product.priceCents)} or more.`}
                </p>
              ) : null}
              {remaining !== null ? (
                <p className="mt-1 text-sm font-bold" style={{ color: "var(--st-accent-text)" }}>
                  {remaining === 0 ? "Sold out" : `${remaining.toLocaleString("en-US")} left`}
                </p>
              ) : null}
              <BuyBox store={store} product={product} remaining={remaining} writes={canWrite(store)} selling={selling} />
              {product.recurring && canManage(store) ? (
                <p className="mt-3 text-center text-sm">
                  <Link href={`/@${store.handle}/manage`} className="st-footer-link font-semibold">
                    Already a member? Manage or cancel
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        </article>

        {isFree(product) ? null : rehearsal ? (
          <p className="st-note mt-6 text-sm">
            <strong>This checkout is running in Stripe&apos;s test mode.</strong> No real money moves through it and no
            real card is charged, so do not put a card you own into it.
          </p>
        ) : selling ? (
          <p className="st-muted mt-6 text-center text-sm">
            Payment is taken by Stripe on {store.name}&apos;s own account. Nimbus never holds the money and takes none of it.
          </p>
        ) : (
          <p className="st-note mt-6 text-sm">
            <strong>This store cannot take payments yet.</strong> The price above is real, and nothing here can charge a
            card. To buy, write to {store.name} directly.
          </p>
        )}

        <div className="mt-10 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Everything from ${store.name}`}
          </Link>
          <StoreTracking store={store} />
        </div>
      </main>
    </div>
  );
}
