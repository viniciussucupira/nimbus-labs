/**
 * The email a buyer gets after paying: what they bought, what it cost, and
 * how to get back to it.
 *
 * Stripe can send its own receipt from the creator's account, but only when
 * the creator switched that on in their Stripe settings, and it says nothing
 * about where the file is or how to open the course. So every paid checkout
 * on a creator's store gets this one, from the store's own name, once.
 *
 * Once is the whole difficulty. A buyer can land on the thanks page, refresh
 * it, open it again from their history, or never reach it at all because they
 * closed the tab while Stripe was redirecting. So the email is sent from both
 * places that learn about a payment — the thanks page, and a pass of the
 * five-minute job over each store's recent checkouts (lib/checkout-sweep.ts) —
 * and a key in Redis, taken before sending, decides which of them does it.
 * The sender is also handed an idempotency key, so a retry after a lost reply
 * cannot send it twice either.
 *
 * Nothing about the purchase is written down here beyond that key. What was
 * bought is read from the checkout on the creator's own Stripe account, which
 * is the record of it; the key only remembers that the email went out.
 *
 * Booked calls are left out: they have their own confirmation, with the time
 * and a calendar file, sent the moment the time is written down (lib/calls.ts).
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { StripeError, onAccount } from "@/lib/stripe-account";
import { isSettled } from "@/lib/instant-pay";
import { canUseDomain } from "@/lib/domains";
import { canManage } from "@/lib/membership-manage";
import { everyLabel } from "@/lib/product-recurring";
import { DEMO_CONNECTED_ACCOUNT } from "@/lib/demo-store";
import { SITE_URL } from "@/lib/site-url";
import { type Product, type Store, centsToPrice } from "@/lib/store";

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

/**
 * How old a paid checkout may be and still be confirmed. The five-minute job
 * reaches every store well inside a day; anything older was either confirmed
 * already or belongs to a time before this email existed, and a confirmation
 * a week late reads like a mistake.
 */
export const CONFIRM_WITHIN_SECONDS = 24 * 60 * 60;

/** How long the "sent" mark is kept: well past the window above. */
const SENT_MARK_SECONDS = 40 * 24 * 60 * 60;
/** How long a send in progress holds the mark before another may try. */
const SENDING_MARK_SECONDS = 15 * 60;

export const confirmationKey = (session: string) => `nl:confirm:${session}`;

/** A checkout as Stripe lists or returns it, with only the fields read here. */
export type SessionRecord = {
  id?: unknown;
  status?: unknown;
  payment_status?: unknown;
  mode?: unknown;
  created?: unknown;
  expires_at?: unknown;
  amount_total?: unknown;
  amount_subtotal?: unknown;
  customer_email?: unknown;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: unknown } | null;
  consent?: { promotions?: unknown } | null;
  after_expiration?: { recovery?: { enabled?: unknown } | null } | null;
};

