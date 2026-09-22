import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  centsToPrice,
  isFree,
  normaliseHandle,
  storeForHandle,
} from "@/lib/store";
import {
  canSell,
  canSellProduct,
  fromPriceCents,
  sellableOptions,
} from "@/lib/store-checkout";
import { everyLabel } from "@/lib/product-recurring";
import { linkHost } from "@/lib/product-link";
import { isConnectInTestMode } from "@/lib/stripe-connect";
import { canGiveProduct } from "@/lib/free";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { canManage } from "@/lib/membership-manage";
import { StoreTracking } from "@/components/store-tracking";

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
    // A shared link shows the creator's face when they have put one up.
    ...(store.photoId
      ? {
          openGraph: {
            title: store.name,
            description: store.bio || `The store of ${store.name} on Nimbus Labs.`,
            images: [{ url: photoUrl(store.photoId), width: 480, height: 480, alt: store.name }],
          },
          twitter: { card: "summary" },
        }
      : {}),
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
  // The note about payments is about things that cost money. A page that only
  // gives things away has no card to talk about.
  const hasPriced = store.products.some((product) => !isFree(product));

  const bold = store.look.theme === "bold";
  // A member can always find the way out, even when the store cannot sell
  // right now: stopping a charge must never depend on the store being open.
  const manageable = canManage(store);

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative">
        <section className={bold ? "st-band" : undefined}>
          <div className={`mx-auto max-w-xl px-4 text-center ${bold ? "pb-12 pt-14 sm:pt-20" : "pb-2 pt-14 sm:pt-20"}`}>
            {store.photoId ? (
              // A plain img: the picture is already cropped and sized, and its
              // address never changes, so there is nothing for an optimiser to add.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl(store.photoId)}
                alt={store.name}
                width={104}
                height={104}
                className="st-avatar"
              />
            ) : (
              <p aria-hidden="true" className="st-avatar st-avatar-initial">
                {store.name.slice(0, 1).toUpperCase()}
              </p>
            )}

            <h1 className="font-display mt-6 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              {store.name}
            </h1>
            <p className="st-muted mt-1 text-sm font-semibold">@{store.handle}</p>

            {store.bio ? (
              <p className="st-muted mx-auto mt-4 max-w-md text-lg leading-relaxed">{store.bio}</p>
            ) : null}
          </div>
        </section>

        <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
          {store.products.length === 0 && store.links.length === 0 ? (
            <div className="st-note text-center">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>Nothing here yet</p>
              <p className="mt-2 text-sm">
                This page is open but empty. When {store.name} adds something,
                it shows up here.
              </p>
            </div>
          ) : null}

          {store.products.length > 0 ? (
            <>
              <ul className="space-y-4">
                {store.products.map((product) => {
                  const options = sellableOptions(product);
                  const from = fromPriceCents(product);
                  const every = product.recurring
                    ? ` ${everyLabel(product.recurring.interval)}`
                    : "";
                  return (
                  <li
                    key={product.id}
                    className="st-card p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <h2 className="font-display min-w-0 text-lg font-semibold leading-snug">
                        {product.title}
                      </h2>
                      <p className="st-price text-base">
                        {isFree(product)
                          ? "Free"
                          : `${options.length > 1 ? "from " : ""}$${centsToPrice(
                              from,
                            )}${every}`}
                      </p>
                    </div>
                    {product.call ? (
                      <p className="st-muted mt-1 text-sm font-semibold">
                        {`${product.call.minutes}-minute call, online`}
                      </p>
                    ) : null}
                    {product.summary ? (
                      <p className="st-muted mt-2 leading-relaxed">{product.summary}</p>
                    ) : null}

                    {isFree(product) ? (
                      canGiveProduct(store, product) ? (
                        /*
                          Given away for an address, and the address is only
                          kept once its owner uses the link we email. The box
                          starts empty and stays the visitor's to tick:
                          wanting the file is not agreeing to more email.
                        */
                        <form
                          action="/api/store/free"
                          method="post"
                          className="mt-4 space-y-3"
                        >
                          <input type="hidden" name="handle" value={store.handle} />
                          <input type="hidden" name="product" value={product.id} />
                          <div aria-hidden="true" className="hidden">
                            <label>
                              Leave this empty
                              <input
                                type="text"
                                name="website"
                                tabIndex={-1}
                                autoComplete="off"
                              />
                            </label>
                          </div>
                          <label
                            htmlFor={`e-${product.id}`}
                            className="st-label"
                          >
                            Your email
                          </label>
                          <input
                            id={`e-${product.id}`}
                            type="email"
                            name="email"
                            required
                            maxLength={254}
                            autoComplete="email"
                            placeholder="you@example.com"
                            className="st-field"
                          />
                          <label
                            htmlFor={`c-${product.id}`}
                            className="st-muted flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <input
                              id={`c-${product.id}`}
                              type="checkbox"
                              name="consent"
                              value="yes"
                              className="mt-0.5 h-4 w-4 shrink-0"
                            />
                            <span>
                              {`Also send me emails from ${store.name}. I can unsubscribe whenever I like.`}
                            </span>
                          </label>
                          <button
                            type="submit"
                            className="btn st-btn btn-block"
                          >
                            Email it to me
                          </button>
                          <p className="st-muted text-xs">
                            {`We email you a link to it. ${store.name} gets your address, marked with whether you ticked the box, and Nimbus uses it for nothing else.`}
                          </p>
                        </form>
                      ) : (
                        <p className="st-muted mt-4 text-sm">
                          Not available right now.
                        </p>
                      )
                    ) : product.call && canSellProduct(store, product) ? (
                      <Link
                        href={`/@${store.handle}/book/${product.id}`}
                        className="btn st-btn btn-block mt-4"
                      >
                        {`Pick a time \u2014 $${centsToPrice(product.priceCents)}`}
                      </Link>
                    ) : canSellProduct(store, product) ? (
                      <form
                        action="/api/store/checkout"
                        method="post"
                        className="mt-4"
                        data-checkout=""
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
                                  className="st-option"
                                >
                                  <span className="flex items-center gap-3">
                                    <input
                                      id={`o-${option.id}`}
                                      type="radio"
                                      name="option"
                                      value={option.id}
                                      defaultChecked={index === 0}
                                      className="h-4 w-4"
                                    />
                                    <span className="font-bold">
                                      {option.label}
                                    </span>
                                  </span>
                                  <span className="font-semibold tabular-nums">
                                    {`$${centsToPrice(option.priceCents)}${every}`}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}
                        <button
                          type="submit"
                          className="btn st-btn btn-block"
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
                      <p className="st-muted mt-4 text-sm">
                        Not ready to buy yet.
                      </p>
                    ) : null}

                    {product.recurring && manageable ? (
                      <p className="mt-3 text-center text-sm">
                        <Link href={`/@${store.handle}/manage`} className="st-footer-link font-semibold">
                          Already a member? Manage or cancel
                        </Link>
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
              {!hasPriced ? null : rehearsal ? (
                <p className="st-note mt-6 text-sm">
                  <strong>
                    This checkout is running in Stripe&apos;s test mode.
                  </strong>{" "}
                  No real money moves through it and no real card is charged,
                  so do not put a card you own into it. When it is switched on,
                  payment is taken by Stripe on {store.name}&apos;s own account:
                  Nimbus never holds the money and takes none of it.
                </p>
              ) : selling ? (
                <p className="st-muted mt-6 text-center text-sm">
                  Payment is taken by Stripe on {store.name}&apos;s own account.
                  Nimbus never holds the money and takes none of it.
                </p>
              ) : (
                <p className="st-note mt-6 text-sm">
                  <strong>
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
            <ul className="mt-8 space-y-3">
              {store.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    data-link={link.id}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="st-card st-link-card px-5 py-4 text-center sm:px-6"
                  >
                    <span className="block font-bold">
                      {link.title}
                    </span>
                    <span className="st-muted mt-0.5 block font-mono text-xs">
                      {linkHost(link.url)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-12 text-center">
            <Link href="/" className="st-footer-link text-sm font-semibold">
              Made with Nimbus Labs
            </Link>
            <StoreTracking store={store} countVisit />
          </div>
        </div>
      </main>
    </div>
  );
}
