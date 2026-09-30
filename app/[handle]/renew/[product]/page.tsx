import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { canSellProduct, fromPriceCents } from "@/lib/store-checkout";
import { membershipPrice } from "@/lib/product-recurring";
import { canManage } from "@/lib/membership-manage";
import { canRecover } from "@/lib/buyer-orders";
import { productPath } from "@/components/store-product";
import { readListing } from "@/lib/catalog";
import { readWinBack } from "@/lib/winback-send";
import { winbackWords } from "@/lib/winback";

export const metadata: Metadata = {
  title: "Your membership has ended — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** What the come-back button can answer (app/api/store/come-back/open). */
const OFFER_NOTICES: Record<string, string> = {
  expired: "This offer has ended. You can still come back at the usual price below.",
  unavailable: "This offer cannot be used for this membership any more. You can still come back at the usual price below, if it is offered.",
  refused: "The offer could not be applied just now. You can come back at the usual price below, or reply to the email it came in.",
  limited: "Too many tries for now. Wait a few minutes and press the button again.",
};

/**
 * Where a former member lands when they open something their membership used
 * to give them: a download from the thanks page or their list of purchases.
 *
 * It says plainly what happened and what to do, in that order: the
 * membership ended, so what it gave is closed; joining again opens it; and
 * if a payment failed rather than the membership being cancelled, fixing the
 * card is the quicker way back. The page reveals nothing about anyone: it
 * reads the same for whoever opens it, and it is only reached from a door
 * that has just checked the membership with Stripe.
 */
export default async function RenewPage({ params, searchParams }: Params) {
  const { handle: raw, product: productId } = await params;
  const query = await searchParams;
  const back = typeof query.back === "string" ? query.back : "";
  const status = typeof query.status === "string" ? query.status : "";
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const product = await readListing(store, productId) ?? null;

  const selling = product ? canSellProduct(store, product) : false;
  const price =
    product?.recurring && selling
      ? membershipPrice(product.recurring, `${formatMoney(fromPriceCents(product), store.currency)}`)
      : null;
  const needsChoice = product ? product.options.length > 0 : false;
  // A come-back email's link (lib/winback-send.ts): the offer it carries, for
  // the address it was sent to, while it lasts.
  const offer = back && product && selling ? await readWinBack(store, product.id, back).catch(() => null) : null;
  const until = offer
    ? new Date(offer.until * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";

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
          <p className="st-label">Membership</p>
          <h1 className="font-display mt-1 text-3xl font-semibold leading-tight tracking-[-0.02em]">
            Your membership has ended
          </h1>
          <p className="st-muted mt-4 text-lg leading-relaxed">
            {product
              ? `Your membership for ${product.title} is no longer running, so what it gave you access to is closed now. Renew it and everything opens again straight away.`
              : `This membership is no longer running, and ${store.name} no longer lists it.`}
          </p>

          {back && (!offer || OFFER_NOTICES[status]) ? (
            <div className="st-note mt-6 text-sm" role="status">
              {OFFER_NOTICES[status] ?? OFFER_NOTICES.expired}
            </div>
          ) : null}

          {offer && product && !OFFER_NOTICES[status] ? (
            <form action="/api/store/come-back/open" method="post" className="mt-7">
              <input type="hidden" name="handle" value={store.handle} />
              <input type="hidden" name="product" value={product.id} />
              <input type="hidden" name="back" value={back} />
              <p className="st-price text-sm">Your come-back offer</p>
              <p className="font-display mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em]">
                {winbackWords(offer)}
              </p>
              <p className="st-muted mt-2 text-sm">
                {`For ${offer.email}, until ${until}. Applied on Stripe's page before you pay; no free trial this time.`}
              </p>
              <button type="submit" className="btn st-btn btn-lg btn-block mt-5">
                Come back with this offer
              </button>
            </form>
          ) : product && selling ? (
            needsChoice ? (
              <Link href={productPath(store, product)} className="btn st-btn btn-lg btn-block mt-7">
                {`Renew ${product.title}`}
              </Link>
            ) : (
              <form action="/api/store/checkout" method="post" className="mt-7" data-checkout="">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="product" value={product.id} />
                <button type="submit" className="btn st-btn btn-lg btn-block">
                  {price ? `Renew · ${price}` : "Renew"}
                </button>
              </form>
            )
          ) : product ? (
            <p className="st-note mt-7 text-sm">
              {`${store.name} is not taking new members for this right now. Reply to your order confirmation email and it reaches them.`}
            </p>
          ) : null}

          {product ? (
            <p className="mt-4 text-center text-sm">
              <Link href={productPath(store, product)} className="st-footer-link font-semibold">
                {`See ${product.title}`}
              </Link>
            </p>
          ) : null}

          <div className="mt-7 space-y-3 border-t pt-6 text-sm" style={{ borderColor: "var(--st-line)" }}>
            {canManage(store) ? (
              <p className="st-muted">
                {"Did it end because a payment failed, not because you canceled? Updating the card may bring it back without renewing: "}
                <Link href={`/@${store.handle}/manage`} className="font-semibold underline underline-offset-4" style={{ color: "var(--st-text)" }}>
                  manage your membership
                </Link>
                {" with the email you paid with."}
              </p>
            ) : null}
            {canRecover(store) ? (
              <p className="st-muted">
                {"Anything you bought outright stays yours: "}
                <Link href={`/@${store.handle}/orders`} className="font-semibold underline underline-offset-4" style={{ color: "var(--st-text)" }}>
                  get what you bought again
                </Link>
                .
              </p>
            ) : null}
          </div>
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
