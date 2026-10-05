/**
 * The demo store's Stripe account, asked directly.
 *
 * The demo store itself is an ordinary store (lib/demo-seed.ts): its pages,
 * its checkout and its delivery are the ones every creator's store runs on,
 * and they reach this account the way they reach any creator's — through
 * onAccount (lib/stripe-account.ts), which signs with the demo's own test
 * key. Nothing here sells anything.
 *
 * What is left here is the one other use of that account: checking this
 * site's own Stripe requests against Stripe itself, every day
 * (lib/verify-stripe.ts). Test mode only, like everything about it: a live
 * key is refused before anything is sent (lib/demo-account.ts).
 */
import { STRIPE_TIMEOUT_MS, timed } from "@/lib/fetch-timeout";
import { DEMO_CONNECTED_ACCOUNT, demoKey } from "@/lib/demo-account";

export { DEMO_CONNECTED_ACCOUNT };

// Local tests may point this at a mock server on 127.0.0.1; nothing else is
// accepted.
const STRIPE_API = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  process.env.STRIPE_DEMO_API_BASE ?? "",
)
  ? `${process.env.STRIPE_DEMO_API_BASE}/v1`
  : "https://api.stripe.com/v1";

/** Whether the demo store's account can be reached at all. */
export function isDemoCheckoutConfigured(): boolean {
  return demoKey() !== null;
}

/**
 * One request to the demo's sandbox account, answered whatever its status,
 * for checking this site's own Stripe requests against Stripe itself
 * (lib/verify-stripe.ts).
 */
export async function onDemoAccount(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: URLSearchParams,
  version?: string,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const key = demoKey();
  if (!key) throw new Error("Demo checkout is not configured");
  const { response, data } = await timed(STRIPE_TIMEOUT_MS, async (signal) => {
    const response = await fetch(`${STRIPE_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Account": DEMO_CONNECTED_ACCOUNT,
        ...(version ? { "Stripe-Version": version } : {}),
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body,
      cache: "no-store",
      signal,
    });
    return { response, data: (await response.json()) as Record<string, unknown> };
  });
  return { status: response.status, data };
}
