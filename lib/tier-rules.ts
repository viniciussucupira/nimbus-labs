/**
 * Membership tiers: memberships a member can switch between, up or down,
 * from their own membership page, as rules the browser can read too. The
 * switch itself is in lib/tier-switch.ts.
 *
 * Measured before it was built (30 September 2026): Stan's help center says
 * existing members stay at the price they bought at (article 132) and has no
 * way for a member to move from one membership to another.
 *
 * What a membership hands over is read, at every door, from the product its
 * subscription is on NOW, not the one it was bought as:
 *
 *   1. the price on the subscription, when it is a price made for a switch:
 *      that price names its product in its own metadata, so the price the
 *      member pays and what they get change in the same instant;
 *   2. the subscription's own `product`, rewritten after a switch;
 *   3. the checkout's `product`, for every membership never switched.
 */

export const MIN_TIERS = 2;
export const MAX_TIERS = 6;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

/** The tiers a store keeps: 2 to 6 product ids, or none. */
export function parseTiers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === "string" && ID.test(id) && !out.includes(id)) out.push(id);
    if (out.length === MAX_TIERS) break;
  }
  return out.length >= MIN_TIERS ? out : [];
}

type TierLike = {
  priceCents: number;
  recurring: { interval: string; payments: number } | null;
  options: unknown[];
  pwyw?: unknown;
  hidden?: boolean;
};

/**
 * Whether a product can be a tier: a paid membership that runs until it is
 * canceled, at one price. One that ends after a set number of payments was
 * sold as that many payments, and a switch would have to rewrite its end.
 */
export function canTier(product: TierLike): boolean {
  return (
    product.priceCents > 0 &&
    product.recurring !== null &&
    product.recurring.payments === 0 &&
    product.options.length === 0 &&
    !product.pwyw
  );
}

type SubLike = {
  metadata?: Record<string, string> | null;
  items?: { data?: { price?: { metadata?: Record<string, string> | null } | null }[] | null } | null;
};

/** The product a subscription is on now, or `fallback` when it says nothing. */
export function productOfSub(sub: unknown, fallback = ""): string {
  if (!sub || typeof sub !== "object") return fallback;
  const s = sub as SubLike;
  const fromPrice = s.items?.data?.[0]?.price?.metadata?.product;
  if (typeof fromPrice === "string" && ID.test(fromPrice)) return fromPrice;
  const fromSub = s.metadata?.product;
  if (typeof fromSub === "string" && ID.test(fromSub)) return fromSub;
  return fallback;
}

/**
 * A checkout's metadata as it stands now: for a membership that was switched,
 * the product it is on today in place of the one bought, with the bought
 * one's price option dropped. Everything else — a payment, a payment plan, a
 * membership never switched — comes back as it was.
 */
export function currentMeta<M extends Record<string, string | undefined>>(
  meta: M,
  session: { mode?: unknown; subscription?: unknown },
): M {
  if (session.mode !== "subscription" || meta.kind === "plan") return meta;
  const bought = meta.product ?? "";
  const now = productOfSub(session.subscription, bought);
  if (!now || now === bought) return meta;
  const next: Record<string, string | undefined> = { ...meta, product: now };
  delete next.option;
  return next as M;
}

/**
 * Up or down, for the page to say, between two plans billed on the same
 * schedule. Between a monthly and a yearly plan it says neither: which is
 * "up" is the member's to judge, and the page shows both prices.
 */
export function direction(from: { priceCents: number; interval: string }, to: { priceCents: number; interval: string }): "up" | "down" | "same" {
  if (from.interval !== to.interval) return "same";
  return to.priceCents > from.priceCents ? "up" : to.priceCents < from.priceCents ? "down" : "same";
}
