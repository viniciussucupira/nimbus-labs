/**
 * The store's own questions and answers (added 9 October 2026): what a
 * visitor asks before buying anything here — how the files arrive, how to
 * pay, how to reach the creator — answered once, on the store page, in the
 * creator's words, and given to search engines as an FAQ. Each product's
 * page has its own questions; these are for the whole store.
 *
 * Kept on the store's record, so the page reads nothing more to show them.
 * Import-free, so the studio and the page use the same rules.
 */
export const MAX_FAQ = 12;
export const MAX_FAQ_Q = 150;
export const MAX_FAQ_A = 800;

export type FaqItem = { q: string; a: string };

const line = (text: unknown, max: number) => (typeof text === "string" ? text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const body = (text: unknown, max: number) =>
  typeof text === "string"
    ? text.replace(/\r\n/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
    : "";

/** A list as kept or as sent, made safe: both halves filled, at most MAX_FAQ. */
export function parseFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FaqItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const v = entry as Record<string, unknown>;
    const q = line(v.q, MAX_FAQ_Q);
    const a = body(v.a, MAX_FAQ_A);
    if (!q || !a) continue;
    out.push({ q, a });
    if (out.length >= MAX_FAQ) break;
  }
  return out;
}

/** The questions as search engines read an FAQ (schema.org FAQPage). */
export function faqData(items: FaqItem[]): object | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };
}
