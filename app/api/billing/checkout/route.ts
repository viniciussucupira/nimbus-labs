import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { createBillingCheckout, findStoreSubscriptions, isBillingConfigured } from "@/lib/billing";
import { PRO_ON_SALE, parseCycle, parseTier } from "@/lib/plan";
import { accountStores, setSubscription } from "@/lib/store";
import { limited } from "@/lib/request-guard";

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
 *
 * Each store of an account is its own subscription at its own plan; only
 * the owner reaches this (lib/team-roles.ts, "billing").
 */
export async function POST(request: NextRequest) {
  const creator = await creatorFrom(request, "billing");
  if (creator instanceof Response) return creator;
  const { ref, store, origin, studio } = creator;

  if (!isBillingConfigured()) return away(origin, studio("billing=unavailable"));
  if (store.subscriptionActive) return away(origin, studio("billing=already"));

  let fields: FormData | null = null;
  try {
    fields = await (await limited(request, 8_000)).formData();
  } catch {
    fields = null;
  }
  // A form from before there was a choice sends neither: that is monthly.
  const cycle = parseCycle(fields?.get("cycle") ?? "month");
  const tier = parseTier(fields?.get("tier") ?? "creator");
  if (!cycle || !tier) return away(origin, studio("billing=error"));
  if (tier === "pro" && !PRO_ON_SALE) return away(origin, studio("billing=pro-closed"));

  // Stripe not answering the question does not stop a first payment: the
  // daily job still finds anything this misses.
  let customerId = store.stripeCustomerId;
  try {
    const found = await findStoreSubscriptions(store);
    if (found.live) {
      await setSubscription(ref, found.live);
      return away(origin, studio("billing=already"));
    }
    customerId = customerId ?? found.customerId;
  } catch (error) {
    console.error("looking for this store's subscriptions failed", error);
  }
  // Another store of the same account pays as the customer its owner already
  // is, so one person is one customer at Stripe however many stores they run.
  if (!customerId && store.extra) {
    const owned = await accountStores(store.email).catch(() => []);
    customerId = owned.find((other) => other.stripeCustomerId)?.stripeCustomerId ?? null;
  }

  try {
    const url = await createBillingCheckout(store, origin, { tier, cycle }, customerId);
    return new Response(null, { status: 303, headers: { Location: url } });
  } catch (error) {
    console.error("billing checkout failed", error);
    return away(origin, studio("billing=error"));
  }
}
