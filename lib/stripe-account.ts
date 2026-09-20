/**
 * Talking to Stripe as the creator, not as us.
 *
 * Every call here carries the creator's connected account in the Stripe-Account
 * header, so it acts on their account with their data. That is the same fact
 * the whole company rests on: the money is theirs from the first second, the
 * customers are theirs, and so are the coupons and the sales records. Nothing
 * in this file ever touches the Nimbus account.
 *
 * It lives on its own rather than inside the checkout because more than one
 * thing needs it now, and two copies of the code that signs a request to
 * somebody else's account is exactly the kind of duplication that ends with
 * one of them quietly missing a header.
 */

/** Local tests may point this at a mock on 127.0.0.1; nothing else is taken. */
const STRIPE_API = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  process.env.STRIPE_CONNECT_API_BASE ?? "",
)
  ? `${process.env.STRIPE_CONNECT_API_BASE}/v1`
  : "https://api.stripe.com/v1";

export function platformKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) return null;
  return key;
}

export class StripeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, stripeMessage: string) {
    // Stripe's own sentence is kept, because a bare code in a log is a trip
    // through the Stripe dashboard before anyone knows what went wrong.
    super(`Stripe request failed (${status} ${code}): ${stripeMessage}`);
    this.status = status;
    this.code = code;
  }
}

/**
 * One request, made on a connected account.
 *
 * `version` pins the API version for this call. Left out, Stripe uses whatever
 * our platform account currently defaults to — which is fine for shapes that
 * have not changed in years, and is a trap for the ones that have. A caller
 * that sends a parameter whose name depends on the version pins it, so the
 * request and the version can never disagree, today or after an upgrade.
 */
export async function onAccount(
  method: "GET" | "POST",
  account: string,
  path: string,
  body?: URLSearchParams,
  version?: string,
): Promise<Record<string, unknown>> {
  const key = platformKey();
  if (!key) throw new Error("Selling is not configured");

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      // The whole point: this acts on the creator's account, not ours.
      "Stripe-Account": account,
      ...(version ? { "Stripe-Version": version } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as
      | { code?: string; type?: string; message?: string }
      | undefined;
    throw new StripeError(
      response.status,
      error?.code ?? error?.type ?? "unknown",
      error?.message ?? "Stripe gave no reason.",
    );
  }
  return data;
}
