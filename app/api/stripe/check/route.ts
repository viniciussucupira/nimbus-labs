import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { isConnectConfigured, readAccount } from "@/lib/stripe-connect";
import { setStripeAccount } from "@/lib/store";

/** Asks Stripe again, on the creator's word, and writes down what it says. */
export async function POST(request: NextRequest) {
  const creator = await creatorFrom(request);
  if (creator instanceof Response) return creator;
  const { email, store, origin } = creator;

  if (!isConnectConfigured()) return away(origin, "/studio?stripe=unavailable");
  if (!store.stripeAccountId) return away(origin, "/studio?stripe=notstarted");

  try {
    const state = await readAccount(store.stripeAccountId);
    await setStripeAccount(email, store.stripeAccountId, state.chargesEnabled);
    return away(
      origin,
      `/studio?stripe=${state.chargesEnabled ? "ready" : "pending"}`,
    );
  } catch (error) {
    console.error("stripe check failed", error);
    return away(origin, "/studio?stripe=error");
  }
}
