/**
 * Selling the same thing every month, on the creator's own account.
 *
 * A membership is a product that charges on a schedule instead of once. The
 * important part is where the schedule lives: the subscription is created on
 * the creator's own connected Stripe account, as a direct charge with no
 * application fee, exactly like a single sale. So the member is the creator's
 * customer, in the creator's own Stripe dashboard, with the creator's name on
 * the statement — and if the creator ever leaves here, the paying members go
 * with them, because they were never ours to keep.
 *
 * That is the whole difference from a platform that holds the balance. It is
 * also why this file is small: the hard part was already decided by making
 * every charge a direct charge.
 *
 * What is deliberately NOT here is a membership that ends itself after a set
 * number of payments. Stan offers that; we do not, yet, because it needs the
 * subscription to be scheduled to stop and this has not been built and proved.
 * A membership here runs until the member cancels, and the help page says so
 * in those words rather than leaving a creator to find out.
 */

/** The schedules Stripe bills on, and the ones a creator may choose. */
export const INTERVALS = ["day", "week", "month", "year"] as const;
export type Interval = (typeof INTERVALS)[number];

/** How a membership charges. It runs until somebody cancels it. */
export type Recurring = {
  interval: Interval;
};

export function isInterval(value: unknown): value is Interval {
  return (
    typeof value === "string" && (INTERVALS as readonly string[]).includes(value)
  );
}

/** Reads what the editor sent and returns a schedule, or nothing. */
export function readRecurring(rawInterval: string): Recurring | null {
  return isInterval(rawInterval) ? { interval: rawInterval } : null;
}

/** Whatever came back from storage, made safe to use. */
export function parseRecurring(raw: unknown): Recurring | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Recurring>;
  return isInterval(value.interval) ? { interval: value.interval } : null;
}

/** "a month", "a week" — how the price is read aloud on the page. */
export function everyLabel(interval: Interval): string {
  return { day: "a day", week: "a week", month: "a month", year: "a year" }[
    interval
  ];
}

/** "Monthly", for a sentence that needs a name rather than a phrase. */
export function intervalName(interval: Interval): string {
  return { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" }[
    interval
  ];
}
