import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { createBillingCheckout, findStoreSubscriptions, isBillingConfigured } from "@/lib/billing";
import { PRO_ON_SALE, parseCycle, parseTier } from "@/lib/plan";
import { setSubscription } from "@/lib/store";

/**
 * Sends the creator to Stripe to start paying us, monthly or yearly.
 *
 * Nothing new is written down here. The subscription only becomes real when
 * Stripe says it exists, on the way back, so a creator who opens the page and
 * closes it is left exactly as they were.
 *
 * Except one thing: a subscription Stripe already has for this store, in good
 * standing, that the store never heard about because the way back did not
 * arrive. That one is written down, and no second checkout is opened over it,
 * because two subscriptions for one store is two charges for one store.
 */
export async function POST(request: NextRequest) {
  const creator = await creatorFrom(request);
  if (creator instanceof Response) return creator;
  const { email, store, origin } = creator;

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

  // Stripe not answering the question does not stop a first payment: the
  // daily job still finds anything this misses.
  let customerId = store.stripeCustomerId;
  try {
    const found = await findStoreSubscriptions(store);
    if (found.live) {
      await setSubscription(email, found.live);
      return away(origin, "/studio?billing=already");
    }
    customerId = customerId ?? found.customerId;
  } catch (error) {
    console.error("looking for this store's subscriptions failed", error);
  }

  try {
    const url = await createBillingCheckout(store, origin, { tier, cycle }, customerId);
    return new Response(null, { status: 303, headers: { Location: url } });
  } catch (error) {
    console.error("billing checkout failed", error);
    return away(origin, "/studio?billing=error");
  }
}
