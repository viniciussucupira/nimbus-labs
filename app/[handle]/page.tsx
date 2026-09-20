import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { centsToPrice, normaliseHandle, storeForHandle } from "@/lib/store";
import {
  canSell,
  canSellProduct,
  fromPriceCents,
  sellableOptions,
} from "@/lib/store-checkout";
import { everyLabel } from "@/lib/product-recurring";
import { linkHost } from "@/lib/product-link";
import { isConnectInTestMode } from "@/lib/stripe-connect";

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
    // something on it does, so it stops hiding the moment it has. A page of
    // links alone counts: it is a page somebody may be looking for.
    robots: {
      index: store.products.length > 0 || store.links.length > 0,
      follow: true,
    },
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
  // A buyer standing in front of a checkout deserves to know it is a rehearsal
  // before typing a card number into it, not after.
  const rehearsal = selling && isConnectInTestMode();

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

          {store.products.length === 0 && store.links.length === 0 ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-ink/15 p-6">
              <p className="font-bold text-ink">Nothing here yet</p>
              <p className="mt-2 text-sm text-ink-soft">
                This page is open but empty. When {store.name} adds something,
                it shows up here.
              </p>
            </div>
          ) : null}

          {store.products.length > 0 ? (
            <>
              <ul className="mt-8 space-y-4 text-left">
                {store.products.map((product) => {
                  const options = sellableOptions(product);
                  const from = fromPriceCents(product);
                  const every = product.recurring
                    ? ` ${everyLabel(product.recurring.interval)}`
                    : "";
                  return (
                  <li
                    key={product.id}
                    className="rounded-3xl border-2 border-ink/5 bg-cream p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-display text-lg font-black text-ink">
                        {product.title}
                      </h2>
                      <p className="font-mono text-lg font-bold text-violet-deep">
                        {`${options.length > 1 ? "from " : ""}$${centsToPrice(
                          from,
                        )}${every}`}
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
                        {/*
                          Radio cards, and nothing else. The form sends the id
                          of the option the buyer picked; what it costs is read
                          from the creator's own record on the server, so the
                          price cannot be sent from here. Plain radios also
                          mean the choice works with JavaScript turned off.
                        */}
                        {options.length > 0 ? (
                          <fieldset className="mb-4">
                            <legend className="sr-only">
                              {`Choose an option for ${product.title}`}
                            </legend>
                            <div className="space-y-2">
                              {options.map((option, index) => (
                                <label
                                  key={option.id}
                                  htmlFor={`o-${option.id}`}
                                  className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 transition hover:border-violet-brand has-[:checked]:border-violet-brand has-[:checked]:bg-lilac"
                                >
                                  <span className="flex items-center gap-3">
                                    <input
                                      id={`o-${option.id}`}
                                      type="radio"
                                      name="option"
                                      value={option.id}
                                      defaultChecked={index === 0}
                                      className="h-4 w-4 accent-violet-brand"
                                    />
                                    <span className="font-bold text-ink">
                                      {option.label}
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-violet-deep">
                                    {`$${centsToPrice(option.priceCents)}${every}`}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}
                        <button
                          type="submit"
                          className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"
                        >
                          {options.length > 0
                            ? product.recurring
                              ? "Subscribe"
                              : "Buy the one you picked"
                            : product.recurring
                              ? `Subscribe \u2014 $${centsToPrice(
                                  product.priceCents,
                                )}${every}`
                              : `Buy for $${centsToPrice(product.priceCents)}`}
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
                  );
                })}
              </ul>

              {/*
                Said plainly, because the alternative is a button that takes a
                card and does nothing. Prices are shown because they are the
                creator's real prices; what is missing is the till, and this
                says so without promising a date for it.
              */}
              {rehearsal ? (
                <p className="mt-6 rounded-3xl border-2 border-dashed border-ink/15 p-5 text-sm text-ink-soft">
                  <strong className="text-ink">
                    This checkout is running in Stripe&apos;s test mode.
                  </strong>{" "}
                  No real money moves through it and no real card is charged,
                  so do not put a card you own into it. When it is switched on,
                  payment is taken by Stripe on {store.name}&apos;s own account:
                  Nimbus never holds the money and takes none of it.
                </p>
              ) : selling ? (
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
          ) : null}

          {/*
            The other half of link in bio. These take no money and deliver
            nothing: they are where else this person can be found. The site
            each one leads to is printed under it, so a visitor knows where
            they are being sent before they go.
          */}
          {store.links.length > 0 ? (
            <ul className="mt-8 space-y-3 text-left">
              {store.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="block rounded-3xl border-2 border-ink/10 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-violet-brand sm:px-6"
                  >
                    <span className="block font-bold text-ink">
                      {link.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-ink-soft">
                      {linkHost(link.url)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
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
