// Demo creator store: proves that a buyer can pay a creator directly and get
// the file right after Stripe confirms the payment. Test mode only.
import type { DemoFileName } from "@/lib/demo-file";

export type DemoOption = {
  id: string;
  label: string;
  detail: string;
  priceCents: number;
  file: DemoFileName;
};

// One product, several price options: something Stan creators ask for
// (Stan Help Center, "Common Feature Requests", 24 Mar 2026).
export const DEMO_PRODUCT = {
  id: "weekly-meal-planner",
  name: "Weekly Meal Planner",
  description:
    "Simple family meal plans with breakfasts, lunches, dinners and a grocery list for each week.",
  currency: "usd",
  bullets: [
    "Simple family meals for every day",
    "Grocery list you can print",
    "Download right after payment",
  ],
  options: [
    {
      id: "one-week",
      label: "1 week",
      detail: "PDF, 1 page",
      priceCents: 2700,
      file: "weekly-meal-planner.pdf",
    },
    {
      id: "five-weeks",
      label: "5 weeks",
      detail: "PDF, 5 pages",
      priceCents: 3900,
      file: "meal-planner-5-weeks.pdf",
    },
  ] satisfies DemoOption[],
} as const;

export function findDemoOption(id: unknown): DemoOption | undefined {
  return DEMO_PRODUCT.options.find((option) => option.id === id);
}

export const LOWEST_PRICE_CENTS = Math.min(
  ...DEMO_PRODUCT.options.map((option) => option.priceCents),
);

// Stripe sandbox connected account of the fictional creator. Charges are made
// directly on this account (direct charges), so the money lands with the
// creator, not with Nimbus Labs.
const DEMO_CONNECTED_ACCOUNT = "acct_1UGdQH6rwR1Kc2eJ";

// A buyer can download the file for this long after starting checkout.
export const DOWNLOAD_WINDOW_SECONDS = 3 * 24 * 60 * 60;

// Local tests may point this at a mock server on 127.0.0.1; nothing else is
// accepted.
const STRIPE_API = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  process.env.STRIPE_DEMO_API_BASE ?? "",
)
  ? `${process.env.STRIPE_DEMO_API_BASE}/v1`
  : "https://api.stripe.com/v1";
const SESSION_ID_PATTERN = /^cs_test_[A-Za-z0-9]{10,200}$/;

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

function getSecretKey(): string | null {
  const key = process.env.STRIPE_DEMO_SECRET_KEY?.trim();
  // Refuse live keys: this demo must never move real money.
  if (!key || !/^(sk|rk)_test_/.test(key)) return null;
  return key;
}

export function isDemoCheckoutConfigured(): boolean {
  return getSecretKey() !== null;
}

class StripeError extends Error {
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
  const key = getSecretKey();
  if (!key) throw new Error("Demo checkout is not configured");

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Account": DEMO_CONNECTED_ACCOUNT,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as { code?: string; type?: string } | undefined;
    throw new StripeError(
      response.status,
      error?.code ?? error?.type ?? "unknown",
    );
  }
  return data;
}

export async function createDemoCheckout(
  origin: string,
  option: DemoOption,
): Promise<string> {
  const p = DEMO_PRODUCT;
  const body = new URLSearchParams({
    mode: "payment",
    // The same language as the rest of the site, whatever the browser says.
    locale: "en",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": p.currency,
    "line_items[0][price_data][unit_amount]": String(option.priceCents),
    "line_items[0][price_data][product_data][name]": `${p.name} (${option.label})`,
    "line_items[0][price_data][product_data][description]": `${p.description} ${option.detail}.`,
    "metadata[product]": p.id,
    "metadata[option]": option.id,
    "payment_intent_data[metadata][product]": p.id,
    "payment_intent_data[metadata][option]": option.id,
    success_url: `${origin}/demo/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/demo`,
  });

  const session = await stripeRequest("POST", "/checkout/sessions", body);
  if (typeof session.url !== "string") {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}

export type DemoOrder =
  | {
      state: "paid";
      amount: number;
      option: DemoOption;
      /** The address the buyer paid with, so we can send the file again. */
      email: string | null;
      /** How long this download still has, in seconds. */
      secondsLeft: number;
    }
  | { state: "unpaid" | "expired" | "invalid" | "unavailable" | "error" };

// Looks up a Checkout Session and decides whether the buyer may download.
// The file is released only when Stripe reports the session as paid.
export async function getDemoOrder(
  sessionId: string | undefined,
): Promise<DemoOrder> {
  if (!isDemoCheckoutConfigured()) return { state: "unavailable" };
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    return { state: "invalid" };
  }

  let session: Record<string, unknown>;
  try {
    session = await stripeRequest(
      "GET",
      `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    );
  } catch (error) {
    if (error instanceof StripeError && error.status === 404) {
      return { state: "invalid" };
    }
    console.error("Demo order lookup failed", error);
    return { state: "error" };
  }

  const metadata = session.metadata as Record<string, string> | null;
  const option = findDemoOption(metadata?.option);
  if (
    session.livemode !== false ||
    metadata?.product !== DEMO_PRODUCT.id ||
    !option
  ) {
    return { state: "invalid" };
  }
  if (session.status !== "complete" || session.payment_status !== "paid") {
    return { state: "unpaid" };
  }

  const created = typeof session.created === "number" ? session.created : 0;
  const age = Date.now() / 1000 - created;
  if (age > DOWNLOAD_WINDOW_SECONDS) {
    return { state: "expired" };
  }

  const details = session.customer_details as { email?: unknown } | null;
  const email =
    typeof details?.email === "string" && details.email ? details.email : null;

  return {
    state: "paid",
    option,
    amount:
      typeof session.amount_total === "number" ? session.amount_total : 0,
    email,
    secondsLeft: Math.max(0, Math.floor(DOWNLOAD_WINDOW_SECONDS - age)),
  };
}
