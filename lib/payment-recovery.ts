/**
 * Telling a member, once, that their renewal did not go through — with a link
 * that actually recovers it.
 *
 * Nobody tells them otherwise. Stripe retries a failed card on its own
 * schedule, and it can email the member itself, but only if the creator has
 * found and switched on that setting in their own Stripe dashboard, which
 * most never do. So a member whose card expired is quietly retried against
 * the same dead card for two weeks and then cut off, never having been asked
 * for a new one. That is a member lost who never chose to leave.
 *
 * The link is the part that was easy to get wrong, and checked against
 * Stripe's own documentation before anything was written:
 *
 *   - Stripe retries a subscription on its OWN default card first, before the
 *     customer's. The portal's "update card" flow changes only the
 *     customer's. So a member who updated their card there would watch Stripe
 *     go on retrying the dead one — a fix that fixes nothing.
 *   - The invoice's own hosted page pays that very invoice, now, with
 *     whatever card is typed. It is Stripe's page and Stripe's checkout.
 *   - A subscription with `payment_settings.save_default_payment_method` set
 *     to `on_subscription` makes whatever card pays an invoice its new
 *     default, per Stripe's documentation. So that is set first.
 *
 * Together: the money that failed is paid, and the next renewal uses the card
 * that worked. Nothing depends on which default Checkout happened to set.
 *
 * Once per invoice. A member who does nothing is not written to again: Stripe
 * goes on with its own retries, and a second and third email about the same
 * payment reads as a debt collector, which is not what a creator wants to be
 * to the people who pay them.
 *
 * Checked in the daily job rather than as it happens, because this app
 * receives no events from Stripe — it asks, as every other sweep here does. A
 * member hears within a day of the failure, and nothing needs setting up in
 * anybody's Stripe dashboard for it to work.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount, platformKey } from "@/lib/stripe-account";
import { isSenderConfigured, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { fromStore, storeBase } from "@/lib/purchase-email";
import { readListings } from "@/lib/catalog";
import { type Store, saleHandles, storesAfter } from "@/lib/store";
import { sellsMemberships } from "@/lib/membership-manage";
import { LANGUAGES, type LanguageCode, parseLanguage } from "@/lib/store-language";
import { membershipWords } from "@/lib/buyer-words/membership";

const CURSOR_KEY = "nl:dun:cursor";
/** One invoice, one email, kept long past the 30 days its page stays open. */
const sentKey = (account: string, invoice: string) => `nl:dun:${account}:${invoice}`;
const SENT_SECONDS = 90 * 86_400;
/** At most this many failed renewals written about per store per run. */
const PER_STORE = 100;

const INVOICE_PATTERN = /^in_[A-Za-z0-9]{6,64}$/;
const SUB_PATTERN = /^sub_[A-Za-z0-9]{6,64}$/;

type Sub = {
  id?: unknown;
  status?: unknown;
  metadata?: Record<string, string> | null;
  customer?: { email?: unknown; deleted?: unknown } | string | null;
  latest_invoice?: {
    id?: unknown;
    status?: unknown;
    amount_due?: unknown;
    currency?: unknown;
    hosted_invoice_url?: unknown;
    next_payment_attempt?: unknown;
  } | string | null;
};

/** What the email says, and nothing else: pure, so it can be read before it is sent. */
export function failedPaymentEmail(input: {
  storeName: string;
  /** The product's name, or null when the store no longer has it. */
  title: string | null;
  amount: string;
  payUrl: string;
  manageUrl: string;
  isPlan: boolean;
  /**
   * When Stripe will next try the card on file, as the member should read it
   * ("October 3"), or null when no retry is scheduled. Taken from the invoice
   * itself, because whether Stripe retries at all is a setting on the
   * creator's own account: "it will be tried again" is only written when it
   * will be.
   */
  nextTry: string | null;
  /** The store's language (lib/store-language.ts); English when left out. */
  language?: LanguageCode;
}): { subject: string; text: string } {
  const m = membershipWords(input.language);
  // "for The Inner Circle" reads right whatever the product is called. The
  // first draft said "your The Inner Circle Membership membership" for one
  // title and "your your membership" for none.
  return {
    subject: m.failedSubject(input.storeName).slice(0, 200),
    text: [
      m.hi,
      "",
      input.title ? m.failedFor(input.amount, input.title) : m.failedTo(input.amount, input.storeName),
      "",
      m.payHere,
      input.payUrl,
      "",
      m.cardKept,
      "",
      input.nextTry
        ? input.isPlan
          ? m.triedAgainPlan(input.nextTry)
          : m.triedAgain(input.nextTry)
        : m.notTriedAgain,
      "",
      input.isPlan ? m.receiptsPlan(input.manageUrl) : m.cancelInstead(input.manageUrl),
      "",
      `— ${input.storeName}`,
    ].join("\n"),
  };
}

/** Whether a store can be asked about failed renewals at all. */
function worthAsking(store: Store): boolean {
  return Boolean(store.stripeAccountId) && sellsMemberships(store) && isSenderConfigured();
}

/**
 * One store's failed renewals, each written about once.
 *
 * A payment plan is included: an instalment that failed is money the buyer
 * agreed to, for something already handed over, and recovering it is as fair
 * as recovering a membership.
 */
