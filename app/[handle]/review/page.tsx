import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { clientAddress, withinLimit } from "@/lib/request-guard";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { imageUrl } from "@/lib/product-image";
import { canRecover } from "@/lib/buyer-orders";
import { doorFields, openDoor, readDoor } from "@/lib/review-proof";
import { type Review, readReview, reviewId } from "@/lib/reviews";
import { REVIEW_NOTICES, ReviewForm } from "@/components/review-form";
import { productPath } from "@/components/store-product";

export const metadata: Metadata = {
  title: "Your review — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * Openings of this page with an order in it, from one connection to one
 * store, in ten minutes. Each asks the creator's Stripe account about the
 * order, so a script trying order numbers here would be spending the
 * creator's allowance with Stripe; a buyer reviewing needs a handful.
 */
const VIEWS_PER_TEN_MINUTES = 60;

/**
 * Where a buyer reviews what one order bought: reached from the list of
 * purchases or from the link in the email asking for a review.
 *
 * The order is read from the creator's Stripe account as the page opens
 * (lib/review-proof.ts), so a link to an order that was refunded, or that is
 * not this store's, shows no form at all. Each product in the order gets its
 * own form, filled in with the buyer's review when they already wrote one.
 */
export default async function ReviewPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const get = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
  const door = readDoor(get);
  const status = get("status");
  const statusProduct = get("product");
  const allowed = door ? await withinLimit("review-view", `${clientAddress({ headers: await headers() })}|${store.handle}`, VIEWS_PER_TEN_MINUTES, 600) : true;
  const opened = door && allowed ? await openDoor(store, door) : ({ state: allowed ? "no" : "slow" } as const);

  let existing = new Map<string, Review | null>();
  if (opened.state === "ok" && store.statsId) {
    const statsId = store.statsId;
    const rows = await Promise.all(
      opened.proof.products.map(async (p) => [p.id, await readReview(statsId, p.id, reviewId(statsId, p.id, opened.proof.email))] as const),
    );
    existing = new Map(rows);
  }

  const problem =
    opened.state === "ok"
      ? opened.proof.refunded
        ? { title: "This order was refunded", body: `An order ${store.name} refunded in full cannot be reviewed. If you wrote a review from it, its stars no longer count.` }
        : null
      : opened.state === "expired"
        ? {
            title: "This link has expired",
            body: canRecover(store)
              ? "Ask for your purchases again: a new link usually arrives by email within a minute, and you can review from there."
              : `Reply to the order confirmation ${store.name} emailed you, and it reaches them.`,
          }
        : opened.state === "error"
          ? { title: "Something went wrong on our side", body: "Nothing was changed. Try again in a moment." }
          : opened.state === "slow"
            ? { title: "Too many tries", body: "This page was opened many times in a few minutes. Wait a little, then open your link again." }
            : { title: "This order cannot be reviewed here", body: "Open the link from your email or from your list of purchases." };

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-xl px-4 py-14 sm:py-20">
        <div className="text-center">
          {store.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(store.photoId)} alt="" width={72} height={72} className="st-avatar" style={{ width: 72, height: 72 }} />
          ) : (
            <p aria-hidden="true" className="st-avatar st-avatar-initial" style={{ width: 72, height: 72, fontSize: "1.75rem" }}>
              {store.name.slice(0, 1).toUpperCase()}
            </p>
          )}
          <p className="st-muted mt-4 text-sm font-semibold">{store.name}</p>
        </div>

        <div className="st-card mt-6 p-6 sm:p-9">
          {problem || opened.state !== "ok" ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">{problem?.title}</h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">{problem?.body}</p>
              {opened.state === "expired" && canRecover(store) ? (
                <Link href={`/@${store.handle}/orders`} className="btn st-btn btn-lg mt-7">
                  Get my purchases
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <p className="st-price text-sm">Verified purchase</p>
              <h1 className="font-display mt-5 text-3xl font-semibold leading-tight tracking-[-0.02em]">
                {opened.proof.products.length === 1 ? `Review ${opened.proof.products[0].title}` : "Review what you bought"}
              </h1>
              <p className="st-muted mt-3 leading-relaxed">
                {`Bought from ${store.name}${opened.proof.paidAt ? ` on ${DATE.format(new Date(opened.proof.paidAt * 1000))}` : ""}. An honest review is what helps the next buyer, and ${store.name}.`}
              </p>
              <div className="mt-8 space-y-10">
                {opened.proof.products.map((product) => (
                  <section key={product.id} aria-label={product.title} className="space-y-4">
                    {opened.proof.products.length > 1 || product.image ? (
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl(product.image)} alt="" width={48} height={48} className="st-thumb" />
                        ) : null}
                        <Link href={productPath(store, product)} className="st-title-link font-semibold">
                          {product.title}
                        </Link>
                      </div>
                    ) : null}
                    <ReviewForm
                      handle={store.handle}
                      door={door ? doorFields(door) : {}}
                      product={{ id: product.id, title: product.title }}
                      existing={existing.get(product.id) ?? null}
                      storeName={store.name}
                      back="review"
                      notice={statusProduct === product.id && REVIEW_NOTICES[status] ? status : null}
                    />
                  </section>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Back to ${store.name}`}
          </Link>
        </div>
      </main>
    </div>
  );
}
