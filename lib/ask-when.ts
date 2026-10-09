/**
 * When a reminder asked for on a product's page goes (added 9 October 2026;
 * lib/checkout-ask.ts): in about an hour, as after a checkout left unpaid,
 * tomorrow, or in three days. Browser-safe.
 */
export const ASK_WHENS = { hour: 60 * 60, day: 24 * 60 * 60, days: 3 * 24 * 60 * 60 } as const;
export type AskWhen = keyof typeof ASK_WHENS;

export function isAskWhen(value: unknown): value is AskWhen {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ASK_WHENS, value);
}
