import { type NextRequest, after } from "next/server";
import { linkOrigin, originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { readListings, readProduct } from "@/lib/catalog";
import { canSell } from "@/lib/store-checkout";
import { cartPrice, createCartCheckout } from "@/lib/cart-checkout";
import { cartable, readCartIds } from "@/lib/cart-rules";
import { soonState } from "@/lib/preorders";
import { outOfKeys } from "@/lib/licence-keys";
import { readCountry } from "@/lib/fair-price";
import { formatMoney } from "@/lib/money";
import { LANGUAGES } from "@/lib/store-language";
import { cameFrom } from "@/lib/came-from";
import { affiliateCookieName, attributionFor } from "@/lib/affiliates";
import { viaCookieName } from "@/lib/affiliate-setting";
import { countHit } from "@/lib/visit";
import { clientAddress, fromAnotherSite, limited, withinLimit } from "@/lib/request-guard";
import { productSegment } from "@/lib/product-slug";

/**
 * What a cart holds, as the store has it now (`GET ?handle=&ids=a,b`): each
 * product's name, its address, what it is charged in this visitor's country
 * today, and whether it can still go in a cart. Read when the cart is opened,
 * so it never shows a price the checkout would not charge.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const handle = normaliseHandle((params.get("handle") ?? "").slice(0, 40));
  const ids = readCartIds((params.get("ids") ?? "").split(","));
  const store = handle ? await storeForHandle(handle) : null;
  if (!store) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
  if (!(await withinLimit("cart-read", `${clientAddress(request)}|${store.handle}`, 120, 600))) {
    return Response.json({ ok: false, error: "slow" }, { status: 429 });
  }
  const country = readCountry(request.headers.get("x-vercel-ip-country"));
  const locale = LANGUAGES[store.language].locale;
  const [listings, coming] = await Promise.all([ids.length ? readListings(store, ids) : Promise.resolve([]), soonState(store).catch(() => ({ soon: new Set<string>() }))]);
  const selling = canSell(store);
  const items = ids.flatMap((id) => {
    const product = listings.find((p) => p.id === id);
    if (!product) return [];
    const { cents } = cartPrice(store, product, country);
    return [{ id, title: product.title, href: `/@${store.handle}/p/${productSegment(product)}`, cents, price: formatMoney(cents, store.currency, locale), ok: selling && cartable(product) && !coming.soon.has(id) }];
  });
  const total = items.filter((item) => item.ok).reduce((sum, item) => sum + item.cents, 0);
  return Response.json({ ok: true, items, total: formatMoney(total, store.currency, locale) }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Pays for a cart: a plain form with the store's handle and each product's
 * id (`id`, up to four). Nothing it sends sets a price. Every product is read
 * again and must still go in a cart: published, at one price, sold once,
 * nothing to choose, book, hold or answer first, not coming soon, with keys
 * left if it hands one out. Anything else sends the visitor back to the store
 * with the cart as it was, to look it over.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  const away = (path: string) => new Response(null, { status: 303, headers: { Location: `${origin}${path}`, "Cache-Control": "no-store" } });

  let handle = "";
  let ids: string[] = [];
  try {
    const form = await (await limited(request, 4_000)).formData();
    const h = form.get("handle");
    handle = typeof h === "string" ? normaliseHandle(h.slice(0, 40)) : "";
    ids = readCartIds(form.getAll("id"));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!handle || ids.length === 0) return new Response("Bad request", { status: 400 });
  const store = await storeForHandle(handle);
  if (!store) return new Response("No such store.", { status: 404 });
  if (!(await withinLimit("checkout", `${clientAddress(request)}|${store.handle}`, 20, 600))) return away(`/@${store.handle}?status=slow`);
  if (!canSell(store)) return away(`/@${store.handle}`);

  const products = (await Promise.all(ids.map((id) => readProduct(store, id).catch(() => null)))).filter((p) => p !== null);
  const coming = await soonState(store).catch(() => ({ soon: new Set<string>() }));
  const fit = products.length === ids.length && products.every((p) => cartable(p) && p.fields.length === 0 && !coming.soon.has(p.id));
  if (!fit) return away(`/@${store.handle}?cart=changed#cart`);
  for (const product of products) {
    if (await outOfKeys(store, product).catch(() => false)) return away(`/@${store.handle}?cart=changed#cart`);
  }

  try {
    const via = await attributionFor(store, products[0].id, {
      via: request.cookies.get(viaCookieName(store.handle))?.value,
      session: request.cookies.get(affiliateCookieName(store.handle))?.value,
    }).catch(() => null);
    const opened = await createCartCheckout(store, products, linkOrigin(request, store), {
      country: readCountry(request.headers.get("x-vercel-ip-country")),
      cameFrom: cameFrom(request.headers.get("referer"), new URL(origin).hostname),
      via,
    });
    for (const product of products) after(() => countHit(request, store, { kind: "checkout", id: product.id }));
    return new Response(null, { status: 303, headers: { Location: opened.url, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("a cart's checkout failed", error);
    return away(`/@${store.handle}?cart=error#cart`);
  }
}
