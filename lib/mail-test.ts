/**
 * Two subject lines for one email, and the rest of the list getting the one
 * that did better. The rules, as the browser can read them too; the sending
 * is lib/broadcasts.ts.
 *
 * Read before it was built (6 October 2026): Kajabi's help center describes
 * testing two versions of a broadcast, the winner picked by open rate or
 * click rate, and Stan's describes opens and clicks for each email. An open
 * is counted by a tracking pixel in the email, and it is the number least
 * worth deciding by: Apple's Mail Privacy Protection loads an email's images
 * whether or not anybody reads it.
 *
 * This store promises there is no pixel and no tracked link in an email
 * (app/privacy), and this keeps the promise. The winner is decided by what a
 * subject line is for: how many of the people who got it came to the store,
 * or how many bought. Both are already counted without knowing who anybody
 * is. A link to the store carries its email's tag (lib/mail-links.ts); here
 * each subject line's share of the list carries its own, so a visit or a
 * sale says which subject it came from and nothing about who made it.
 *
 * How one goes:
 *
 *   1. The list is put in a random order the moment the send starts, so who
 *      gets which subject is chance and nothing else.
 *   2. A share of it gets the test: half subject A, half subject B.
 *   3. The rest wait a number of hours the creator chose.
 *   4. Then the rest get the subject that brought more per email sent. When
 *      neither did, they get the first — said in the studio, with the counts
 *      the decision was made on, so nobody takes a coin toss for a finding.
 */

/** What decides it: visits to the store, or sales. */
export type TestBy = "visits" | "sales";
export const TEST_BY: readonly TestBy[] = ["visits", "sales"];

/** The share of the list that gets the test, in percent. Half of it gets each subject. */
export const TEST_SHARES: readonly number[] = [20, 30, 50];
/** How long the rest wait before the better subject is chosen, in hours. */
export const TEST_HOURS: readonly number[] = [2, 4, 12, 24];
/**
 * The smallest list a test is run on. Under it, each subject would go to a
 * handful of people and the "winner" would be whoever happened to be at
 * their desk; everyone gets the first subject instead.
 */
export const MIN_TEST_REACH = 100;

export type Variant = "a" | "b";

export type SubjectTest = {
  subjectB: string;
  share: number;
  hours: number;
  by: TestBy;
  /** How many got each subject, once the list is written down. */
  a: number;
  b: number;
  /** When the rest go out, in seconds; 0 until the test's own emails have all gone. */
  endsAt: number;
  /** The subject the rest got; "" until it is decided. */
  winner: Variant | "";
  /**
   * What each subject had brought when it was decided, or null where that
   * could not be read. Kept so the studio can show what the choice was made
   * on, rather than only its result.
   */
  visits: { a: number; b: number } | null;
  sales: { a: number; b: number } | null;
  /** Why this one, in words for the studio. */
  why: string;
  /** The list was too small when the send started, so no test was run. */
  skipped: boolean;
};

const whole = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
const pair = (value: unknown): { a: number; b: number } | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return { a: whole(v.a), b: whole(v.b) };
};

/** A test as a creator asks for one: only the choices on offer, and a second subject that is one. */
export function newTest(raw: unknown, subject: string, maxSubject: number): SubjectTest | "none" | "subject" {
  if (!raw || typeof raw !== "object") return "none";
  const value = raw as Record<string, unknown>;
  const subjectB = typeof value.subjectB === "string" ? value.subjectB.replace(/\s+/g, " ").trim().slice(0, maxSubject) : "";
  // The same line twice is not a test, and "nothing" is not a subject.
  if (!subjectB || subjectB.toLowerCase() === subject.toLowerCase()) return "subject";
  return {
    subjectB,
    share: TEST_SHARES.includes(value.share as number) ? (value.share as number) : TEST_SHARES[0],
    hours: TEST_HOURS.includes(value.hours as number) ? (value.hours as number) : TEST_HOURS[1],
    by: TEST_BY.includes(value.by as TestBy) ? (value.by as TestBy) : "visits",
    a: 0,
    b: 0,
    endsAt: 0,
    winner: "",
    visits: null,
    sales: null,
    why: "",
    skipped: false,
  };
}

