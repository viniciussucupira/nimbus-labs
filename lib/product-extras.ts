/**
 * Two things a creator can add to a one-off product, and the rules for each.
 *
 * An order bump: another of their products, offered at a price of their own
 * choosing in a box the buyer can tick before paying. The box is never ticked
 * for them — an extra charge the buyer did not choose is not a sale, and in
 * Europe it is not allowed either.
 *
 * A limited quantity: the product stops selling once that many have been
 * paid for. The number the page shows is the real one, counted from real
 * checkouts, because scarcity that is not true is a lie told to a buyer.
 *
 * A funnel of one-click offers after paying (lib/funnel.ts): each offer is
 * another product, and one press adds it, charged to the card the buyer just
 * used. The same rules apply to what can be offered as to a bump.
 *
 * A payment plan: the same product, paid in a fixed number of weekly or
 * monthly payments instead of at once, delivered after the first. It ends
 * by itself after the last payment.
 *
 * Pure, so the studio and the server apply the same rules.
 */
import type { Listing } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export type Bump = {
  /** Another product of the same store. */
  productId: string;
  /** What it costs when added this way, in the store currency's smallest unit. */
  priceCents: number;
  /** One line under the box, in the creator's words. */
  pitch: string;
};

export const MAX_PITCH_LENGTH = 140;
export const MAX_STOCK = 100_000;
/**
 * The lowest any currency lets a single charge be, in its smallest unit: the
 * floor a stored amount is read back with. The store's own currency sets the
 * real floor when it is saved (lib/money.ts, minCharge): fifty cents for the
 * dollar, as it always was.
 */
export const MIN_BUMP_CENTS = 50;

export function parseStock(raw: unknown): number | null {
  const n = typeof raw === "string" && raw.trim() ? Number(raw.trim()) : raw;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_STOCK) return null;
  return n;
}

export function parseBump(raw: unknown): Bump | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.productId !== "string" || !/^[a-z0-9]{6,40}$/.test(value.productId)) return null;
  if (typeof value.priceCents !== "number" || !Number.isInteger(value.priceCents)) return null;
  if (value.priceCents < MIN_BUMP_CENTS || value.priceCents > 10_000_000) return null;
  const pitch = typeof value.pitch === "string" ? value.pitch.replace(/\s+/g, " ").trim().slice(0, MAX_PITCH_LENGTH) : "";
  return { productId: value.productId, priceCents: value.priceCents, pitch };
}

/** Whether a product is a plain one-off sale: the only kind these apply to. */
export function isOneOff(product: Listing): boolean {
  return product.priceCents > 0 && product.recurring === null && product.call === null;
}

/**
 * Whether a product can be the thing added: something with one price and one
 * delivery, so the buyer who ticks the box gets exactly one clear thing. A
 * product whose buyers choose the price has no one price to offer it at.
 */
export function canBeBumped(product: Listing): boolean {
  return (
    isOneOff(product) &&
    product.options.length === 0 &&
    !product.pwyw &&
    (product.file !== null || product.link !== null)
  );
}

/** The bump a buyer may be offered on this product right now, or null. */
export function activeBump(products: Listing[], product: Listing): { bump: Bump; target: Listing } | null {
  // Stripe lets a chosen amount be the only line of its checkout.
  if (!product.bump || !isOneOff(product) || product.pwyw) return null;
  const target = products.find((p) => p.id === product.bump!.productId);
  if (!target || target.id === product.id || !canBeBumped(target)) return null;
  // Never dearer than buying it on its own.
  if (product.bump.priceCents > target.priceCents) return null;
  return { bump: product.bump, target };
}

/** Whether a product's quantity is limited right now. */
export function limitedStock(product: Listing): number | null {
  return product.stock !== null && isOneOff(product) ? product.stock : null;
}

export type Plan = {
  /** How many payments in all, the first one today. */
  payments: number;
  interval: "week" | "month";
  /** Each payment, in the store currency's smallest unit. */
  amountCents: number;
};

export const MIN_PLAN_PAYMENTS = 2;
export const MAX_PLAN_PAYMENTS = 12;

export function parsePlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const payments = Number(value.payments);
  if (!Number.isInteger(payments) || payments < MIN_PLAN_PAYMENTS || payments > MAX_PLAN_PAYMENTS) return null;
  if (value.interval !== "week" && value.interval !== "month") return null;
  if (typeof value.amountCents !== "number" || !Number.isInteger(value.amountCents)) return null;
  if (value.amountCents < MIN_BUMP_CENTS || value.amountCents > 10_000_000) return null;
  return { payments, interval: value.interval, amountCents: value.amountCents };
}

/**
 * The plan a buyer may choose for this product, or null. A plan never adds up
 * to less than paying at once, and it is offered on a product with one price.
 */
export function activePlan(product: Listing): Plan | null {
  const plan = product.plan;
  if (!plan || !isOneOff(product) || product.options.length > 0 || product.pwyw) return null;
  if (plan.payments * plan.amountCents < product.priceCents) return null;
  return plan;
}

/** "3 monthly payments of $110", in the store's currency. */
export function planWords(plan: Plan, currency: string): string {
  return `${plan.payments} ${plan.interval === "week" ? "weekly" : "monthly"} payments of ${formatMoney(plan.amountCents, currency)}`;
}
