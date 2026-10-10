/**
 * A store's cart (lib/cart-rules.ts, lib/cart-checkout.ts; added 10 October
 * 2026). Checked:
 *
 *   - only a paid product at one price, sold once, with nothing to choose,
 *     book or hold, goes in a cart, and a store offers one only with two;
 *   - a cart names each product once, four at most;
 *   - each line is charged at the price the store shows now: its sale, or
 *     the fair price for the buyer's country when that takes off more;
 *   - the checkout names the first product as the order's and the others the
 *     way products added at checkout are, so everything that hands them over
 *     already reads them; a code box only when nothing was taken off;
 *   - an affiliate's share is kept for each line.
 */
import { MAX_CART, cartable, readCartIds } from "@/lib/cart-rules";
import { cartPrice, createCartCheckout, offersCart } from "@/lib/cart-checkout";
import { KIND } from "@/lib/catalog";
import { NO_SALE } from "@/lib/store-sale";
import type { Product, Store } from "@/lib/store";
import { done, is, part } from "./check";

const sent: URLSearchParams[] = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.hostname === "api.stripe.com" && url.pathname === "/v1/checkout/sessions") {
    sent.push(new URLSearchParams(String(init?.body)));
    return new Response(JSON.stringify({ id: "cs_test_cart0000000001", url: "https://checkout.stripe.com/c/pay/cs_test_cart0000000001" }));
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;

const product = (id: string, priceCents: number, more: Partial<Product> = {}) =>
  ({ id, title: `Guide ${id}`, summary: "", priceCents, recurring: null, call: null, callPackage: null, podcast: null, options: [], pwyw: null, stock: null, bundle: null, pick: null, course: null, file: null, link: `https://example.com/${id}`, hidden: false, fields: [], keys: null, ...more }) as unknown as Product;

function shop(more: Partial<Store> = {}): Store {
  return {
    handle: "bakery",
    name: "Oven Notes",
    email: "owner@example.com",
    language: "en",
    currency: "usd",
    stripeAccountId: "acct_test_cart0001",
    sale: { ...NO_SALE },
    fair: undefined,
    hasDiscounts: true,
    tax: { enabled: false, included: false, ids: false, invoices: false },
    affiliates: { enabled: true, percent: 20, days: 30, rates: {}, payday: 0, hold: 0 },
    catalog: { id: null, items: [], head: [], inline: null },
    ...more,
  } as unknown as Store;
}

async function main(): Promise<void> {
  process.env.STRIPE_SECRET_KEY = "sk_test_only";

  part("What goes in a cart");
  is("a paid product at one price, sold once", cartable(product("a", 1900)), true);
  is("never something free, a membership, a call, a choice of prices, a price the buyer names or a limited one", [
    cartable(product("a", 0)),
    cartable(product("a", 1900, { recurring: { interval: "month" } as never })),
    cartable(product("a", 1900, { call: {} as never })),
    cartable(product("a", 1900, { options: [{}] as never })),
    cartable(product("a", 1900, { pwyw: {} as never })),
    cartable(product("a", 1900, { stock: 5 })),
  ], [false, false, false, false, false, false]);
  is("nor a draft, a bundle the buyer builds, or something with nothing to hand over", [
    cartable(product("a", 1900, { hidden: true })),
    cartable(product("a", 1900, { link: null, bundle: ["x", "y", "z"], pick: 2 })),
    cartable(product("a", 1900, { link: null })),
  ], [false, false, false]);
  is("a bundle that hands over everything can", cartable(product("a", 1900, { link: null, bundle: ["x", "y"] })), true);
  is(`each product once, ${MAX_CART} at most, ids only`, readCartIds(["a", "b", "a", "../x", 7, "c", "d", "e"]), ["a", "b", "c", "d"]);
  const items = (kinds: number[]) => kinds.map((kind, i) => ({ id: `p${i}`, kind, options: [] }));
  is("a store offers a cart only with two that could go in one", [
    offersCart(shop({ catalog: { id: null, items: items([KIND.paid]), head: [], inline: null } as never })),
    offersCart(shop({ catalog: { id: null, items: items([KIND.paid, KIND.paid | KIND.recurring, KIND.free]), head: [], inline: null } as never })),
    offersCart(shop({ catalog: { id: null, items: items([KIND.paid, KIND.paid]), head: [], inline: null } as never })),
  ], [false, false, true]);

  part("What each line is charged");
  const now = Math.floor(Date.now() / 1000);
  const sale = { ...NO_SALE, percent: 25, starts: now - 60, ends: now + 3600, all: false, products: ["a"], coupon: "c" };
  const fair = { on: true, auto: false, maxOff: 50, levels: { IN: 40 }, all: true, products: [] };
  const store = shop({ sale, fair: fair as never });
  is("its sale, on the products the sale is on", [cartPrice(store, product("a", 2000), "US", now), cartPrice(store, product("b", 2000), "US", now)], [{ cents: 1500, off: 25 }, { cents: 2000, off: 0 }]);
  is("or the fair price for the buyer's country when it takes off more", cartPrice(store, product("a", 2000), "IN", now), { cents: 1200, off: 40 });

  part("The checkout");
  await createCartCheckout(shop(), [product("a", 1900), product("b", 900), product("c", 2700)], "https://marktmorgen.com", { via: { aff: "affid0000001", rate: 20 } });
  const body = sent.at(-1) as URLSearchParams;
  is("one line each, at its price", [body.get("line_items[0][price_data][unit_amount]"), body.get("line_items[1][price_data][unit_amount]"), body.get("line_items[2][price_data][unit_amount]")], ["1900", "900", "2700"]);
  is("the first is the order's product, the rest named as added ones", [body.get("metadata[product]"), body.get("metadata[bump]"), body.get("metadata[bump2]"), body.get("metadata[bump3]"), body.get("metadata[cart]")], ["a", "b", "c", null, "yes"]);
  is("with what each added one was charged", [body.get("metadata[bump_cents]"), body.get("metadata[bump2_cents]")], ["900", "2700"]);
  is("and each one's share for the affiliate who sent the buyer", [body.get("metadata[via]"), body.get("metadata[via_rate]"), body.get("metadata[bump_rate]")], ["affid0000001", "20", "20"]);
  is("a code box, since nothing was taken off", body.get("allow_promotion_codes"), "true");
  await createCartCheckout(store, [product("a", 2000), product("b", 2000)], "https://marktmorgen.com", { country: "US" });
  const onSale = sent.at(-1) as URLSearchParams;
  is("a sale taken off its own line, and then no code box", [onSale.get("line_items[0][price_data][unit_amount]"), onSale.get("line_items[1][price_data][unit_amount]"), onSale.get("allow_promotion_codes")], ["1500", "2000", null]);
  let refused = "";
  await createCartCheckout(shop(), [1, 2, 3, 4, 5].map((n) => product(`p${n}`, 100)), "https://marktmorgen.com").catch((error: Error) => {
    refused = error.message;
  });
  is("never more than four", refused.includes("one to four"), true);

  done();
}

void main();
