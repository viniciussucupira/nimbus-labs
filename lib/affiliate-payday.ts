/**
 * The email a creator gets on the day they said they pay their affiliates.
 *
 * The promise a creator makes on their affiliate page — "paid on the 5th of
 * each month" — is only worth what it is kept at, and the way a promise like
 * that gets broken is never bad faith. It is a person with a store to run
 * forgetting which day it is. So Nimbus keeps the date instead: on the morning
 * of that day, if anybody is owed something that has cleared, the creator gets
 * one message saying how much and to how many, with the link that opens the
 * batch.
 *
 * Nothing here moves money, and nothing here can. It reads the book, counts
 * what is payable, and writes an email. The creator still downloads the file
 * and pays it from their own account, which is the whole architecture and does
 * not bend for convenience.
 *
 * Sent once per store per month: the day's key is claimed in Redis before the
 * message goes out, so a second run of the job on the same day — a retry, an
 * overlap, a store seen twice while it moves between addresses — finds the day
 * taken and does nothing.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import { storesAfter, type Store } from "@/lib/store";
import { affiliatesOn, readBook } from "@/lib/affiliates";
import { owedLines, batchTotal } from "@/lib/affiliate-payouts";
import { ordinal } from "@/lib/affiliate-setting";
import { formatMoney } from "@/lib/money";

/** How long the mark on a month lasts: long enough that next month is a new one. */
const CLAIM_SECONDS = 40 * 86_400;
/** A ceiling on one run, so a job that is behind still ends. */
const MAX_STEPS = 10_000;

export type PaydayCounts = {
  /** Stores looked at. */
  seen: number;
  /** Stores whose payday is today and who had somebody to pay. */
  due: number;
  /** Emails that went out. */
  sent: number;
  failed: number;
  complete: boolean;
};

/** The month a claim is made for: "2026-10". */
function monthOf(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Claims this store's payday for this month. True the first time, false
 * every time after, which is what makes the job safe to run twice.
 */
async function claimMonth(statsId: string, month: string): Promise<boolean> {
  const [got] = await redisPipeline([["SET", `nl:aff:payday:${statsId}:${month}`, "1", "NX", "EX", CLAIM_SECONDS]]);
  return got !== null;
}

/** The message itself. Plain text, so every word is what arrives. */
export function paydayEmail(input: {
  storeName: string;
  payday: number;
  people: number;
  totalCents: number;
  currency: string;
  waitingCents: number;
  hold: number;
  refundsChecked: boolean;
}): { subject: string; text: string } {
  // What can be paid today, not what is owed in all: when a wait is set the
  // two differ, and a subject line that calls the smaller number "owed" tells
  // the creator something untrue about their own book.
  const amount = formatMoney(input.totalCents, input.currency);
  const who = `${input.people} ${input.people === 1 ? "affiliate" : "affiliates"}`;
  const studio = `${SITE_URL}/studio/affiliates`;
  const lines = [
    "Hello,",
    "",
    `Today is the ${ordinal(input.payday)}, the day you told your affiliates you pay them. ${who} can be paid ${amount}.`,
    "",
    "Open your affiliate page, download the batch, and upload it to your own PayPal or Wise. The money goes straight from your account to theirs — it never passes through us, so there is nothing to wait for once you have sent it:",
    studio,
    "",
    "When it has gone out, mark the batch as paid on that same page. Each affiliate then sees it on their own page, with the date and your reference.",
  ];
  if (input.waitingCents > 0) {
    lines.push(
      "",
      `A further ${formatMoney(input.waitingCents, input.currency)} is owed but still inside your ${input.hold}-day wait, so it is not in this batch. It joins the next one.`,
    );
  }
  if (!input.refundsChecked) {
    lines.push(
      "",
      "One thing first: we could not check every refund on your Stripe account just now, so these figures are not settled. Open the page and look before you pay — it will have checked again by then.",
    );
  }
  lines.push("", "— Nimbus Labs");
  return { subject: `${amount} to pay your affiliates today`, text: lines.join("\n") };
}

/** One store, if today is its payday and anybody is owed. True when sent. */
async function payday(store: Store, month: string, dayOfMonth: number): Promise<boolean> {
  if (!affiliatesOn(store) || store.affiliates.payday !== dayOfMonth) return false;
  if (!store.statsId || !store.email) return false;
  const book = await readBook(store);
  const lines = owedLines(book);
  // Nobody to pay is not a message worth sending, and it must not spend the
  // month's claim either: a sale that lands later today should still be able
  // to bring the email.
  if (lines.length === 0) return false;
  // Claimed last, so that whichever run gets here first is the only one that
  // sends. A second run reads the same book and stops here.
  if (!(await claimMonth(store.statsId, month))) return false;
  const { subject, text } = paydayEmail({
    storeName: store.name,
    payday: store.affiliates.payday,
    people: lines.length,
    totalCents: batchTotal(lines),
    currency: book.currency,
    waitingCents: book.rows.reduce((sum, row) => sum + row.waiting, 0),
    hold: store.affiliates.hold,
    refundsChecked: book.refundsChecked,
  });
  return sendEmail({
    from: NIMBUS_FROM,
    to: store.email,
    subject,
    text,
    idempotencyKey: `aff-payday-${store.statsId}-${month}`,
  });
}

/**
 * Every store, once, for whichever of them pays today. `deadline` is when the
 * run has to stop whatever it has reached; the next run starts again from the
 * beginning, and the month's claim keeps anybody already emailed from being
 * emailed twice.
 */
export async function sendPaydayEmails(deadline: number, now = new Date()): Promise<PaydayCounts> {
  const counts: PaydayCounts = { seen: 0, due: 0, sent: 0, failed: 0, complete: false };
  if (!isRedisConfigured() || !isSenderConfigured()) return counts;
  const month = monthOf(now);
  const dayOfMonth = now.getUTCDate();
  let cursor = "0";
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (Date.now() >= deadline) return counts;
    const { stores, next } = await storesAfter(cursor);
    for (const store of stores) {
      counts.seen += 1;
      if (store.affiliates.payday !== dayOfMonth) continue;
      counts.due += 1;
      try {
        if (await payday(store, month, dayOfMonth)) counts.sent += 1;
      } catch (error) {
        counts.failed += 1;
        console.error("sending an affiliate payday email failed", error);
      }
    }
    cursor = next;
    if (cursor === "0") break;
  }
  counts.complete = true;
  return counts;
}
