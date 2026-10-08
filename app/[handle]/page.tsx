import { after } from "next/server";
import { forVisitor } from "@/lib/visitor";
import { sellsThroughPayPal } from "@/lib/paypal-sales";
import { saleClock, saleRunning } from "@/lib/store-sale";
import { endsLine, speech } from "@/lib/buyer-words";
import { soonProducts } from "@/lib/waitlist";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { type Listing, normaliseHandle, storeForPage } from "@/lib/store";
import { KIND, readPage, sellsAny, visibleCount } from "@/lib/catalog";
import { groupBySection } from "@/lib/store-sections";
import { offeredItems } from "@/lib/bundles";
import { canSell, canSellProduct } from "@/lib/store-checkout";
import { linkHost } from "@/lib/product-link";
import { isHouseStore } from "@/lib/house-store";
import { sellsInTestMode } from "@/lib/stripe-connect";
import { DemoNote } from "@/components/demo-notes";
import { lookStyle } from "@/lib/store-look";
import { canUse } from "@/lib/plan";
import { photoUrl } from "@/lib/photo-limits";
import { canManage } from "@/lib/membership-manage";
import { canRecover, sellsDeliverables } from "@/lib/buyer-orders";
import { StoreTracking } from "@/components/store-tracking";
import { ExitOfferSlot } from "@/components/exit-offer-slot";
import { stockLeft } from "@/lib/stock";
import { outOfKeys } from "@/lib/licence-keys";
import { ProductCard } from "@/components/store-product";
import { canWrite } from "@/lib/mail";
import { canUseDomain } from "@/lib/domains";
import { SITE_URL } from "@/lib/site-url";
import { summaries } from "@/lib/reviews";
import { SHOWN_FROM, readSoldCounts, refreshSoldCounts, stale } from "@/lib/sold-count";
import { readAllTimeSales } from "@/lib/stats";
import { isResting } from "@/lib/traffic";
import { StoreResting } from "@/components/store-resting";

type Params = {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

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
  const store = await storeForPage(asked);
  return store ? { store, asked } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const found = await load(handle);
  if (!found) return { title: "Not found — Marktmorgen" };
  const { store } = found;

  // A store on its own live domain names that as its address for search engines.
  const ownDomain = store.domain?.liveAt && canUseDomain(store) ? `https://${store.domain.name}/` : null;

  return {
    title: `${store.name} — Marktmorgen`,
    description: store.bio || speech(store).w.storeDescription(store.name),
    ...(ownDomain ? { alternates: { canonical: ownDomain } } : {}),
    // An empty store has nothing to offer a search engine yet. One with
    // something on it does, so it stops hiding the moment it has. A page of
    // links alone counts: it is a page somebody may be looking for.
    robots: {
      index: visibleCount(store) > 0 || store.links.length > 0,
      follow: true,
    },
    // A shared link shows the creator's face when they have put one up.
    ...(store.photoId
      ? {
          openGraph: {
            title: store.name,
            description: store.bio || speech(store).w.storeDescription(store.name),
            images: [{ url: photoUrl(store.photoId), width: 480, height: 480, alt: store.name }],
          },
          twitter: { card: "summary" },
        }
      : {}),
  };
}

/** Where one page of the store's products is: the store's own address, with the page after it. */
function pageHref(handle: string, page: number, ownDomain: boolean): string {
  const base = ownDomain ? "/" : `/@${handle}`;
  return page <= 1 ? base : `${base}?page=${page}`;
}

