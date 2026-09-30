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
 * product they choose — how long after a click a purchase still counts, and
 * when they pay. Who is let in is the creator's decision, one application at
 * a time — or, when they choose, anybody who has bought from them.
 *
 * The last two are the promise. An affiliate who cannot see when they will be
 * paid has to ask, and asking is the thing every complaint about every
 * platform in this business is really about. So the creator says it once, in
 * the studio, and it is on the page before anybody applies: the day of the
 * month they pay, and how long a sale waits first so their refund window can
 * pass. Nimbus then holds them to it — a sale inside the wait is not in the
 * batch, and on the day itself the batch arrives in their inbox.
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
  /**
   * The day of the month the creator pays their affiliates, 1 to 28, or 0
   * when they would rather not promise a day. Never 29, 30 or 31: those days
   * do not exist in every month, and a promise that skips February is worse
   * than no promise.
   */
  payday: number;
  /**
   * How many days a sale waits before it can be paid out, so the creator's
   * refund window passes first. 0 means a sale can be paid as soon as it is
   * made. This is the creator's own protection: money paid to an affiliate
   * on a sale that is later refunded has to be asked back by hand.
   */
  hold: number;
  /**
   * Whether anybody who bought from the store may join at once, without an
   * application waiting on the creator: the thanks page and the purchase email
   * offer them their own link. What Stan calls Affiliate Share and Skool calls
   * member affiliates. A buyer the creator declined or removed stays out.
   */
  buyers: boolean;
};

/** The published limits. */
export const MIN_COMMISSION = 1;
export const MAX_COMMISSION = 90;
export const MIN_COOKIE_DAYS = 1;
export const MAX_COOKIE_DAYS = 90;
/** The last day of the month that exists in every month. */
export const MAX_PAYDAY = 28;
/** No day promised. */
export const NO_PAYDAY = 0;
export const MAX_HOLD_DAYS = 90;
/** How many people one store's programme may hold, applications included. */
export const MAX_AFFILIATES = 1_000;

export const NO_AFFILIATES: AffiliateSetting = {
  enabled: false,
  percent: 20,
  days: 30,
  rates: {},
  payday: NO_PAYDAY,
  hold: 0,
  buyers: false,
};

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
    // Both are new, and every programme written down before they existed has
    // neither. Missing means no promised day and no wait, which is what those
    // programmes have always done.
    payday: whole(value.payday, NO_PAYDAY, MAX_PAYDAY) ?? NO_AFFILIATES.payday,
    hold: whole(value.hold, 0, MAX_HOLD_DAYS) ?? NO_AFFILIATES.hold,
    buyers: value.buyers === true,
  };
}

/** "1st", "2nd", "23rd" — the day as it is said in American English. */
export function ordinal(day: number): string {
  const rest = day % 100;
  if (rest >= 11 && rest <= 13) return `${day}th`;
  const last = day % 10;
  return `${day}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

/**
 * The next day the creator pays, counted in UTC, or null when they promised
 * no day. Today counts: on the day itself the answer is today, which is what
 * both the affiliate's page and the morning's email need it to say.
 */
export function nextPayday(payday: number, now = new Date()): Date | null {
  if (payday < 1 || payday > MAX_PAYDAY) return null;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const due = new Date(Date.UTC(year, month, payday));
  if (now.getUTCDate() > payday) return new Date(Date.UTC(year, month + 1, payday));
  return due;
}

/** That date written out: "October 1, 2026". */
export function paydayWords(date: Date): string {
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

/**
 * The promise in one sentence, for the affiliate to read before they apply
 * and every time they look afterwards. When no day is promised it says that
 * plainly rather than dressing it up: an affiliate is owed the truth about
 * when they will be paid, including when the answer is "no fixed day".
 */
export function payoutPromise(setting: AffiliateSetting, storeName: string): string {
  const wait =
    setting.hold > 0
      ? ` A sale is payable ${setting.hold} ${setting.hold === 1 ? "day" : "days"} after it is made, so a refund in that time comes off it first.`
      : "";
  if (setting.payday < 1) {
    return `${storeName} has not set a payment day, and pays when they choose.${wait}`;
  }
  return `${storeName} pays on the ${ordinal(setting.payday)} of each month.${wait}`;
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
