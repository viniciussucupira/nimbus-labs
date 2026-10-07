import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { StoreTracking } from "@/components/store-tracking";
import { readListing } from "@/lib/catalog";
import { WAIT_TOKEN, readWaitToken } from "@/lib/waitlist";
import { productPath } from "@/components/store-product";

export const metadata: Metadata = {
  title: "Waitlist — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. The confirmation goes to the address you type, so it has to be one you can open.",
  },
  limited: {
    title: "Too many sign-ups for now",
    body: "To keep this form from being used to flood somebody's inbox, it takes a limited number an hour. Try again in an hour.",
  },
  full: {
    title: "This waitlist is full",
    body: "It holds as many people as it can. Nothing was kept.",
  },
  closed: {
    title: "This is not coming soon any more",
    body: "It may already be on sale. Nothing was kept.",
  },
  error: {
    title: "We could not send it just now",
    body: "Try again in a moment.",
  },
  expired: {
    title: "This link has expired",
    body: "A confirmation link works for 7 days. Join again from the product's page; it takes a few seconds.",
  },
};

/**
 * The waitlist's own page: "check your inbox" after joining, the button that
 * confirms (a link only shows it, because mail scanners open links too), the
 * button that removes an address, and what happened after each.
 */
export default async function WaitlistPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const read = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
  const token = read("token");
  const leave = read("leave");
  const status = read("status");
  if (!token && !leave && !status) redirect(`/@${store.handle}`);

  const grant = token && WAIT_TOKEN.test(token) ? await readWaitToken(token) : leave && WAIT_TOKEN.test(leave) ? await readWaitToken(leave) : null;
  const productId = grant?.p ?? read("product");
  const product = productId ? await readListing(store, productId) : null;
  const title = product?.title ?? "it";

  let body: React.ReactNode;
  if (token) {
    body =
      grant && grant.k === "confirm" ? (
        <>
          <p className="st-price text-sm">Waitlist</p>
          <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">Confirm your spot</h1>
          <p className="st-muted mt-4 text-lg">{`Press the button and ${store.name} emails you once, when ${title} goes on sale.`}</p>
          <form action="/api/store/waitlist/confirm" method="post" className="mt-7">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn st-btn btn-lg">Confirm my spot</button>
          </form>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{NOTICES.expired.title}</h1>
          <p className="st-muted mt-4 text-lg">{NOTICES.expired.body}</p>
        </>
      );
  } else if (leave) {
    body =
      grant && grant.k === "leave" ? (
        <>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Remove your address?</h1>
          <p className="st-muted mt-4 text-lg">{`You will not be told when ${title} goes on sale.`}</p>
          <form action="/api/store/waitlist/leave" method="post" className="mt-7">
            <input type="hidden" name="token" value={leave} />
            <button type="submit" className="btn st-btn btn-lg">Remove my address</button>
          </form>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Your address is not on this waitlist</h1>
          <p className="st-muted mt-4 text-lg">It was removed already, or the waitlist has done its job and its addresses are gone.</p>
        </>
      );
  } else if (status === "sent") {
    body = (
      <>
        <p className="st-price text-sm">Almost there</p>
        <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">Check your inbox</h1>
        <p className="st-muted mt-4 text-lg">
          {`We emailed you a button to confirm your spot on the waitlist for ${title}. It comes from ${store.name} via Marktmorgen and usually arrives within a minute; if it is not there, look in spam.`}
        </p>
        <p className="st-muted mt-4 text-sm">Your spot counts once you press it, so a mistyped address is never told anything.</p>
      </>
    );
  } else if (status === "confirmed") {
    body = (
      <>
        <p className="st-price text-sm">You are on the list</p>
        <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{`We will tell you when ${title} is out`}</h1>
        <p className="st-muted mt-4 text-lg">One email, the day it goes on sale, with its link. That is all this waitlist sends.</p>
      </>
    );
  } else if (status === "left") {
    body = (
      <>
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Your address is removed</h1>
        <p className="st-muted mt-4 text-lg">{`You will not be told when ${title} goes on sale.`}</p>
      </>
    );
  } else {
    const notice = NOTICES[status] ?? NOTICES.error;
    body = (
      <>
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{notice.title}</h1>
        <p className="st-muted mt-4 text-lg">{notice.body}</p>
      </>
    );
  }

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`} style={lookStyle(store.look) as React.CSSProperties}>
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          {body}
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {product && !product.hidden ? (
              <Link href={productPath(store, product)} className="st-footer-link text-sm font-semibold">
                {`See ${product.title}`}
              </Link>
            ) : null}
            <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
              {`Back to ${store.name}`}
            </Link>
            <StoreTracking store={store} presence event={status === "sent" && product ? { type: "lead", productId: product.id } : null} />
          </div>
        </div>
      </main>
    </div>
  );
}
