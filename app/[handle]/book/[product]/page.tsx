import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { centsToPrice, normaliseHandle, storeForHandle } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { canSellProduct } from "@/lib/store-checkout";
import { catchUpBookings, isCallProduct, slotsForProduct } from "@/lib/calls";
import { SITE_URL } from "@/lib/site-url";
import { SlotPicker } from "@/components/slot-picker";
import { StoreTracking } from "@/components/store-tracking";

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Book a call — Nimbus Labs",
  robots: { index: false, follow: true },
};

const NOTICES: Record<string, { title: string; body: string }> = {
  taken: {
    title: "That time was just taken",
    body: "Somebody booked it a moment before you, or it is being paid for right now. Pick another; nothing was charged.",
  },
  invalid: {
    title: "Pick a time first",
    body: "Choose one of the times below, then continue.",
  },
  error: {
    title: "Something went wrong on our side",
    body: "Nothing was charged. Try again in a moment.",
  },
  unavailable: {
    title: "This call cannot be booked right now",
    body: "Nothing was charged.",
  },
};

/** Where a buyer picks a time for a paid call. */
export default async function BookPage({ params, searchParams }: Params) {
  const { handle: raw, product: productId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();
  const product = store.products.find((item) => item.id === productId);
  if (!product || !isCallProduct(product)) redirect(`/@${store.handle}`);

  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "";
  const notice = NOTICES[status] ?? null;
  const open = canSellProduct(store, product);
  const read = open ? await slotsForProduct(store, product) : null;
  const days = read ? read.days : null;
  const starts = days ? days.flatMap((day) => day.starts) : [];
  // Paid calls whose buyer never came back from Stripe get their emails now,
  // after the page is sent, so the buyer here never waits for it.
  if (read && read.paid.length) after(() => catchUpBookings(store, read.paid, SITE_URL));

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-xl px-4 py-12 sm:py-16">
        <div className="flex items-center justify-center gap-3">
          {store.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(store.photoId)} alt="" width={48} height={48} className="st-avatar !mx-0" style={{ width: 48, height: 48 }} />
          ) : (
            <span aria-hidden="true" className="st-avatar st-avatar-initial !mx-0" style={{ width: 48, height: 48, fontSize: "1.25rem" }}>
              {store.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-semibold">{store.name}</span>
        </div>

        <div className="st-card mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display min-w-0 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">
              {product.title}
            </h1>
            <p className="st-price text-base">${centsToPrice(product.priceCents)}</p>
          </div>
          <p className="st-muted mt-2 text-sm font-semibold">
            {`${product.call.minutes}-minute call${product.call.room ? " · online, the link is sent when you book" : " · online"}`}
          </p>
          {product.summary ? <p className="st-muted mt-3 leading-relaxed">{product.summary}</p> : null}

          {notice ? (
            <div className="st-note mt-6" role="alert">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
              <p className="mt-1 text-sm">{notice.body}</p>
            </div>
          ) : null}

          {!open ? (
            <div className="st-note mt-6">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>This call cannot be booked right now</p>
              <p className="mt-1 text-sm">{`${store.name}'s store is not taking payments at the moment. Nothing here can charge a card.`}</p>
            </div>
          ) : days === null ? (
            <div className="st-note mt-6">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>The times could not be read just now</p>
              <p className="mt-1 text-sm">Nothing was charged. Refresh the page in a moment.</p>
            </div>
          ) : (
            <SlotPicker
              starts={starts}
              creatorTz={product.call.tz}
              handle={store.handle}
              productId={product.id}
              minutes={product.call.minutes}
              price={centsToPrice(product.priceCents)}
            />
          )}
        </div>

        <p className="st-muted mt-6 text-center text-sm">
          {`Payment is taken by Stripe on ${store.name}'s own account. Nimbus never holds the money and takes none of it.`}
        </p>
        <div className="mt-6 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Back to ${store.name}`}
          </Link>
          <StoreTracking store={store} />
        </div>
      </main>
    </div>
  );
}
