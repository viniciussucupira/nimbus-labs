import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { readListing } from "@/lib/catalog";
import { askable } from "@/lib/checkout-ask";
import { productPath } from "@/components/store-product";

export const metadata: Metadata = {
  title: "Nothing was charged — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. The reminder goes to the address you type, so it has to be one you can open.",
  },
  limited: {
    title: "Too many reminders asked for just now",
    body: "To keep this form from being used to fill somebody's inbox, it takes a limited number an hour. Nothing was kept. The product is still here whenever you want it.",
  },
  closed: {
    title: "No reminder can be sent for this",
    body: "It may have sold out or been taken off sale. Nothing was kept.",
  },
  error: {
    title: "We could not keep that just now",
    body: "Nothing was kept. Try again in a moment.",
  },
};

/**
 * Where the way back from an unpaid checkout leads, on a store with
 * reminders on (lib/checkout-ask.ts): nothing was charged, the product is
 * one press away, and one reminder can be asked for. Nothing here is asked
 * of anybody who simply wants to go back.
 */
export default async function LeftPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const read = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
  const productId = read("p").slice(0, 40);
  const status = read("status");
  const product = productId ? await readListing(store, productId) : null;
  // Nothing to say about a product that is not there: the store itself is the way back.
  if (!product || product.hidden) redirect(`/@${store.handle}`);
  const canAsk = askable(store, product);

  let body: React.ReactNode;
  if (status === "asked") {
    body = (
      <>
        <p className="st-price text-sm">Done</p>
        <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">One reminder, in about an hour</h1>
        <p className="st-muted mt-4 text-lg">
          {`${store.name} will email you once, with the link to ${product.title}. If you buy it before then, no reminder is sent.`}
        </p>
        <p className="st-muted mt-4 text-sm">That is the only email this sends. It does not add you to any list, and it has a link that stops reminders from this store for good.</p>
      </>
    );
  } else if (status && NOTICES[status]) {
    body = (
      <>
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{NOTICES[status].title}</h1>
        <p className="st-muted mt-4 text-lg">{NOTICES[status].body}</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="st-price text-sm">Nothing was charged</p>
        <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{`You left before paying for ${product.title}`}</h1>
        <p className="st-muted mt-4 text-lg">Your card was not charged. If you still want it, it is one press away.</p>
        <div className="mt-7">
          <Link href={productPath(store, product)} className="btn st-btn btn-lg">{`Back to ${product.title}`}</Link>
        </div>
        {canAsk ? (
          <form action="/api/store/remind" method="post" className="mt-10 space-y-3">
            <h2 className="text-lg font-semibold">Not ready yet?</h2>
            <p className="st-muted">
              {`Leave your email and ${store.name} sends you one reminder with the link, in about an hour. One email. It does not add you to any list.`}
            </p>
            <input type="hidden" name="handle" value={store.handle} />
            <input type="hidden" name="product" value={product.id} />
            {/* Left empty by a person; filled in by something that fills in every field. */}
            <div aria-hidden="true" className="hidden">
              <label>
                Leave this empty
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label htmlFor="remind-email" className="st-label">
              Your email
            </label>
            <input
              id="remind-email"
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="you@example.com"
              className="st-field"
            />
            <button type="submit" className="btn st-btn-ghost btn-block">Remind me once</button>
            <p className="st-muted text-xs">
              {`Your address is used for this one reminder and for the link in it that stops reminders from ${store.name}, and for nothing else.`}
            </p>
          </form>
        ) : null}
      </>
    );
  }

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`} style={lookStyle(store.look) as React.CSSProperties}>
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          {body}
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {status ? (
              <Link href={productPath(store, product)} className="st-footer-link text-sm font-semibold">
                {`See ${product.title}`}
              </Link>
            ) : null}
            <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
              {`Back to ${store.name}`}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
