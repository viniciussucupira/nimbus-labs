import type { NextRequest } from "next/server";
import { isFree, storeForHandle } from "@/lib/store";
import { recordLead, spendClaim } from "@/lib/free";
import { plain, serveFile } from "@/lib/serve-file";

/**
 * Hands over a free copy, from the link that was emailed.
 *
 * Only a POST opens it. Mail providers and security scanners open every link
 * in an email to look at it, and a GET that handed over the file would put
 * addresses on a creator's list that no person ever confirmed. The emailed
 * link lands on a page with a button; the button is this.
 *
 * The address joins the list here, before the file is sent, because this is
 * the moment it is proved: somebody holding that inbox pressed the button.
 */
export async function POST(request: NextRequest) {
  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (sender && host) {
    try {
      if (new URL(sender).host !== host) return plain(403, "forbidden");
    } catch {
      return plain(403, "forbidden");
    }
  }

  let token = "";
  try {
    const value = (await request.formData()).get("token");
    token = typeof value === "string" ? value.slice(0, 100) : "";
  } catch {
    return plain(400, "Bad request");
  }

  const used = await spendClaim(token);
  if (!used.ok) {
    return used.reason === "spent"
      ? plain(429, "This link has been used as many times as it can be. Ask the store for a new copy.")
      : plain(410, "This link has expired. Ask the store for a new copy.");
  }
  const { claim } = used;

  const store = await storeForHandle(claim.h);
  if (!store) return plain(404, "This store is not here any more.");

  // Looked up again rather than trusted from the claim: a product the creator
  // has since removed, or started charging for, is not handed out for free
  // on the strength of an old email.
  const product = store.products.find((item) => item.id === claim.p);
  if (!product || !isFree(product)) {
    return plain(410, "This is no longer offered for free.");
  }
  if (!product.file && !product.link) {
    return plain(404, "There is nothing on this yet. Ask the store about it.");
  }

  await recordLead(store, claim, product.title);

  if (product.link) {
    return new Response(null, {
      status: 303,
      headers: { Location: product.link, "Cache-Control": "no-store" },
    });
  }
  return product.file
    ? serveFile(product.file)
    : plain(404, "There is nothing on this yet. Ask the store about it.");
}
