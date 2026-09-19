import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import {
  createConnectedAccount,
  createOnboardingLink,
  isConnectConfigured,
} from "@/lib/stripe-connect";
import { setStripeAccount } from "@/lib/store";

/**
 * Sends the creator into Stripe to open or attach their own account.
 *
 * The account is opened once and written down before the creator leaves, so a
 * trip that is abandoned halfway does not leave an account behind that nobody
 * here knows about.
 */
export async function POST(request: NextRequest) {
  const creator = await creatorFrom(request);
  if (creator instanceof Response) return creator;
  const { email, store, origin } = creator;

  if (!isConnectConfigured()) return away(origin, "/studio?stripe=unavailable");

  try {
    let accountId = store.stripeAccountId;
    if (!accountId) {
      accountId = await createConnectedAccount(
        email,
        `${origin}/@${store.handle}`,
      );
      const saved = await setStripeAccount(email, accountId);
      if (!saved.ok) return away(origin, "/studio?stripe=error");
    }

    const link = await createOnboardingLink(accountId, origin);
    return new Response(null, { status: 303, headers: { Location: link } });
  } catch (error) {
    console.error("stripe connect failed", error);
    return away(origin, "/studio?stripe=error");
  }
}
