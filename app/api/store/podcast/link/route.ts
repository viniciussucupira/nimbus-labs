import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { clientAddress, fromAnotherSite, limited } from "@/lib/request-guard";
import { readListing } from "@/lib/catalog";
import { sendFeedLink } from "@/lib/podcast-access";
import { fromStore, storeBase } from "@/lib/purchase-email";

/** "Email me my feed": for a buyer on another device, or one who lost the email. */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  let handle = "";
  let productId = "";
  let email = "";
  try {
    const form = await (await limited(request, 2_000)).formData();
    handle = normaliseHandle(String(form.get("handle") ?? ""));
    productId = String(form.get("product") ?? "").slice(0, 40);
    email = String(form.get("email") ?? "").slice(0, 300);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const store = handle ? await storeForHandle(handle) : null;
  const product = store && productId ? await readListing(store, productId) : null;
  if (!store || !product?.podcast) return new Response(null, { status: 303, headers: { Location: `${origin}/` } });
  const result = await sendFeedLink({ store, product, email, ip: clientAddress(request), base: storeBase(store), from: fromStore(store) }).catch(() => "error" as const);
  return new Response(null, { status: 303, headers: { Location: `${origin}/@${store.handle}/podcast/${product.id}?status=${result}`, "Cache-Control": "no-store" } });
}
