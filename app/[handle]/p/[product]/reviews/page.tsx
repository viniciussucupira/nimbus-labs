import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { lookStyle } from "@/lib/store-look";
import { canUseDomain } from "@/lib/domains";
import { SITE_URL } from "@/lib/site-url";
import { REVIEWS_PER_PAGE, summaryOf, visibleReviews } from "@/lib/reviews";
import { productPath } from "@/components/store-product";
import { ReviewsSection } from "@/components/review-list";

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, product: id } = await params;
  const decoded = decodeURIComponent(handle);
  const store = decoded.startsWith("@") ? await storeForPage(normaliseHandle(decoded)) : null;
  const product = store ? await readListing(store, id) : null;
  if (!store || !product) return { title: "Not found — Nimbus Labs" };
  return {
    title: `Reviews of ${product.title} — ${store.name}`,
    // The product's own page carries the rating for search engines; this
    // list is for people reading on, and is not a page of its own to rank.
    robots: { index: false, follow: true },
  };
}

/**
 * Every review on a product's page, thirty at a time, newest first — for the
 * reader who wants more than the ten the product's page shows.
 */
export default async function ReviewsPage({ params, searchParams }: Params) {
  const { handle, product: id } = await params;
  const decoded = decodeURIComponent(handle);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const product = await readListing(store, id);
  if (!product) redirect(`/@${store.handle}`);
  const reachedOn = (await headers()).get("x-nimbus-domain");
  if (reachedOn && (store.domain?.name !== reachedOn || !canUseDomain(store))) {
    redirect(`${SITE_URL}${productPath(store, product)}/reviews`);
  }

  const query = await searchParams;
  const asked = Number(typeof query.page === "string" ? query.page : "1");
  const summary = await summaryOf(store.statsId, product.id);
  const pages = Math.max(1, Math.ceil(summary.visible / REVIEWS_PER_PAGE));
  const page = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, pages) : 1;
  const reviews = await visibleReviews(store.statsId, product.id, (page - 1) * REVIEWS_PER_PAGE, REVIEWS_PER_PAGE);
  const base = `/@${store.handle}/p/${product.id}/reviews`;

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-2xl px-4 pb-16 pt-10 sm:pt-14">
        <p className="text-center">
          <Link href={productPath(store, product)} className="st-footer-link text-sm font-semibold">
            {`Back to ${product.title}`}
          </Link>
        </p>
        <div className="mt-8">
          <ReviewsSection
            heading={`Reviews of ${product.title}`}
            summary={summary}
            reviews={reviews}
            storeName={store.name}
            productTitle={product.title}
            moreHref={null}
          />
          {summary.visible === 0 ? <p className="st-note mt-6 text-sm">There are no reviews to show.</p> : null}
        </div>
        {pages > 1 ? (
          <nav aria-label="Pages of reviews" className="mt-8 flex items-center justify-between gap-3 text-sm font-semibold">
            {page > 1 ? (
              <Link prefetch={false} href={`${base}?page=${page - 1}`} className="btn st-btn">
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="st-muted">{`Page ${page} of ${pages}`}</span>
            {page < pages ? (
              <Link prefetch={false} href={`${base}?page=${page + 1}`} className="btn st-btn">
                Older
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </main>
    </div>
  );
}