/** A test as it was saved. Anything that is not one reads as no test. */
export function parseTest(raw: unknown): SubjectTest | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.subjectB !== "string" || !value.subjectB) return null;
  return {
    subjectB: value.subjectB,
    share: TEST_SHARES.includes(value.share as number) ? (value.share as number) : TEST_SHARES[0],
    hours: TEST_HOURS.includes(value.hours as number) ? (value.hours as number) : TEST_HOURS[1],
    by: TEST_BY.includes(value.by as TestBy) ? (value.by as TestBy) : "visits",
    a: whole(value.a),
    b: whole(value.b),
    endsAt: whole(value.endsAt),
    winner: value.winner === "a" || value.winner === "b" ? value.winner : "",
    visits: pair(value.visits),
    sales: pair(value.sales),
    why: typeof value.why === "string" ? value.why.slice(0, 400) : "",
    skipped: value.skipped === true,
  };
}

/** How many of a list get each subject: the share, halved, the odd one to A. */
export function splitFor(total: number, share: number): { a: number; b: number } {
  const group = Math.min(total, Math.max(2, Math.round((total * share) / 100)));
  const b = Math.floor(group / 2);
  return { a: group - b, b };
}

/**
 * Which part of the list a position is in, and where that part ends. The list
 * is written down as: everyone who gets A, then everyone who gets B, then the
 * rest. A batch never crosses from one part into the next, so a batch tried
 * again is the same batch, under the same key.
 */
export function partAt(test: Pick<SubjectTest, "a" | "b">, sent: number, total: number): { part: Variant | "rest"; end: number } {
  if (sent < test.a) return { part: "a", end: test.a };
  if (sent < test.a + test.b) return { part: "b", end: test.a + test.b };
  return { part: "rest", end: total };
}

export type Counted = { a: number; b: number } | null;

const n = (x: number) => x.toLocaleString("en-US");
const times = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;

/**
 * Which subject the rest get.
 *
 * Compared per email sent, because an odd-sized test gives A one more
 * reader than B. By sales, a tie — nearly always nobody having bought yet —
 * is settled by visits rather than by the order the subjects were typed in.
 * When nothing separates them, or nothing could be read, the first subject
 * goes out and the reason says that it was not chosen on merit.
 */
export function chooseSubject(
  test: Pick<SubjectTest, "a" | "b" | "by">,
  visits: Counted,
  sales: Counted,
): { winner: Variant; why: string } {
  const better = (count: Counted): Variant | null => {
    if (!count || !test.a || !test.b) return null;
    const a = count.a / test.a;
    const b = count.b / test.b;
    return a === b ? null : a > b ? "a" : "b";
  };
  const name = (v: Variant) => (v === "a" ? "The first subject" : "The second subject");
  const visitWords = (v: Variant) =>
    visits ? `${times(visits[v], "visit", "visits")} to your store from ${times(test[v], "email", "emails")}, against ${n(visits[v === "a" ? "b" : "a"])} from ${n(test[v === "a" ? "b" : "a"])}` : "";
  const saleWords = (v: Variant) =>
    sales ? `${times(sales[v], "sale", "sales")} from ${times(test[v], "email", "emails")}, against ${n(sales[v === "a" ? "b" : "a"])} from ${n(test[v === "a" ? "b" : "a"])}` : "";

  if (test.by === "sales") {
    const bySales = better(sales);
    if (bySales) return { winner: bySales, why: `${name(bySales)} brought ${saleWords(bySales)}, so the rest got it.` };
    const byVisits = better(visits);
    if (byVisits) {
      return {
        winner: byVisits,
        why: `${sales ? "Neither subject had sold more when the time was up" : "Sales could not be read when the time was up"}, so visits decided: ${name(byVisits).toLowerCase()} brought ${visitWords(byVisits)}. The rest got it.`,
      };
    }
  } else {
    const byVisits = better(visits);
    if (byVisits) return { winner: byVisits, why: `${name(byVisits)} brought ${visitWords(byVisits)}, so the rest got it.` };
  }
  if (!visits && (test.by === "visits" || !sales)) {
    return { winner: "a", why: "The counts could not be read when the time was up, so the rest got the first subject. It was not chosen on merit." };
  }
  return { winner: "a", why: "Neither subject did better than the other in the time you gave it, so the rest got the first one. It was not chosen on merit." };
}
