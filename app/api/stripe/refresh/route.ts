import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { createOnboardingLink, isConnectConfigured } from "@/lib/stripe-connect";

/**
 * Where Stripe sends a creator whose onboarding link went stale.
 *
 * Those links last minutes and work once, so a refresh, a back button or a
 * slow afternoon all land here. Stripe arrives by redirect, which is a GET
 * from another site, so there is no origin to check — the session cookie is
 * what says who this is, and a stranger gets nothing but the sign-in page.
 */
export async function GET(request: NextRequest) {
  const creator = await creatorFrom(request, { checkOrigin: false });
  if (creator instanceof Response) return creator;
  const { store, origin } = creator;

  if (!isConnectConfigured()) return away(origin, "/studio?stripe=unavailable");
  if (!store.stripeAccountId) return away(origin, "/studio?stripe=notstarted");

  try {
    const link = await createOnboardingLink(store.stripeAccountId, origin);
    return new Response(null, { status: 303, headers: { Location: link } });
  } catch (error) {
    console.error("stripe refresh failed", error);
    return away(origin, "/studio?stripe=error");
  }
}
