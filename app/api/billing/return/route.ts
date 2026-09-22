import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { isBillingConfigured, readStartedSubscription } from "@/lib/billing";
import { setSubscription } from "@/lib/store";

/**
 * Where Stripe sends a creator who has finished, or looked like they finished.
 *
 * The session id in the URL is a claim made by a browser, so nothing is
 * believed until Stripe is asked what that session actually created and
 * whether it belongs to this store. Coming back through this door proves the
 * door was walked through, nothing more.
 */
export async function GET(request: NextRequest) {
  const creator = await creatorFrom(request, { checkOrigin: false });
  if (creator instanceof Response) return creator;
  const { email, store, origin } = creator;

  if (!isBillingConfigured()) return away(origin, "/studio?billing=unavailable");

  const sessionId = request.nextUrl.searchParams.get("session_id") ?? undefined;

  try {
    const started = await readStartedSubscription(store, sessionId);
    if (!started) return away(origin, "/studio?billing=unfinished");

    const saved = await setSubscription(email, {
      customerId: started.customerId,
      subscriptionId: started.subscriptionId,
      active: started.active,
      tier: started.tier,
      cycle: started.cycle,
      trialEnds: started.trialEnds,
    });
    if (!saved) return away(origin, "/studio?billing=error");

    return away(origin, `/studio?billing=${started.active ? "on" : "pending"}`);
  } catch (error) {
    console.error("billing return failed", error);
    return away(origin, "/studio?billing=error");
  }
}
