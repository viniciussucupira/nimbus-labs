import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { isConnectConfigured, readAccount } from "@/lib/stripe-connect";
import { setStripeAccount } from "@/lib/store";

/**
 * Where Stripe sends a creator who has come out the other side.
 *
 * Coming back does not mean Stripe is satisfied — it only means the flow was
 * entered and left. So we ask Stripe what the account can actually do and
 * write that down, rather than telling the creator they are ready because
 * they walked through a door.
 */
export async function GET(request: NextRequest) {
  const creator = await creatorFrom(request, { checkOrigin: false });
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
    console.error("stripe return failed", error);
    return away(origin, "/studio?stripe=error");
  }
}