/** A name that can sit inside the quotes of an email's From line. */
export function senderName(name: string): string {
  return name.replace(/["\\<>\r\n]/g, "").trim().slice(0, 60) || "A store";
}

function senderAddress(): string {
  const match = NIMBUS_FROM.match(/<([^>]+)>/);
  return (match ? match[1] : NIMBUS_FROM).trim();
}

/** The From line of an email a store sends its buyers: the store's own name. */
export function fromStore(store: Store): string {
  return `"${senderName(store.name)}" <${senderAddress()}>`;
}

/**
 * Where the store lives, for links in an email: the creator's own domain
 * while it is live and on Pro, otherwise its address here. A path under it is
 * one of the store's own pages (/orders, /manage, /course/…), which both
 * addresses answer to.
 */
export function storeBase(store: Store): string {
  if (store.domain?.liveAt && canUseDomain(store)) return `https://${store.domain.name}`;
  return `${SITE_URL}/@${store.handle}`;
}

/** Whether this store's buyers can be sent their confirmation at all. */
export function canConfirm(store: Store): boolean {
  return (
    isRedisConfigured() &&
    isSenderConfigured() &&
    Boolean(store.stripeAccountId) &&
    // The demo store sells from its own page, on its own account; a creator
    // store pointed at that same account still never writes to its buyers.
    store.stripeAccountId !== DEMO_CONNECTED_ACCOUNT &&
    store.handle !== "demo"
  );
}

function money(cents: number): string {
  return `$${centsToPrice(cents)}`;
}

export type Confirmation = { to: string; subject: string; text: string };

/**
 * The email for one checkout, or null when this checkout is not one to
 * confirm: not settled, not this store's, a booked call, or too old.
 */
export function confirmationFor(store: Store, session: SessionRecord, nowSeconds = Date.now() / 1000): Confirmation | null {
  const id = typeof session.id === "string" ? session.id : "";
  if (!SESSION_ID_PATTERN.test(id)) return null;
  if (!isSettled(session)) return null;
  const meta = session.metadata ?? {};
  const handles = new Set([store.handle, ...store.previousHandles]);
  if (!handles.has(meta.store ?? "")) return null;
  if (meta.kind === "call") return null;
  const product = store.products.find((p) => p.id === meta.product);
  if (!product || product.call) return null;
  const created = typeof session.created === "number" ? session.created : 0;
  if (nowSeconds - created > CONFIRM_WITHIN_SECONDS) return null;
  const typed = session.customer_details?.email;
  const email = typeof typed === "string" && typed ? typed : typeof session.customer_email === "string" ? session.customer_email : "";
  if (!email) return null;

  const option = product.options.find((entry) => entry.id === meta.option) ?? null;
  const bump = meta.bump ? store.products.find((p) => p.id === meta.bump) ?? null : null;
  const plan =
    meta.kind === "plan" && Number(meta.plan_payments) >= 2
      ? { payments: Number(meta.plan_payments), weekly: meta.plan_interval === "week" }
      : null;
  const amount = typeof session.amount_total === "number" ? session.amount_total : 0;
  const title = option ? `${product.title} (${option.label})` : product.title;
  const base = storeBase(store);
  const name = store.name;
  // A membership as it was bought: its free trial and its set number of
  // payments travel on the checkout (lib/store-checkout.ts), and are read the
  // way the thanks page reads them, so the email and the page say the same.
  const trialDays = product.recurring ? wholeNumber(meta.trial_days) : 0;
  const endsAfter = product.recurring ? wholeNumber(meta.ends_after) : 0;

  const paid = paidLine(product, amount, plan, trialDays, endsAfter);
  const lines: string[] = [
    `Thank you for buying from ${name}. This is your confirmation.`,
    "",
    `What you bought: ${title}${bump ? `, with ${bump.title}` : ""}`,
    `Paid: ${paid}`,
    `Order reference: ${id}`,
  ];

  if (plan) {
    lines.push(
      "",
      `This was the first of ${plan.payments} ${plan.weekly ? "weekly" : "monthly"} payments. The other ${plan.payments - 1} are charged to the same card on ${name}'s own Stripe account, and they stop by themselves after the last one.`,
    );
  }

  lines.push("");
  if (product.course) {
    lines.push(
      `Start the course: ${base}/course/${product.id}`,
      "",
      `On the device you paid with it opens straight away. On any other, the course page asks for your email: type ${email}, and a link that lets that device in arrives within a minute. There is no password to make.`,
    );
  } else {
    lines.push(
      `Open what you bought: ${base}/thanks?session_id=${id}`,
      "",
      `That page has your download or your link for the next 3 days. After that it is not lost: open ${base}/orders, type ${email}, and a link to everything you bought from ${name} is emailed to you, at any time.`,
    );
  }

  if (product.recurring) {
    const every = everyLabel(product.recurring.interval);
    if (trialDays > 0) {
      const firstCents = option ? option.priceCents : product.priceCents;
      const tax = store.tax.enabled && !store.tax.included ? " plus any sales tax" : "";
      const firstOn = new Date((created + trialDays * 86400) * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      lines.push(
        "",
        `Nothing was charged today. Your first payment of ${money(firstCents)}${tax} is taken when the ${trialDays}-day trial ends, on ${firstOn}, from the card you gave. Cancel before then and you are not charged at all.`,
      );
    }
    const schedule =
      endsAfter > 0
        ? `This renews ${every} for ${endsAfter} payments in all and then ends by itself.`
        : `This renews ${every} until you cancel it.`;
    lines.push(
      "",
      canManage(store)
        ? `${schedule} To manage or cancel it yourself${endsAfter > 0 ? " before that" : ""}, at any time and without writing to anyone, open ${base}/manage and type ${email}.`
        : `${schedule} To cancel${endsAfter > 0 ? " before that" : ""}, reply to this email and it reaches ${name}.`,
    );
  }

  lines.push(
    "",
    `${name}: ${base}`,
    "",
    `Questions about this order? Reply to this email and it reaches ${name}.`,
    `The payment went to ${name}, on their own Stripe account. Nimbus Labs sent this email for them.`,
  );

  return {
    to: email,
    subject: `Your order from ${name}: ${product.title}`.slice(0, 200),
    text: lines.join("\n"),
  };
}

/** A count carried in a checkout's metadata, or 0 when there is none. */
function wholeNumber(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function paidLine(
  product: Product,
  amount: number,
  plan: { payments: number; weekly: boolean } | null,
  trialDays: number,
  endsAfter: number,
): string {
  if (trialDays > 0 && amount === 0) return `$0 today. Your ${trialDays}-day free trial has started.`;
  if (amount === 0) return "$0. A discount code covered the whole price.";
  if (plan) return `${money(amount)} today`;
  if (product.recurring) {
    const every = `${money(amount)} ${everyLabel(product.recurring.interval)}`;
    return endsAfter > 0 ? `${every}, ${endsAfter} payments in all` : every;
  }
  return money(amount);
}

export type ConfirmOutcome = "sent" | "already" | "skip" | "failed";

/**
 * Sends the confirmation for one checkout, unless it has gone already.
 *
 * `known` is the checkout as the caller already has it from Stripe; without
 * it, it is asked for — but only after the mark says it is still owed, so a
 * thanks page opened ten times asks Stripe nothing after the first.
 */
export async function confirmPurchase(
  store: Store,
  sessionId: string,
  known?: SessionRecord,
): Promise<ConfirmOutcome> {
  if (!canConfirm(store) || !SESSION_ID_PATTERN.test(sessionId)) return "skip";
  const key = confirmationKey(sessionId);
  const [mark] = await redisPipeline([["GET", key]]);
  if (mark) return "already";

  let session = known;
  if (!session) {
    try {
      session = (await onAccount(
        "GET",
        store.stripeAccountId as string,
        `/checkout/sessions/${encodeURIComponent(sessionId)}`,
      )) as SessionRecord;
    } catch (error) {
      if (error instanceof StripeError && error.status === 404) return "skip";
      throw error;
    }
  }
  if (session.id !== sessionId) return "skip";
  const letter = confirmationFor(store, session);
  if (!letter) return "skip";

  const [claimed] = await redisPipeline([["SET", key, "sending", "NX", "EX", SENDING_MARK_SECONDS]]);
  if (claimed === null) return "already";

  let sent = false;
  try {
    sent = await sendEmail({
      from: fromStore(store),
      to: letter.to,
      subject: letter.subject,
      text: letter.text,
      replyTo: store.email,
      idempotencyKey: `nimbus-confirm:${sessionId}`,
    });
  } finally {
    // Sent: kept, so nobody sends it again. Not sent: let go, so the next
    // pass of the job, or the next open of the thanks page, tries again.
    await redisPipeline(sent ? [["SET", key, "sent", "EX", SENT_MARK_SECONDS]] : [["DEL", key]]);
  }
  return sent ? "sent" : "failed";
}
