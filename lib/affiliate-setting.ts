/**
 * The terms of a store's affiliate programme, as the store record keeps them.
 *
 * Kept apart from lib/affiliates.ts, which reads and writes the affiliates,
 * their clicks and their sales, so the store record, the studio and the
 * checkout can know the terms without importing anything that talks to
 * Redis, Stripe or the sender.
 *
 * What a creator sets is small on purpose: whether it is on, what share of a
 * sale an affiliate earns — for the whole store, and differently for any
 * product they choose — and how long after a click a purchase still counts.
 * Who is let in is always the creator's decision, one application at a time.
 */

export type AffiliateSetting = {
  /** Switched on by the creator in the studio. Off until they do. */
  enabled: boolean;
  /** What an affiliate earns on a sale, in percent of what was paid before tax. */
  percent: number;
  /** How many days after a click a purchase still counts for that affiliate. */
  days: number;
  /**
   * A different share for some products, by product id. 0 leaves a product
   * out of the programme; a product not listed earns the store-wide share.
   */
  rates: Record<string, number>;
};

/** The published limits. */
export const MIN_COMMISSION = 1;
export const MAX_COMMISSION = 90;
export const MIN_COOKIE_DAYS = 1;
export const MAX_COOKIE_DAYS = 90;
/** How many people one store's programme may hold, applications included. */
export const MAX_AFFILIATES = 1_000;

export const NO_AFFILIATES: AffiliateSetting = { enabled: false, percent: 20, days: 30, rates: {} };

const whole = (value: unknown, min: number, max: number): number | null => {
  const n = typeof value === "string" && value.trim() ? Number(value.trim()) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Whatever came back from storage or from the studio, made safe to use. */
export function parseAffiliateSetting(raw: unknown): AffiliateSetting {
  if (!raw || typeof raw !== "object") return { ...NO_AFFILIATES, rates: {} };
  const value = raw as Record<string, unknown>;
  const rates: Record<string, number> = {};
  if (value.rates && typeof value.rates === "object" && !Array.isArray(value.rates)) {
    for (const [id, rate] of Object.entries(value.rates as Record<string, unknown>).slice(0, 200)) {
      // 0 is allowed here, and only here: it takes one product out.
      const n = whole(rate, 0, MAX_COMMISSION);
      if (/^[a-z0-9]{6,40}$/.test(id) && n !== null) rates[id] = n;
    }
  }
  return {
    enabled: value.enabled === true,
    percent: whole(value.percent, MIN_COMMISSION, MAX_COMMISSION) ?? NO_AFFILIATES.percent,
    days: whole(value.days, MIN_COOKIE_DAYS, MAX_COOKIE_DAYS) ?? NO_AFFILIATES.days,
    rates,
  };
}

/** What an affiliate earns on this product, in percent; 0 when it is left out. */
export function commissionRate(setting: AffiliateSetting, productId: string): number {
  const own = setting.rates[productId];
  return typeof own === "number" ? own : setting.percent;
}

/** What a percentage of an amount comes to, in whole cents, rounded down. */
export function commissionOn(baseCents: number, percent: number): number {
  if (baseCents <= 0 || percent <= 0) return 0;
  return Math.floor((baseCents * percent) / 100);
}

/** The code an affiliate's link carries: ?via=<code>. */
export const AFFILIATE_CODE_PATTERN = /^[a-z0-9]{3,20}$/;

/**
 * The first-party cookie a click leaves, one per store, named after it so a
 * visitor sent to two stores keeps both. It holds the code and the time of
 * the click; the checkout decides from those whether it still counts.
 */
export function viaCookieName(handle: string): string {
  return `nl_via_${handle.replace(/[^a-z0-9._-]/g, "")}`;
}

/** The longest any store's window can be, so the cookie never outlives it. */
export const VIA_COOKIE_SECONDS = MAX_COOKIE_DAYS * 24 * 60 * 60;

/** Reads the cookie: the code and the click's time, or null. */
export function readViaCookie(raw: string | undefined): { code: string; at: number } | null {
  if (!raw) return null;
  const match = raw.match(/^([a-z0-9]{3,20})\.(\d{9,11})$/);
  return match ? { code: match[1], at: Number(match[2]) } : null;
}
