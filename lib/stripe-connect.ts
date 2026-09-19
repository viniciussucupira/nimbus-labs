/**
 * Connecting a creator's own Stripe account.
 *
 * The creator ends up owning a full Stripe account: their name on it, their
 * dashboard, their payouts, their money. Nimbus holds the account's identifier
 * and nothing else — no key to it, and never the money that lands in it. That
 * is what lets the site say the buyer pays into the creator's own account
 * without stretching the truth.
 *
 * Standard accounts with Connect Onboarding, which is Stripe's stable path.
 * Their newer Accounts v2 API is still on a preview API version, and a
 * one-person company should not have its money path pinned to a preview.
 */

/** Local tests may point this at a mock on 127.0.0.1; nothing else is taken. */
const STRIPE_API = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  process.env.STRIPE_CONNECT_API_BASE ?? "",
)
  ? `${process.env.STRIPE_CONNECT_API_BASE}/v1`
  : "https://api.stripe.com/v1";

/** A link Stripe hands back is short-lived and single use. */
export const ONBOARDING_LINK_TTL_SECONDS = 5 * 60;

function platformKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) return null;
  return key;
}

export function isConnectConfigured(): boolean {
  return platformKey() !== null;
}

/** True when the platform key is a test key, so the UI can say so plainly. */
export function isConnectInTestMode(): boolean {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
}

export class StripeConnectError extends Error {
  readonly status: number;

  constructor(status: number, code: string) {
    super(`Stripe request failed (${status} ${code})`);
    this.status = status;
  }
}

async function stripeRequest(
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams,
): Promise<Record<string, unknown>> {
  const key = platformKey();
  if (!key) throw new Error("Stripe is not configured");

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as { code?: string; type?: string } | undefined;
    throw new StripeConnectError(
      response.status,
      error?.code ?? error?.type ?? "unknown",
    );
  }
  return data;
}

/**
 * Opens a Stripe account that belongs to the creator.
 *
 * `type: standard` is the whole point: the account holder signs Stripe's
 * agreement themselves, logs into Stripe themselves, and can walk away from
 * Nimbus without losing it.
 */
export async function createConnectedAccount(
  email: string,
  storeUrl: string,
): Promise<string> {
  const body = new URLSearchParams({
    type: "standard",
    email,
    "business_profile[url]": storeUrl,
  });
  const account = await stripeRequest("POST", "/accounts", body);
  const id = account.id;
  if (typeof id !== "string" || !id) {
    throw new Error("Stripe did not return an account id");
  }
  return id;
}

/**
 * The one-time link that takes the creator into Stripe's own onboarding.
 *
 * Stripe is explicit that these must never be emailed or passed around: they
 * open a door to the account holder's personal information, so this link only
 * ever goes to a browser that has just proved it holds the session.
 */
export async function createOnboardingLink(
  accountId: string,
  origin: string,
): Promise<string> {
  const body = new URLSearchParams({
    account: accountId,
    refresh_url: `${origin}/api/stripe/refresh`,
    return_url: `${origin}/api/stripe/return`,
    type: "account_onboarding",
  });
  const link = await stripeRequest("POST", "/account_links", body);
  if (typeof link.url !== "string" || !link.url) {
    throw new Error("Stripe did not return an onboarding link");
  }
  return link.url;
}

export type AccountState = {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
};

/** Asks Stripe what that account can actually do right now. */
export async function readAccount(accountId: string): Promise<AccountState> {
  const account = await stripeRequest(
    "GET",
    `/accounts/${encodeURIComponent(accountId)}`,
  );
  return {
    chargesEnabled: account.charges_enabled === true,
    detailsSubmitted: account.details_submitted === true,
  };
}
