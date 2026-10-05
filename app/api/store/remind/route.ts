import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { clientAddress, fromAnotherSite, limited } from "@/lib/request-guard";
import { readListing } from "@/lib/catalog";
import { askReminder } from "@/lib/checkout-ask";

const MAX_BODY_BYTES = 2_000;

/**
 * A buyer asks for one reminder about a checkout they did not finish
 * (lib/checkout-ask.ts): a plain form on the page the checkout's way back
 * leads to. The answer is always that page, and the address typed never goes
 * in its URL.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  let handle = "";
  let productId = "";
  let email = "";
  let honeypot = "";
  try {
    const form = await (await limited(request, MAX_BODY_BYTES)).formData();
    const read = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    handle = normaliseHandle(read("handle"));
    productId = read("product").slice(0, 40);
    email = read("email").slice(0, 300);
    honeypot = read("website");
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const store = handle ? await storeForHandle(handle) : null;
  if (!store) return new Response("No such store.", { status: 404 });
  const away = (status: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${origin}/@${store.handle}/left?p=${encodeURIComponent(productId)}&status=${status}`, "Cache-Control": "no-store" },
    });
  // A form filled in by something that fills in every field is told it worked.
  if (honeypot.trim()) return away("asked");
  try {
    const product = productId ? await readListing(store, productId) : null;
    return away(await askReminder({ store, product, email, ip: clientAddress(request) }));
  } catch (error) {
    console.error("asking for a checkout reminder failed", error);
    return away("error");
  }
}
