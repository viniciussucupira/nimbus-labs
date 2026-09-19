import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { centsToPrice, normaliseHandle, storeForHandle } from "@/lib/store";
import { canSell, canSellProduct } from "@/lib/store-checkout";

type Params = { params: Promise<{ handle: string }> };

/**
 * A creator's public store.
 *
 * Only addresses that start with "@" reach this page, so a store can never
 * collide with a page of the site itself.
 *
 * An address the store used before still lands here, and the visitor is sent
 * on to the address it uses now. Links already printed in a bio keep working.
 */
async function load(raw: string) {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  const asked = normaliseHandle(decoded);
  const store = await storeForHandle(asked);
  return store ? { store, asked } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const found = await load(handle);
  if (!found) return { title: "Not found — Nimbus Labs" };
  const { store } = found;

  return {
    title: `${store.name} — Nimbus Labs`,
    description: store.bio || `The store of ${store.name} on Nimbus Labs.`,
    // An empty store has nothing to offer a search engine yet. One with
    // something on it does, so it stops hiding the moment it has.
    robots: { index: store.products.length > 0, follow: true },
  };
}

export default async function StorePage({ params }: Params) {
  const { handle } = await params;
  const found = await load(handle);
  if (!found) notFound();
  const { store, asked } = found;

  // An old address of this same store: send the visitor to the current one.
  if (asked !== store.handle) permanentRedirect(`/@${store.handle}`);

  const selling = canSell(store);

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-violet-brand/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-0 h-64 w-64 bg-mint-brand/20 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="rounded-[2rem] border-2 border-ink/5 bg-white p-7 text-center shadow-xl shadow-ink/5 sm:p-10">
          <p
            aria-hidden="true"
            className="font-display mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-brand to-pink-brand text-3xl font-black text-white"
          >
            {store.name.slice(0, 1).toUpperCase()}
          </p>

          <h1 className="font-display mt-5 text-3xl font-black leading-tight sm:text-4xl">
            {store.name}
          </h1>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            @{store.handle}
          </p>

          {store.bio ? (
            <p className="mt-4 text-lg text-ink-soft">{store.bio}</p>
          ) : null}

          {store.products.length === 0 ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-ink/15 p-6">
              <p className="font-bold text-ink">Nothing for sale yet</p>
              <p className="mt-2 text-sm text-ink-soft">
                This store is open but empty. When {store.name} adds something,
                it shows up here.
              </p>
            </div>
          ) : (
            <>
              <ul className="mt-8 space-y-4 text-left">
                {store.products.map((product) => (
                  <li
                    key={product.id}
                    className="rounded-3xl border-2 border-ink/5 bg-cream p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-display text-lg font-black text-ink">
                        {product.title}
                      </h2>
                      <p className="font-mono text-lg font-bold text-violet-deep">
                        {`$${centsToPrice(product.priceCents)}`}
                      </p>
                    </div>
                    {product.summary ? (
                      <p className="mt-2 text-ink-soft">{product.summary}</p>
                    ) : null}

                    {canSellProduct(store, product) ? (
                      <form
                        action="/api/store/checkout"
                        method="post"
                        className="mt-4"
                      >
                        <input type="hidden" name="handle" value={store.handle} />
                        <input type="hidden" name="product" value={product.id} />
                        <button
                          type="submit"
                          className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"
                        >
                          {`Buy for $${centsToPrice(product.priceCents)}`}
                        </button>
                      </form>
                    ) : selling ? (
                      /*
                        Sellable store, but this one has nothing attached to
                        hand over. Better to say so than to take the money and
                        work out the delivery afterwards.
                      */
                      <p className="mt-4 text-sm text-ink-soft">
                        Not ready to buy yet.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/*
                Said plainly, because the alternative is a button that takes a
                card and does nothing. Prices are shown because they are the
                creator's real prices; what is missing is the till, and this
                says so without promising a date for it.
              */}
              {selling ? (
                <p className="mt-6 text-sm text-ink-soft">
                  Payment is taken by Stripe on {store.name}&apos;s own account.
                  Nimbus never holds the money and takes none of it.
                </p>
              ) : (
                <p className="mt-6 rounded-3xl border-2 border-dashed border-ink/15 p-5 text-sm text-ink-soft">
                  <strong className="text-ink">
                    This store cannot take payments yet.
                  </strong>{" "}
                  The prices above are real, and nothing here can charge a card.
                  To buy, write to {store.name} directly.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm font-semibold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
          >
            Made with Nimbus Labs
          </Link>
        </div>
      </main>
    </div>
  );
}