export default async function StorePage({ params, searchParams }: Params) {
  const { handle } = await params;
  const query = searchParams ? await searchParams : {};
  const asking = typeof query.page === "string" && /^\d{1,4}$/.test(query.page) ? Number(query.page) : 1;
  const found = await load(handle);
  if (!found) notFound();
  const { asked } = found;
  // With the visitor's country, for a fair price for it (lib/fair-price.ts).
  const store = await forVisitor(found.store);
  const { w, num } = speech(store);
  const notice = w.notices[typeof query.status === "string" ? query.status : ""] ?? null;
  // "Bought 120 times", when the creator shows it and it is worth saying (lib/sold-count.ts).
  const soldLine = (count: number | undefined) => (count && count >= SHOWN_FROM ? w.bought(num(count)) : null);

  // Reached on the creator's own domain (proxy.ts says which): it serves the
  // store only while it is this store's and the store is on Pro. Otherwise the
  // visitor is sent to the address that always works.
  const reachedOn = (await headers()).get("x-nimbus-domain");
  if (reachedOn && (store.domain?.name !== reachedOn || !canUseDomain(store))) {
    redirect(`${SITE_URL}/@${store.handle}`);
  }

  // An old address of this same store: send the visitor to the current one.
  // On the store's own domain the address in the bar is the domain, so there
  // is nothing to correct.
  if (asked !== store.handle && !reachedOn) permanentRedirect(`/@${store.handle}`);

  // A store with no plan a visit can be charged to, which has had the visits
  // such a store has this month, rests until the month turns or its plan is
  // paid (lib/traffic.ts). Asked only of such a store, before anything else
  // is read for it; a store that pays is never rested.
  if (await isResting(store)) return <StoreResting store={store} />;

  const selling = canSell(store);
  // Sold through the creator's own PayPal as well, or instead (lib/paypal-sales.ts).
  const byPayPal = sellsThroughPayPal(store);
  // A buyer standing in front of a checkout deserves to know it is a rehearsal
  // before typing a card number into it, not after. Asked of the store: the
  // demo store stays in test mode whatever our own key is (lib/house-store.ts).
  const rehearsal = selling && sellsInTestMode(store);
  const demo = isHouseStore(store);
  // The note about payments is about things that cost money. A page that only
  // gives things away has no card to talk about.
  const hasPriced = sellsAny(store, "paid");
  // The page asked for, a page of products at a time. The first page is
  // drawn from the store record alone; a later one reads its own cards.
  // The buyers' reviews of every product, in one read, started alongside the
  // page's own reads — and only for a store that has ever had a review
  // (lib/store.ts, reviewed), so any other store makes no extra request.
  const ratings = store.reviewed ? summaries(store.statsId).catch(() => new Map()) : Promise.resolve(new Map());
  // How many times each product was bought, for a store that chose to say so
  // (lib/sold-count.ts): one read when it is on, none when it is off, and a
  // fresh count from Stripe after the page is sent once the kept one is old.
  const soldCounts = await readSoldCounts(store).catch(() => null);
  if (store.look.sold && stale(soldCounts)) after(() => refreshSoldCounts(store, readAllTimeSales).then(() => undefined));
  const { listings, related, page, pages } = await readPage(store, asking);
  const known = [...listings, ...related];
  // What the store lists: drafts are left off (lib/catalog.ts).
  const total = visibleCount(store);

  // The page's products cut into the creator's sections (lib/store-sections.ts),
  // from the store's own index: no read, and one list as before when there are none.
  const index = store.catalog.items.map((item) => ({ id: item.id, hidden: (item.kind & KIND.hidden) !== 0 }));
  const groups = groupBySection(listings, index, store.sections);
  const position = new Map(listings.map((product, i) => [product.id, i]));
  // The creator's line of news, leading to one of their published products when they chose one.
  const news = store.announcement;
  const newsHref = news?.product && index.some((item) => item.id === news.product && !item.hidden) ? `/@${store.handle}/p/${news.product}` : null;

  const bold = store.look.theme === "bold";
  // A member can always find the way out, even when the store cannot sell
  // right now: stopping a charge must never depend on the store being open.
  const manageable = canManage(store);
  // Buyers are asked whether they want the creator's emails only where the creator can send them.
  const writes = canWrite(store);
  // What is left of each limited product, counted from real checkouts. Asked
  // side by side, so a long store does not wait on its products one by one;
  // a product without a limit is answered without asking anything.
  // A product handing out keys from a pool that is empty is sold out too.
  // What each bundle on this page holds now: one read for the page, none for
  // a page without bundles (lib/bundles.ts).
  const inBundles = offeredItems(store, known).catch(() => new Map<string, Listing[]>());
  const counts = await Promise.all(
    listings.map(async (product) => {
      const [stock, out] = await Promise.all([
        stockLeft(store, product).catch(() => null),
        outOfKeys(store, product).catch(() => false),
      ]);
      return out ? 0 : stock;
    }),
  );
  const rated = await ratings;
  const bundleItems = await inBundles;
  const soon = await soonProducts(store).catch(() => new Set<string>());
  const left = new Map<string, number>();
  listings.forEach((product, i) => {
    const count = counts[i];
    if (count !== null) left.set(product.id, count);
  });

  return (
    <div
      lang={speech(store).lang.locale}
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative">
        {news ? (
          <p className="st-announce">
            {newsHref ? (
              <Link href={newsHref} prefetch={false}>
                {news.text}
                <span aria-hidden="true">{" \u2192"}</span>
              </Link>
            ) : (
              news.text
            )}
          </p>
        ) : null}
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
          {notice ? (
            <div className="st-note mb-6" role="alert">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
              <p className="mt-1 text-sm">{notice.body}</p>
            </div>
          ) : null}

          {total === 0 && store.links.length === 0 ? (
            <div className="st-note text-center">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>{w.nothingYet}</p>
              <p className="mt-2 text-sm">{w.nothingYetBody(store.name)}</p>
            </div>
          ) : null}

          {total > 0 ? (
            <>
              {saleRunning(store.sale, saleClock()) ? (
                <p className="st-card mb-4 px-5 py-4 text-center font-semibold" style={{ color: "var(--st-accent-text)" }} role="status">
                  {w.saleBanner(store.sale.name, store.sale.percent, endsLine(store, store.sale.ends))}
                  <span className="st-muted mt-1 block text-sm font-normal">{w.saleBannerNote}</span>
                </p>
              ) : null}
              {groups.map((group, g) => (
                <section key={group.products[0].id} className={g > 0 ? "mt-10" : undefined} aria-label={group.title ?? undefined}>
                  {group.title ? (
                    <h2 className="st-section-title">
                      {group.title}
                      {group.continued ? <span className="st-muted font-normal">{w.continued}</span> : null}
                    </h2>
                  ) : null}
                  <ul className="space-y-4">
                    {group.products.map((product) => (
                      <ProductCard
                        eager={(position.get(product.id) ?? 9) < 3 && page === 1}
                        first={position.get(product.id) === 0 && page === 1}
                        key={product.id}
                        store={store}
                        product={product}
                        related={known}
                        // A count is only worth showing where the product can be bought.
                        remaining={left.has(product.id) && canSellProduct(store, product) ? left.get(product.id)! : null}
                        writes={writes}
                        selling={selling}
                        manageable={manageable}
                        rating={rated.get(product.id) ?? null}
                        bundleItems={bundleItems.get(product.id) ?? null}
                        soon={soon.has(product.id)}
                        sold={soldLine(soldCounts?.byProduct[product.id])}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {/*
                A long store, a page at a time: plain links, so every page has
                an address of its own, works without JavaScript and can be
                shared. The count says how far the list goes.
              */}
              {pages > 1 ? (
                <nav aria-label={w.pagesOfProducts} className="st-pager mt-6">
                  {page > 1 ? (
                    <Link href={pageHref(store.handle, page - 1, reachedOn !== null)} rel="prev" className="st-card st-link-card st-pager-link">
                      <span aria-hidden="true">&larr;</span> {w.previous}
                    </Link>
                  ) : (
                    <span className="st-pager-link st-pager-off" aria-hidden="true">
                      <span>&larr;</span> {w.previous}
                    </span>
                  )}
                  <p className="st-muted text-center text-sm font-semibold" aria-current="page">
                    {w.pageOf(page, pages)}
                    <span className="block text-xs font-normal">{w.products(total, num(total))}</span>
                  </p>
                  {page < pages ? (
                    <Link href={pageHref(store.handle, page + 1, reachedOn !== null)} rel="next" className="st-card st-link-card st-pager-link">
                      {w.next} <span aria-hidden="true">&rarr;</span>
                    </Link>
                  ) : (
                    <span className="st-pager-link st-pager-off" aria-hidden="true">
                      {w.next} <span>&rarr;</span>
                    </span>
                  )}
                </nav>
              ) : null}

              {/*
                Said plainly, because the alternative is a button that takes a
                card and does nothing. Prices are shown because they are the
                creator's real prices; what is missing is the till, and this
                says so without promising a date for it.
              */}
              {!hasPriced ? null : demo && rehearsal ? (
                <DemoNote full />
              ) : rehearsal ? (
                <p className="st-note mt-6 text-sm">
                  <strong>{w.testModeTitle}</strong> {w.testModeBody} {w.testModeLater(store.name)}
                </p>
              ) : selling || byPayPal ? (
                <p className="st-muted mt-6 text-center text-sm">{w.paidBy(w.takenBy(selling, byPayPal), store.name)}</p>
              ) : (
                <p className="st-note mt-6 text-sm">
                  <strong>{w.noPaymentsTitle}</strong> {w.noPaymentsBody(store.name)}
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

          {/*
            The way into the members-only community, when the creator has one
            switched on. Who is let in is decided on the other side of it.
          */}
          {store.community?.on ? (
            <p className="mt-8">
              <Link href={`/@${store.handle}/community`} className="st-card st-link-card px-5 py-4 text-center sm:px-6">
                <span className="block font-bold">{w.communityTitle}</span>
                <span className="st-muted mt-0.5 block text-sm">{w.communityBody}</span>
              </Link>
            </p>
          ) : null}

          <div className="mt-12 text-center">
            {canRecover(store) && sellsDeliverables(store) ? (
              <p className="mb-4">
                <Link href={`/@${store.handle}/orders`} className="st-footer-link text-sm font-semibold">
                  {w.getAgain}
                </Link>
              </p>
            ) : null}
            {store.affiliates.enabled ? (
              <p className="mb-4">
                <Link href={`/@${store.handle}/affiliates`} className="st-footer-link text-sm font-semibold">
                  {w.affiliateProgram(store.name)}
                </Link>
              </p>
            ) : null}
            {/*
              Our name at the foot of the page, unless this store is on Pro
              and has asked for it off.

              Both halves are read here, every time the page is drawn, and
              the plan is the half that decides: a store that leaves Pro
              shows the badge again from that moment, without anything
              having to go back and rewrite its settings. The setting is
              kept either way, so coming back to Pro restores the choice
              rather than losing it.
            */}
            {store.look.badge || !canUse(store, "branding") ? (
              <Link href="/" className="st-footer-link text-sm font-semibold">
                {w.madeWith}
              </Link>
            ) : null}
            <StoreTracking store={store} countVisit />
            <ExitOfferSlot store={store} />
          </div>
        </div>
      </main>
    </div>
  );
}
