import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { imageFolder, isFree } from "@/lib/store";
import { readCards, readListing, readListings } from "@/lib/catalog";
import { studioPath, studioView } from "@/lib/studio-route";
import { StudioHeader } from "@/components/studio-header";
import { StudioStorePin } from "@/components/studio-store-pin";
import { canSell } from "@/lib/store-checkout";
import { imageUrl } from "@/lib/product-image";
import { photoUrl } from "@/lib/photo-limits";
import { readAbout } from "@/lib/product-about";
import { EMPTY_PAGE, MAX_BLOCKS } from "@/lib/sales-page";
import { readPage } from "@/lib/sales-page-store";
import { summaryOf, visibleReviews } from "@/lib/reviews";
import { bumpTargets } from "@/lib/product-extras";
import { pageAction, pricePill, productPath } from "@/components/store-product";
import { PageEditor } from "@/components/page-editor";
import { pageFacts } from "@/lib/page-facts";
import { LANGUAGES } from "@/lib/store-language";
import { offeredItems } from "@/lib/bundles";
import { SHOWN_FROM, readSoldCounts } from "@/lib/sold-count";
import { AiOn } from "@/components/ai-assist";
import { aiLeft, isAiConfigured } from "@/lib/ai";

export const metadata: Metadata = {
  title: "Sales pages — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

/** Products listed beside the editor at once; a longer list is searched. */
const NAV_LIMIT = 50;

/**
 * Each product's own page, built from blocks: a sales page for something
 * paid, a landing page with the sign-up form for something free. On every
 * plan.
 */
export default async function StudioPagesPage({ searchParams }: Params) {
  const query = await searchParams;
  // Which store, and whether this person's role there has "products" (lib/studio-route.ts):
  // a product's page is part of the product, for the owner, Admins and Editors.
  const found = await studioView(await cookies(), typeof query.store === "string" ? query.store : undefined, "products");
  if (!found.ok) {
    if (found.reason === "signed_out") redirect("/signin");
    redirect(found.store ? studioPath(found.store, "team=forbidden") : "/studio");
  }
  const { view } = found;
  const { store } = view;

  // Every card is read once (lib/catalog.ts): for the list beside the editor,
  // found by name on a long store, and for what a free product's page can
  // show next.
  const asked = typeof query.product === "string" ? query.product : "";
  const find = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  // The name and whether the product already has a page of blocks are both on
  // its card, so the list and the search cost one command rather than one read
  // per product (lib/catalog.ts). The chosen product is read in full below.
  const products = [...(await readCards(store)).values()];
  const chosen = products.find((p) => p.id === asked) ?? products.find((p) => p.page) ?? products[0] ?? null;
  // One product read in full: the one actually being edited.
  const selected = chosen ? await readListing(store, chosen.id) : null;
  // Products with a page of blocks first, NAV_LIMIT at a time.
  const matching = (find ? products.filter((p) => p.title.toLowerCase().includes(find.toLowerCase())) : products)
    .slice()
    .sort((a, b) => Number(b.page) - Number(a.page));
  const listed = matching.slice(0, NAV_LIMIT);
  if (chosen && !listed.some((p) => p.id === chosen.id)) listed.unshift(chosen);
  // What the selected product offers in the box at checkout, for where its buttons lead.
  const related = selected?.bumps.length ? await readListings(store, bumpTargets(selected)) : [];
  const [page, about, summary, reviews] = selected
    ? await Promise.all([
        selected.page ? readPage(store.statsId, selected.id) : Promise.resolve({ ...EMPTY_PAGE, blocks: [] }),
        selected.about ? readAbout(store.statsId, selected.id) : Promise.resolve(""),
        summaryOf(store.statsId, selected.id).catch(() => null),
        visibleReviews(store.statsId, selected.id, 0, 3).catch(() => []),
      ])
    : [null, "", null, []];
  const action = selected ? pageAction(store, selected, null, canSell(store), related) : null;
  const leadsTo = !selected || !action
    ? ""
    : action.action.kind === "checkout"
      ? "It opens Stripe's checkout for this product right away, at the price your store shows."
      : action.action.kind === "link" && action.action.href === "#buy"
        ? "It takes the buyer to the buy box at the end of the page, where they pick an option or a plan and pay."
        : action.action.kind === "link" && action.action.href === "#get"
          ? "It takes the visitor to the sign-up form under the hero."
          : action.action.kind === "link"
            ? "It opens the booking page, to pick a time."
            : `It is not a button right now: the page says “${action.action.kind === "none" ? action.action.text : ""}”`;
  // A new key whenever what is saved changes, so the editor starts again from it.
  const version = page ? createHash("sha256").update(JSON.stringify(page)).digest("hex").slice(0, 12) : "none";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <StudioHeader
        current={store}
        role={view.role}
        stores={view.stores}
        owned={view.owned}
        action={{ href: studioPath(store), label: "Back to the studio", short: "Studio" }}
      />
      <StudioStorePin sid={store.sid}>
      <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
        <p className="eyebrow">Sales pages</p>
        <h1 className="t-h2 mt-3">A page that sells each product</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {`Build each product's own page from up to ${MAX_BLOCKS} blocks: a hero with its picture or a video, text, benefits, what's inside, about you, questions, your guarantee, buttons to the checkout and your buyers' verified reviews. Something free gets a landing page with the sign-up form, to send ads to. Pages follow your store's look, and a product without blocks keeps the page it has.`}
        </p>

        {products.length === 0 || !selected || !page || !action ? (
          <div className="card mt-8 p-6 sm:p-8">
            <p className="text-lg font-semibold tracking-[-0.02em] text-ink">Nothing to build a page for yet</p>
            <p className="mt-2 text-ink-soft">Add a product in the studio and its page can be built here.</p>
            <Link href={`${studioPath(store)}#products`} className="btn btn-primary mt-5">Go to products</Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            <nav aria-label="Products" className="card min-w-0 p-3 lg:sticky lg:top-24">
              <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-mute">Pages</p>
              {products.length > NAV_LIMIT ? (
                <form action="/studio/pages" method="get" role="search" className="px-1 pb-3">
                  {store.sid ? <input type="hidden" name="store" value={store.sid} /> : null}
                  <label htmlFor="page-find" className="sr-only">Find a product by its name</label>
                  <input
                    id="page-find"
                    type="search"
                    name="q"
                    defaultValue={find}
                    placeholder="Find a product"
                    className="field field-search w-full"
                  />
                  <p className="mt-2 px-2 text-xs text-ink-mute" role="status">
                    {matching.length === 0
                      ? "Nothing has that in its name."
                      : `${Math.min(matching.length, NAV_LIMIT)} of ${matching.length.toLocaleString("en-US")} shown. Search to find another.`}
                  </p>
                </form>
              ) : null}
              <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] lg:block lg:space-y-1 lg:overflow-visible">
                {listed.map((p) => {
                  const on = p.id === selected.id;
                  return (
                    <li key={p.id} className="shrink-0 lg:shrink">
                      <Link
                        href={studioPath(store, `product=${p.id}${find ? `&q=${encodeURIComponent(find)}` : ""}`, "pages")}
                        aria-current={on ? "page" : undefined}
                        className={`flex min-h-[44px] items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-sm transition-colors ${
                          on ? "bg-lilac text-violet-ink" : "text-ink-soft hover:bg-paper hover:text-ink"
                        }`}
                      >
                        <span className="max-w-[14rem] truncate font-semibold">{p.title}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                            p.page ? "bg-mint-soft text-mint-deep" : "bg-sand text-ink-mute"
                          }`}
                        >
                          {p.page ? (isFree(p) ? "Landing" : "Sales") : "Plain"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <AiOn value={isAiConfigured() ? { on: true, left: await aiLeft(store).catch(() => 0) } : { on: false, left: 0 }}>
            <PageEditor
              key={`${selected.id}:${version}`}
              product={{
                id: selected.id,
                title: selected.title,
                summary: selected.summary,
                free: isFree(selected),
                pill: pricePill(store, selected),
                picture: selected.image
                  ? { src: imageUrl(selected.image), alt: selected.image.alt, width: selected.image.width, height: selected.image.height }
                  : null,
                defaultLabel: action.label || "Get it now",
                leadsTo,
              }}
              initial={page}
              folder={await imageFolder(view.ref)}
              about={about}
              look={store.look}
              storeName={store.name}
              photo={store.photoId ? photoUrl(store.photoId) : null}
              pageHref={productPath(store, selected)}
              nextOptions={isFree(selected) ? products.filter((p) => !isFree(p)).map((p) => ({ id: p.id, title: p.title })) : []}
              summary={summary && summary.visible + summary.hidden > 0 ? summary : null}
              reviews={reviews}
              lang={store.language}
              facts={pageFacts({
                language: store.language,
                locale: LANGUAGES[store.language].locale,
                product: selected,
                bundleItems: selected.bundle ? (await offeredItems(store, [selected]).catch(() => new Map())).get(selected.id)?.length ?? 0 : null,
                sold: await (async () => {
                  const n = (await readSoldCounts(store).catch(() => null))?.byProduct[selected.id] ?? 0;
                  return n >= SHOWN_FROM ? n : null;
                })(),
                reviews: summary,
              })}
            />
            </AiOn>
          </div>
        )}
      </main>
      </StudioStorePin>
    </div>
  );
}
