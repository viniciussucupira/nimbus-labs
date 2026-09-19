import type { NextRequest } from "next/server";
import { away, creatorFrom } from "@/lib/studio-route";
import { clearStripeAccount } from "@/lib/store";

/**
 * Forgets the connection on this side.
 *
 * Deliberately only this side. The Stripe account belongs to the creator, and
 * closing it or removing Nimbus from it is theirs to do, in their own Stripe
 * dashboard. Pretending otherwise would be claiming a power over their money
 * that this product should not have.
 */
export async function POST(request: NextRequest) {
  const creator = await creatorFrom(request);
  if (creator instanceof Response) return creator;
  const { email, origin } = creator;

  try {
    const result = await clearStripeAccount(email);
    if (!result) return away(origin, "/studio?stripe=nostore");
    return away(origin, "/studio?stripe=forgotten");
  } catch (error) {
    console.error("stripe disconnect failed", error);
    return away(origin, "/studio?stripe=error");
  }
}
