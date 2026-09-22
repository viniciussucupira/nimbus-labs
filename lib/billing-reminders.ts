/**
 * Emails sent to a creator before we charge them in a way they might not see
 * coming: the first charge after the free trial, and a yearly renewal.
 *
 * The card networks require the first (Visa: at least seven days before the
 * first charge after a trial, with a way to cancel), California requires the
 * second (15 to 45 days before a yearly plan renews), and both are simply how
 * a subscription should treat the person paying for it. Each is sent once per
 * charge, and says the date, the amount and the one click that stops it.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { listSubscriptions, periodEnd, planOf } from "@/lib/billing";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import { SUPPORT_EMAIL } from "@/lib/creator-research";
import { PLAN_NAMES, PLAN_PRICES, type Cycle, type Tier } from "@/lib/plan";

const DAY = 86_400;
/** Sent on the first daily run with at most this long left: seven to eight days. */
const TRIAL_NOTICE_SECONDS = 8 * DAY;
/** Sent on the first daily run with at most thirty days left, and never later than needed. */
const YEAR_NOTICE_SECONDS = 30 * DAY;
/** Too close to the charge to be of use: left alone. */
const TOO_LATE_SECONDS = DAY;
const MAX_PAGES = 50;

export type Reminder = {
  kind: "trial" | "renewal";
  subscription: string;
  email: string;
  /** When the charge happens, in seconds. */
  at: number;
  tier: Tier;
  cycle: Cycle;
  amountCents: number;
};

function day(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function money(cents: number): string {
  return `$${cents % 100 ? (cents / 100).toFixed(2) : cents / 100}`;
}

/** The email itself. Plain text, so every word is exactly what arrives. */
export function reminderEmail(reminder: Reminder): { subject: string; text: string } {
  const date = day(reminder.at);
  const name = PLAN_NAMES[reminder.tier];
  const price = money(reminder.amountCents);
  const studio = `${SITE_URL}/studio#billing`;
  if (reminder.kind === "trial") {
    const then =
      reminder.cycle === "year"
        ? `${price} for a year, and then ${price} every year`
        : `${price}, and then ${price} every month`;
    return {
      subject: `Your ${name} trial ends on ${date}`,
      text: [
        "Hello,",
        "",
        `Your free trial of ${name} ends on ${date}. On that day your card will be charged ${then}, until you cancel.`,
        "",
        "If you do not want to be charged, cancel before then in your studio. It is one click, with no email to us:",
        studio,
        "",
        "If you cancel, your card is never charged, and your store keeps taking payments until the trial ends.",
        "",
        `Questions: reply to this email, or write to ${SUPPORT_EMAIL}.`,
        "",
        "Nimbus Labs",
      ].join("\n"),
    };
  }
  const monthly = money(PLAN_PRICES[reminder.tier].month);
  return {
    subject: `Your ${name} subscription renews on ${date}`,
    text: [
      "Hello,",
      "",
      `Your yearly subscription to ${name} renews automatically on ${date}. Your card will be charged ${price} for another year, unless you cancel before then.`,
      "",
      `To cancel, or to switch to paying ${monthly} a month instead, open your studio. Cancelling is one click, with no email to us:`,
      studio,
      "",
      `If you cancel, nothing more is charged, and your store keeps taking payments until ${date}.`,
      "",
      `Questions: reply to this email, or write to ${SUPPORT_EMAIL}.`,
      "",
      "Nimbus Labs",
    ].join("\n"),
  };
}

/** Which reminder a subscription is due right now, if any. */
export function dueReminder(subscription: Record<string, unknown>, nowSeconds: number): Reminder | null {
  const id = typeof subscription.id === "string" ? subscription.id : "";
  if (!id) return null;
  // Set to stop: nothing more will be charged, so there is nothing to warn of.
  if (subscription.cancel_at_period_end === true) return null;
  if (typeof subscription.cancel_at === "number" && subscription.cancel_at > 0) return null;
  const customer = subscription.customer as { email?: unknown; deleted?: unknown } | string | null;
  const email = customer && typeof customer === "object" && typeof customer.email === "string" ? customer.email : "";
  if (!email) return null;

  const trialing = subscription.status === "trialing";
  const at = periodEnd(subscription, trialing);
  const left = at - nowSeconds;
  if (!at || left <= TOO_LATE_SECONDS) return null;
  const plan = planOf(subscription);
  if (!plan.amountCents) return null;

  if (trialing) {
    return left <= TRIAL_NOTICE_SECONDS
      ? { kind: "trial", subscription: id, email, at, ...plan }
      : null;
  }
  if (subscription.status === "active" && plan.cycle === "year" && left <= YEAR_NOTICE_SECONDS) {
    return { kind: "renewal", subscription: id, email, at, ...plan };
  }
  return null;
}

/**
 * Goes over every trial and every paying subscription and sends what is due.
 * Safe to run as often as it is called: each charge is warned of once.
 */
export async function sendReminders(nowSeconds = Math.floor(Date.now() / 1000)): Promise<{
  sent: number;
  failed: number;
  seen: number;
}> {
  const counts = { sent: 0, failed: 0, seen: 0 };
  if (!isRedisConfigured() || !isSenderConfigured()) return counts;

  for (const status of ["trialing", "active"] as const) {
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, hasMore } = await listSubscriptions(status, after);
      for (const subscription of data) {
        counts.seen += 1;
        const reminder = dueReminder(subscription, nowSeconds);
        if (!reminder) continue;
        const key = `nl:remind:${reminder.kind}:${reminder.subscription}:${reminder.at}`;
        const [claimed] = await redisPipeline([["SET", key, "1", "NX", "EX", 60 * DAY]]);
        if (claimed === null) continue;
        const { subject, text } = reminderEmail(reminder);
        const ok = await sendEmail({ from: NIMBUS_FROM, to: reminder.email, subject, text, replyTo: SUPPORT_EMAIL });
        if (ok) counts.sent += 1;
        else {
          counts.failed += 1;
          // Tried again on the next run rather than never.
          await redisPipeline([["DEL", key]]).catch(() => {});
        }
      }
      const last = data[data.length - 1];
      if (!hasMore || typeof last?.id !== "string") break;
      after = last.id;
    }
  }
  return counts;
}
