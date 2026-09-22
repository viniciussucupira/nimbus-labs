import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { createBillingCheckout, isBillingConfigured } from "@/lib/billing";
import { PRO_ON_SALE, parseCycle, parseTier } from "@/lib/plan";

/**
 * Sends the creator to Stripe to start paying us, monthly or yearly.
 *
 * Nothing is written down here. The subscription only becomes real when Stripe
 * says it exists, on the way back, so a creator who opens the page and closes
 * it is left exactly as they were.
 */
export async function POST(request: NextRequest) {
  const creator = await creatorFrom(request);
  if (creator instanceof Response) return creator;
  const { store, origin } = creator;

  if (!isBillingConfigured()) return away(origin, "/studio?billing=unavailable");
  if (store.subscriptionActive) return away(origin, "/studio?billing=already");

  let fields: FormData | null = null;
  try {
    fields = await request.formData();
  } catch {
    fields = null;
  }
  // A form from before there was a choice sends neither: that is monthly.
  const cycle = parseCycle(fields?.get("cycle") ?? "month");
  const tier = parseTier(fields?.get("tier") ?? "creator");
  if (!cycle || !tier) return away(origin, "/studio?billing=error");
  if (tier === "pro" && !PRO_ON_SALE) return away(origin, "/studio?billing=pro-closed");

  try {
    const url = await createBillingCheckout(store, origin, { tier, cycle });
    return new Response(null, { status: 303, headers: { Location: url } });
  } catch (error) {
    console.error("billing checkout failed", error);
    return away(origin, "/studio?billing=error");
  }
}
