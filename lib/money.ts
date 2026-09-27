/**
 * Money, in the currency the creator's store charges in.
 *
 * Every amount here is held the way Stripe holds it: a whole number of the
 * currency's smallest unit. For dollars, euros and pounds that is cents or
 * pence, so 2700 is 27.00; for the yen, which has no smaller unit, 2700 is
 * ¥2,700. The number that travels to Stripe is the number that was saved,
 * with no multiplying on the way, because the one place an amount can go
 * wrong by a factor of a hundred is a conversion somebody forgot.
 *
 * So the rules for a currency live here, once: how many decimals it is
 * written with, the smallest and largest price a product may have in it, the
 * smallest charge Stripe takes in it, and how it is written for a person.
 * Everything that shows money — the store page, the checkout's names, the
 * emails, the studio's numbers, the spreadsheets — asks this file, so a store
 * in yen never meets a "$" or a ".00" anywhere.
 *
 * The list is the currencies a store can choose. Each is one Stripe settles
 * for accounts in every country the studio offers, and each range is about
 * the same one as the dollar's ($1 to $5,000), rounded to what a price in that
 * currency looks like. A sale Stripe reports in some other currency — made
 * before a store changed its own — is still written correctly: formatMoney
 * takes any ISO code, and knows Stripe's zero-decimal ones.
 *
 * Pure, so the studio's own screens and the server apply the same rules.
 */

export type Currency =
  | "usd"
  | "eur"
  | "gbp"
  | "cad"
  | "aud"
  | "nzd"
  | "chf"
  | "sek"
  | "nok"
  | "dkk"
  | "pln"
  | "jpy"
  | "sgd"
  | "hkd"
  | "mxn";

export type CurrencyRule = {
  code: Currency;
  /** Its name, in a sentence: "US dollar". */
  name: string;
  /** Decimals it is written with: 2, or 0 for the yen. */
  decimals: 0 | 2;
  /** The cheapest a product may be, in the smallest unit. */
  minPrice: number;
  /** The dearest a product may be, in the smallest unit. */
  maxPrice: number;
  /**
   * The smallest single charge: an offer at checkout, one payment of a plan,
   * a one-click offer after paying. Stripe refuses a charge worth less than
   * about fifty US cents once it is converted, so each is set a little above
   * that.
   */
  minCharge: number;
};

/** The currencies a store can charge in, in the order the studio lists them. */
export const CURRENCIES: readonly CurrencyRule[] = [
  { code: "usd", name: "US dollar", decimals: 2, minPrice: 100, maxPrice: 500_000, minCharge: 50 },
  { code: "eur", name: "Euro", decimals: 2, minPrice: 100, maxPrice: 500_000, minCharge: 50 },
  { code: "gbp", name: "British pound", decimals: 2, minPrice: 100, maxPrice: 500_000, minCharge: 50 },
  { code: "cad", name: "Canadian dollar", decimals: 2, minPrice: 100, maxPrice: 700_000, minCharge: 100 },
  { code: "aud", name: "Australian dollar", decimals: 2, minPrice: 100, maxPrice: 800_000, minCharge: 100 },
  { code: "nzd", name: "New Zealand dollar", decimals: 2, minPrice: 100, maxPrice: 900_000, minCharge: 100 },
  { code: "chf", name: "Swiss franc", decimals: 2, minPrice: 100, maxPrice: 500_000, minCharge: 50 },
  { code: "sek", name: "Swedish krona", decimals: 2, minPrice: 1_000, maxPrice: 5_000_000, minCharge: 1_000 },
  { code: "nok", name: "Norwegian krone", decimals: 2, minPrice: 1_000, maxPrice: 5_000_000, minCharge: 1_000 },
  { code: "dkk", name: "Danish krone", decimals: 2, minPrice: 500, maxPrice: 3_500_000, minCharge: 500 },
  { code: "pln", name: "Polish zloty", decimals: 2, minPrice: 500, maxPrice: 2_000_000, minCharge: 300 },
  { code: "jpy", name: "Japanese yen", decimals: 0, minPrice: 100, maxPrice: 750_000, minCharge: 100 },
  { code: "sgd", name: "Singapore dollar", decimals: 2, minPrice: 100, maxPrice: 700_000, minCharge: 100 },
  { code: "hkd", name: "Hong Kong dollar", decimals: 2, minPrice: 1_000, maxPrice: 4_000_000, minCharge: 500 },
  { code: "mxn", name: "Mexican peso", decimals: 2, minPrice: 2_000, maxPrice: 10_000_000, minCharge: 1_000 },
];

/** What every store charged in before there was a choice, and still does unless changed. */
export const DEFAULT_CURRENCY: Currency = "usd";

const RULES = new Map<string, CurrencyRule>(CURRENCIES.map((rule) => [rule.code, rule]));

/**
 * Stripe's zero-decimal and three-decimal currencies, for writing an amount
 * Stripe reports in a currency that is not on the list above.
 */
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export function isCurrency(raw: unknown): raw is Currency {
  return typeof raw === "string" && RULES.has(raw);
}

