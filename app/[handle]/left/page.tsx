import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { readListing } from "@/lib/catalog";
import { askable } from "@/lib/checkout-ask";
import { productPath } from "@/components/store-product";
import { speech } from "@/lib/buyer-words";
import { membershipWords } from "@/lib/buyer-words/membership";

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const decoded = decodeURIComponent((await params).handle);
  const store = decoded.startsWith("@") ? await storeForPage(normaliseHandle(decoded)) : null;
  return {
    title: `${membershipWords(store?.language).nothingCharged} — Marktmorgen`,
    robots: { index: false, follow: false },
  };
}

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
  const say = speech(store);
  const { w } = say;
  const m = membershipWords(store.language);
  const notices = m.leftNotices;

  let body: React.ReactNode;
  if (status === "asked") {
    body = (
      <>
        <p className="st-price text-sm">{m.done}</p>
        <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{m.oneReminder}</h1>
        <p className="st-muted mt-4 text-lg">
          {m.willEmail(store.name, product.title)}
        </p>
        <p className="st-muted mt-4 text-sm">{m.onlyEmail}</p>
      </>
    );
  } else if (status && notices[status]) {
    body = (
      <>
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{notices[status].title}</h1>
        <p className="st-muted mt-4 text-lg">{notices[status].body}</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="st-price text-sm">{m.nothingCharged}</p>
        <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{m.leftBefore(product.title)}</h1>
        <p className="st-muted mt-4 text-lg">{m.notCharged}</p>
        <div className="mt-7">
          <Link href={productPath(store, product)} className="btn st-btn btn-lg">{w.backTo(product.title)}</Link>
        </div>
        {canAsk ? (
          <form action="/api/store/remind" method="post" className="mt-10 space-y-3">
            <h2 className="text-lg font-semibold">{m.notReady}</h2>
            <p className="st-muted">
              {m.remindNote(store.name)}
            </p>
            <input type="hidden" name="handle" value={store.handle} />
            <input type="hidden" name="product" value={product.id} />
            {/* Left empty by a person; filled in by something that fills in every field. */}
            <div aria-hidden="true" className="hidden">
              <label>
                {w.leaveEmpty}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label htmlFor="remind-email" className="st-label">
              {w.yourEmail}
            </label>
            <input
              id="remind-email"
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder={w.emailPlaceholder}
              className="st-field"
            />
            <button type="submit" className="btn st-btn-ghost btn-block">{m.remindMe}</button>
            <p className="st-muted text-xs">
              {m.addressUse(store.name)}
            </p>
          </form>
        ) : null}
      </>
    );
  }

  return (
    <div lang={say.lang.locale} className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`} style={lookStyle(store.look) as React.CSSProperties}>
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          {body}
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {status ? (
              <Link href={productPath(store, product)} className="st-footer-link text-sm font-semibold">
                {m.see(product.title)}
              </Link>
            ) : null}
            <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
              {w.backTo(store.name)}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
