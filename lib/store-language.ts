/**
 * The language a store speaks to its buyers in: every word on its pages that
 * the creator did not write themselves — the buttons, the notes under them,
 * the reviews' labels, the payment page Stripe draws — and the way its
 * prices, dates and numbers are written.
 *
 * Measured before it was built (8 October 2026):
 *
 *   - Kajabi lets a site pick one of 16 languages, for the text it writes
 *     itself on checkout pages, the member area's settings and its alerts;
 *     one language a site, and a landing page for each further language
 *     (help.kajabi.com, "Change your site language");
 *   - Hotmart's payment page "speaks 9 languages", fitted to the buyer's by
 *     itself (hotmart.com, Internacionalização);
 *   - Stan's and Gumroad's help pages say nothing of a store in another
 *     language.
 *
 * Here the creator picks the language they write their products in, and the
 * whole store follows it, so a buyer never meets a page half in one language
 * and half in another. What the creator wrote is shown as they wrote it.
 *
 * Each language's words are written out in full, by hand
 * (lib/buyer-words/), never machine-translated on the fly: a button that
 * says the wrong thing costs a sale, and a wrong word about money is worse.
 * A language is added only with every word the buyer meets.
 *
 * Browser-safe.
 */

export const LANGUAGE_CODES = ["en", "es", "fr", "de", "it", "nl", "pt"] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export type LanguageInfo = {
  code: LanguageCode;
  /** The language's own name for itself, as a buyer who speaks it looks for it. */
  name: string;
  /** Its name in English, for the studio, which is in English. */
  english: string;
  /** How prices, dates and numbers are written (Intl). */
  locale: string;
  /** What Stripe's payment page is asked to speak (Checkout's `locale`). */
  stripe: string;
};

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  en: { code: "en", name: "English", english: "English", locale: "en-US", stripe: "en" },
  es: { code: "es", name: "Español", english: "Spanish", locale: "es-ES", stripe: "es" },
  fr: { code: "fr", name: "Français", english: "French", locale: "fr-FR", stripe: "fr" },
  de: { code: "de", name: "Deutsch", english: "German", locale: "de-DE", stripe: "de" },
  it: { code: "it", name: "Italiano", english: "Italian", locale: "it-IT", stripe: "it" },
  nl: { code: "nl", name: "Nederlands", english: "Dutch", locale: "nl-NL", stripe: "nl" },
  pt: { code: "pt", name: "Português", english: "Portuguese (Portugal)", locale: "pt-PT", stripe: "pt" },
};

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguage(raw: unknown): raw is LanguageCode {
  return typeof raw === "string" && (LANGUAGE_CODES as readonly string[]).includes(raw);
}

/** A stored or submitted language, or English for anything else. */
export function parseLanguage(raw: unknown): LanguageCode {
  return isLanguage(raw) ? raw : DEFAULT_LANGUAGE;
}

/**
 * How long is left before a moment, in the one unit a sentence says it in:
 * days from two days on, hours from two hours on, then one hour, then
 * minutes (at least one). Each language's words say it (lib/buyer-words/).
 */
export function timeLeft(ends: number, nowSeconds: number): { unit: "day" | "hour" | "minute"; n: number } {
  const left = Math.max(0, ends - nowSeconds);
  const days = Math.floor(left / 86_400);
  const hours = Math.floor(left / 3_600);
  if (days >= 2) return { unit: "day", n: days };
  if (hours >= 1) return { unit: "hour", n: hours };
  return { unit: "minute", n: Math.max(1, Math.ceil(left / 60)) };
}