/** Whatever came back from storage or a form: a listed currency, or the dollar. */
export function parseCurrency(raw: unknown): Currency {
  const code = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return isCurrency(code) ? code : DEFAULT_CURRENCY;
}

export function currencyRule(currency: Currency): CurrencyRule {
  return RULES.get(currency) ?? (RULES.get(DEFAULT_CURRENCY) as CurrencyRule);
}

/** How many decimals any ISO currency is written with, as Stripe counts them. */
export function decimalsOf(currency: string): number {
  const code = currency.toLowerCase();
  const rule = RULES.get(code);
  if (rule) return rule.decimals;
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

/** The smallest unit to the amount a person reads: 2750 cents is 27.5 dollars, 2750 yen is 2750. */
export function toMajor(amount: number, currency: string): number {
  return amount / 10 ** decimalsOf(currency);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(code: string, digits: number, whole: boolean): Intl.NumberFormat | null {
  const key = `${code}|${whole ? 0 : digits}`;
  let found = formatters.get(key);
  if (!found) {
    try {
      found = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        minimumFractionDigits: whole ? 0 : digits,
        maximumFractionDigits: digits,
      });
    } catch {
      return null;
    }
    formatters.set(key, found);
  }
  return found;
}

/**
 * An amount as a buyer reads it: "$27", "$27.50", "€9", "£1,200", "¥2,700",
 * "CA$15", "CHF 40". A round amount loses its ".00", the way prices are
 * written on a page; anything else keeps both decimals. The symbols are the
 * ones American English gives, which never leave two currencies looking the
 * same: a Canadian price reads "CA$", never a bare "$".
 */
export function formatMoney(amount: number, currency: string): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const digits = decimalsOf(code);
  const major = toMajor(amount, code);
  const whole = Number.isInteger(major);
  const found = formatter(code, digits, whole);
  if (found) return found.format(major);
  return `${major.toFixed(whole ? 0 : digits)} ${code}`;
}

/**
 * An amount as it is typed into a price field: "27", "27.50", "2700". No
 * sign and no thousands separator, so it reads back through readMoney to the
 * same number.
 */
export function moneyField(amount: number, currency: string): string {
  const digits = decimalsOf(currency);
  const text = toMajor(amount, currency).toFixed(digits);
  return digits > 0 ? text.replace(/\.0+$/, "") : text;
}

/** An amount for a spreadsheet: always every decimal, never a sign: "27.00", "2700". */
export function plainAmount(amount: number, currency: string): string {
  return toMajor(amount, currency).toFixed(decimalsOf(currency));
}

/**
 * Reads a typed price into the currency's smallest unit.
 *
 * Only a plain amount is accepted — 27, 27.5, 27.50, or 2700 for the yen —
 * with no currency sign, no thousands separator and no more decimals than the
 * currency has, because every one of those is a way for what the creator
 * meant and what the page charges to drift apart. Returns null when the text
 * is not one unambiguous amount.
 */
export function readMoney(raw: string, currency: Currency): number | null {
  const text = (raw ?? "").trim();
  const digits = currencyRule(currency).decimals;
  const shape = digits === 0 ? /^\d{1,9}$/ : /^\d{1,7}(\.\d{1,2})?$/;
  if (!shape.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 10 ** digits + (digits ? Number(fraction.padEnd(digits, "0")) : 0);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Whether a product may cost this much in this currency (zero, for free, is checked apart). */
export function priceInRange(amount: number, currency: Currency): boolean {
  const rule = currencyRule(currency);
  return Number.isInteger(amount) && amount >= rule.minPrice && amount <= rule.maxPrice;
}

/** "between 1 and 5,000", "between 100 and 750,000", as a price field's hint says it. */
export function rangeWords(currency: Currency): string {
  const rule = currencyRule(currency);
  const plain = (amount: number) => toMajor(amount, currency).toLocaleString("en-US", { maximumFractionDigits: rule.decimals });
  return `between ${plain(rule.minPrice)} and ${plain(rule.maxPrice)}`;
}

/**
 * What sits before a price field: "USD $", "EUR €", "JPY ¥", "CHF". The code
 * says which currency; the narrow symbol, where there is one, is what a
 * buyer will see beside it.
 */
export function fieldPrefix(currency: string): string {
  const code = currency.toUpperCase();
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(1);
    const symbol = parts.find((part) => part.type === "currency")?.value ?? "";
    return symbol && symbol !== code ? `${code} ${symbol}` : code;
  } catch {
    return code;
  }
}

/** "US dollar (USD)", for a list to choose from. */
export function currencyLabel(currency: Currency): string {
  return `${currencyRule(currency).name} (${currency.toUpperCase()})`;
}

/** A price to show as an example in a hint: "27 or 27.50", or "2700" for the yen. */
export function priceExample(currency: Currency, whole = 27): string {
  if (currencyRule(currency).decimals === 0) return String(whole * 100);
  return `${whole} or ${whole}.50`;
}

/** The cheapest and the dearest a product may be in this currency, in its smallest unit. */
export function priceBounds(currency: Currency): { min: number; max: number } {
  const rule = currencyRule(currency);
  return { min: rule.minPrice, max: rule.maxPrice };
}