async function sweepStore(store: Store, deadline: number): Promise<number> {
  const account = store.stripeAccountId as string;
  const handles = saleHandles(store);
  const query = new URLSearchParams({ status: "past_due", limit: String(PER_STORE) });
  query.append("expand[]", "data.latest_invoice");
  query.append("expand[]", "data.customer");
  const listed = (await onAccount("GET", account, `/subscriptions?${query}`)) as { data?: unknown };
  const subs = (Array.isArray(listed.data) ? listed.data : []) as Sub[];
  const mine = subs.filter((s) => handles.has(s.metadata?.store ?? ""));
  if (!mine.length) return 0;

  const ids = [...new Set(mine.map((s) => s.metadata?.product ?? "").filter(Boolean))];
  const titles = new Map((await readListings(store, ids).catch(() => [])).map((p) => [p.id, p.title]));
  let sent = 0;

  for (const sub of mine) {
    if (Date.now() >= deadline) break;
    const subId = typeof sub.id === "string" && SUB_PATTERN.test(sub.id) ? sub.id : "";
    const invoice = sub.latest_invoice && typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const invoiceId = typeof invoice?.id === "string" && INVOICE_PATTERN.test(invoice.id) ? invoice.id : "";
    const payUrl = typeof invoice?.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : "";
    const amount = typeof invoice?.amount_due === "number" ? invoice.amount_due : 0;
    const customer = sub.customer && typeof sub.customer === "object" ? sub.customer : null;
    const to = typeof customer?.email === "string" ? customer.email.trim() : "";
    // Only an invoice still open, with money on it, a page to pay it on and an
    // address to write to. Anything else is Stripe's to settle, not ours.
    if (!subId || !invoiceId || invoice?.status !== "open" || amount <= 0 || !payUrl.startsWith("https://") || !to) continue;

    // Claimed before anything is done, so a second run does not write twice.
    const [claimed] = await redisPipeline([["SET", sentKey(account, invoiceId), "1", "NX", "EX", SENT_SECONDS]]);
    if (claimed === null) continue;

    try {
      // First, so the card that pays becomes the one the next renewal uses.
      // Without this the email would get this payment in and leave the next
      // one to fail on the same dead card.
      await onAccount(
        "POST",
        account,
        `/subscriptions/${subId}`,
        new URLSearchParams({ "payment_settings[save_default_payment_method]": "on_subscription" }),
      );
      const isPlan = sub.metadata?.kind === "plan";
      const language = parseLanguage(store.language);
      const locale = LANGUAGES[language].locale;
      const next = typeof invoice?.next_payment_attempt === "number" && invoice.next_payment_attempt > 0 ? invoice.next_payment_attempt : 0;
      const mail = failedPaymentEmail({
        storeName: store.name,
        title: titles.get(sub.metadata?.product ?? "") || null,
        amount: formatMoney(amount, typeof invoice?.currency === "string" ? invoice.currency : store.currency, locale),
        payUrl,
        manageUrl: `${storeBase(store)}/manage`,
        isPlan,
        // A date the member reads in words. Without the store's time zone to
        // hand, the day is the one it falls on in UTC, which is never more
        // than a day out and never claims an hour.
        nextTry: next
          ? new Date(next * 1000).toLocaleDateString(locale, { month: "long", day: "numeric", timeZone: "UTC" })
          : null,
        language,
      });
      const ok = await sendEmail({
        from: fromStore(store),
        to,
        subject: mail.subject,
        text: mail.text,
        // A member with a question about their payment reaches the creator.
        replyTo: store.email,
        idempotencyKey: `nimbus-dun:${account}:${invoiceId}`,
      });
      if (ok) sent += 1;
      else await redisPipeline([["DEL", sentKey(account, invoiceId)]]);
    } catch (error) {
      // Let go, so the next run tries this one again rather than never.
      await redisPipeline([["DEL", sentKey(account, invoiceId)]]).catch(() => {});
      console.error("writing about a failed renewal failed", store.handle, error);
    }
  }
  return sent;
}

/**
 * Walks the stores that sell memberships until the deadline, remembering where
 * it stopped, exactly as the checkout sweep does (lib/checkout-sweep.ts).
 */
export async function recoverFailedPayments(deadline: number): Promise<{ stores: number; sent: number }> {
  const counts = { stores: 0, sent: 0 };
  if (!isRedisConfigured() || !platformKey() || !isSenderConfigured()) return counts;

  const [saved] = await redisPipeline([["GET", CURSOR_KEY]]);
  const [savedCursor, savedDone] = typeof saved === "string" ? saved.split("|") : ["0", "0"];
  let cursor = /^\d+$/.test(savedCursor ?? "") ? savedCursor : "0";
  let skip = Number(savedDone) || 0;

  while (Date.now() < deadline) {
    const { stores, next } = await storesAfter(cursor);
    let done = 0;
    for (const store of stores) {
      if (done < skip) {
        done += 1;
        continue;
      }
      if (Date.now() >= deadline) break;
      if (worthAsking(store)) {
        counts.stores += 1;
        try {
          counts.sent += await sweepStore(store, deadline);
        } catch (error) {
          console.error("reading a store's failed renewals failed", store.handle, error);
        }
      }
      done += 1;
    }
    if (done < stores.length) {
      await redisPipeline([["SET", CURSOR_KEY, `${cursor}|${done}`]]);
      return counts;
    }
    skip = 0;
    cursor = next;
    if (next === "0") break;
  }
  await redisPipeline([["SET", CURSOR_KEY, `${cursor}|0`]]);
  return counts;
}
