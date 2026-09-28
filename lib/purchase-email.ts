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
 *
 * A product that hands out licence keys has its key in the email too, given
 * to the sale here if the thanks page has not given it already
 * (lib/licence-keys.ts): the same key either way, because a sale only ever
 * gets one.
 *
 * An offer taken in one click after paying (lib/upsell.ts) is a payment of
 * its own, made after this email has usually gone, so it gets a short one of
 * its own (confirmOffer): what was added, what it cost, how to get it, and
 * its licence key when it hands one out — kept under the offer's payment,
 * the same reference the thanks page and the list of purchases use.
 */
import { saleHandles } from "@/lib/store";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { StripeError, onAccount } from "@/lib/stripe-account";
import { isSettled } from "@/lib/instant-pay";
import { canUseDomain } from "@/lib/domains";
import { canManage } from "@/lib/membership-manage";
import { everyLabel } from "@/lib/product-recurring";
import { DEMO_CONNECTED_ACCOUNT } from "@/lib/demo-store";
import { SITE_URL } from "@/lib/site-url";
import type { Listing, Store } from "@/lib/store";
import { listingsNamed, recordListings } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { type SaleKey, activeKeys, keyForSale } from "@/lib/licence-keys";
import { purchaseRefunded } from "@/lib/refunds";
import { scheduleReviewAsk } from "@/lib/review-ask";
import { bundleFromMeta, deliveredIds } from "@/lib/bundle-rules";

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
const INTENT_ID_PATTERN = /^pi_[A-Za-z0-9]{10,200}$/;

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
  currency?: unknown;
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

/** An amount in the currency it was charged in (lib/money.ts). */
function money(cents: number, currency: string): string {
  return formatMoney(cents, currency);
}

export type Confirmation = { to: string; subject: string; text: string };

/** A licence key the email carries, with the product it is for. */
export type KeyLine = { title: string; key: SaleKey };

/**
 * The email for one checkout, or null when this checkout is not one to
 * confirm: not settled, not this store's, a booked call, or too old.
 */
export function confirmationFor(
  store: Store,
  session: SessionRecord,
  nowSeconds = Date.now() / 1000,
  keys: KeyLine[] = [],
  /** The product and what was added, read by the caller; the store record's own when not given. */
  listings: Listing[] = recordListings(store),
): Confirmation | null {
  const id = typeof session.id === "string" ? session.id : "";
  if (!SESSION_ID_PATTERN.test(id)) return null;
  if (!isSettled(session)) return null;
  const meta = session.metadata ?? {};
  const handles = saleHandles(store);
  if (!handles.has(meta.store ?? "")) return null;
  if (meta.kind === "call") return null;
  const product = listings.find((p) => p.id === meta.product);
  if (!product || product.call) return null;
  const created = typeof session.created === "number" ? session.created : 0;
  if (nowSeconds - created > CONFIRM_WITHIN_SECONDS) return null;
  const typed = session.customer_details?.email;
  const email = typeof typed === "string" && typed ? typed : typeof session.customer_email === "string" ? session.customer_email : "";
  if (!email) return null;

  const option = product.options.find((entry) => entry.id === meta.option) ?? null;
  const bump = meta.bump ? listings.find((p) => p.id === meta.bump) ?? null : null;
  // What a bundle bought or ticked hands over, from the list on the order.
  const inside = (slot: "bundle" | "bump_bundle") =>
    bundleFromMeta(meta, slot)
      .map((pid) => listings.find((p) => p.id === pid))
      .filter((p): p is Listing => Boolean(p));
  const items = inside("bundle");
  const bumpItems = bump ? inside("bump_bundle") : [];
  const plan =
    meta.kind === "plan" && Number(meta.plan_payments) >= 2
      ? { payments: Number(meta.plan_payments), weekly: meta.plan_interval === "week" }
      : null;
  const amount = typeof session.amount_total === "number" ? session.amount_total : 0;
  // What Stripe charged it in; the store's own currency for a record that says none.
  const currency = typeof session.currency === "string" && session.currency ? session.currency : store.currency;
  const title = option ? `${product.title} (${option.label})` : product.title;
  const base = storeBase(store);
  const name = store.name;
  // A membership as it was bought: its free trial and its set number of
  // payments travel on the checkout (lib/store-checkout.ts), and are read the
  // way the thanks page reads them, so the email and the page say the same.
  const trialDays = product.recurring ? wholeNumber(meta.trial_days) : 0;
  const endsAfter = product.recurring ? wholeNumber(meta.ends_after) : 0;

  const paid = paidLine(product, amount, currency, plan, trialDays, endsAfter);
  const lines: string[] = [
    `Thank you for buying from ${name}. This is your confirmation.`,
    "",
    `What you bought: ${title}${bump ? `, with ${bump.title}` : ""}`,
    ...(items.length ? [`Inside ${product.title}: ${items.map((p) => p.title).join(", ")}`] : []),
    ...(bumpItems.length && bump ? [`Inside ${bump.title}: ${bumpItems.map((p) => p.title).join(", ")}`] : []),
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
      `If you pressed "Start the course" after paying, it opens straight away on that device. Anywhere else, the course page asks for your email: type ${email}, and a link that lets that device in usually arrives within a minute. There is no password to make.`,
    );
  } else {
    lines.push(
      `Open what you bought: ${base}/thanks?session_id=${id}`,
      "",
      `That page has your download or your link for the next 3 days. After that it is not lost: open ${base}/orders, type ${email}, and a link to everything you bought from ${name} is emailed to you, at any time.`,
    );
  }
  // A course inside a bundle opens on its own page, as one bought on its own does.
  const courses = [...items, ...bumpItems].filter((p) => p.course);
  for (const course of courses) {
    lines.push("", `Start ${course.title}: ${base}/course/${course.id}`);
  }
  if (courses.length) {
    lines.push("", `A course you started after paying opens straight away on that device. Anywhere else, its page asks for your email: type ${email}, and a link that lets that device in usually arrives within a minute.`);
  }

  for (const line of keys) {
    const label = keys.length > 1 ? `Your license key for ${line.title}` : "Your license key";
    lines.push(
      "",
      line.key.state === "issued"
        ? `${label}: ${line.key.key}`
        : `${label}: on its way. ${name}'s keys ran out just as you paid; it is emailed to you the moment they add more.`,
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
        `Nothing was charged today. Your first payment of ${money(firstCents, currency)}${tax} is taken when the ${trialDays}-day trial ends, on ${firstOn}, from the card you gave. Cancel before then and you are not charged at all.`,
      );
    }
    const schedule =
      endsAfter > 0
        ? `This renews once ${every} for ${endsAfter} payments in all and then ends by itself.`
        : `This renews once ${every} until you cancel it.`;
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
  product: Listing,
  amount: number,
  currency: string,
  plan: { payments: number; weekly: boolean } | null,
  trialDays: number,
  endsAfter: number,
): string {
  if (trialDays > 0 && amount === 0) return `${money(0, currency)} today. Your ${trialDays}-day free trial has started.`;
  if (amount === 0) return `${money(0, currency)}. A discount code covered the whole price.`;
  if (plan) return `${money(amount, currency)} today`;
  if (product.recurring) {
    const every = `${money(amount, currency)} ${everyLabel(product.recurring.interval)}`;
    return endsAfter > 0 ? `${every}, ${endsAfter} payments in all` : every;
  }
  return money(amount, currency);
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
  const listings = await listingsNamed(store, session.metadata);
  if (!confirmationFor(store, session, Date.now() / 1000, [], listings)) return "skip";
  const letter = confirmationFor(store, session, Date.now() / 1000, await keysFor(store, session, listings), listings);
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
  // A paid order confirmed while the store asks for reviews goes on the list
  // to be asked, once (lib/review-ask.ts). Nothing is asked of a trial that
  // charged nothing or of an order paid in full by a discount, and an offer
  // taken after paying is not asked about on its own: one email per order.
  if (sent && typeof session.amount_total === "number" && session.amount_total > 0) {
    const paidAt = typeof session.created === "number" ? session.created : Math.floor(Date.now() / 1000);
    await scheduleReviewAsk(store, sessionId, paidAt).catch((error) => console.error("putting an order on the review list failed", error));
  }
  return sent ? "sent" : "failed";
}

/** One offer taken in one click after paying, as Stripe charged it. */
export type TakenOffer = {
  /** The offer's own payment (pi_…): what its key and its stamped copy are kept under. */
  reference: string;
  /** The checkout it followed, whose thanks page delivers it. */
  parent: string;
  product: Listing;
  email: string;
  amountCents: number;
  /** What Stripe charged it in. */
  currency: string;
  /** When what was added is a bundle: the products it hands over. */
  items?: Listing[];
};

/** The email for an offer taken after paying, with its licence key when it has one. */
export function offerConfirmationFor(store: Store, offer: TakenOffer, key: SaleKey | null = null, keys: KeyLine[] = []): Confirmation | null {
  if (!INTENT_ID_PATTERN.test(offer.reference) || !SESSION_ID_PATTERN.test(offer.parent) || !offer.email) return null;
  const name = store.name;
  const base = storeBase(store);
  const lines: string[] = [
    `You added something to your order from ${name}. This is your confirmation.`,
    "",
    `What you added: ${offer.product.title}`,
    ...(offer.items?.length ? [`Inside it: ${offer.items.map((p) => p.title).join(", ")}`] : []),
    `Paid: ${money(offer.amountCents, offer.currency)}, charged once to the card you had just paid with`,
    `Reference: ${offer.reference}`,
    "",
    `Open it: ${base}/thanks?session_id=${offer.parent}`,
    "",
    `That page has it, beside what you bought first, for the next 3 days. After that it is not lost: open ${base}/orders, type ${offer.email}, and a link to everything you bought from ${name} is emailed to you, at any time.`,
  ];
  for (const line of [...(key ? [{ title: offer.product.title, key }] : []), ...keys]) {
    lines.push(
      "",
      line.key.state === "issued"
        ? `Your license key for ${line.title}: ${line.key.key}`
        : `Your license key for ${line.title}: on its way. ${name}'s keys ran out just as you paid; it is emailed to you the moment they add more.`,
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
    to: offer.email,
    subject: `Added to your order from ${name}: ${offer.product.title}`.slice(0, 200),
    text: lines.join("\n"),
  };
}

/**
 * Sends the confirmation for one offer taken after paying, once, whichever of
 * the offer's own answer and the thanks page settling it gets there first.
 * Its licence key is given here if nothing gave it yet: the same key the
 * thanks page and the list of purchases show, because a sale only gets one.
 */
export async function confirmOffer(store: Store, offer: TakenOffer): Promise<ConfirmOutcome> {
  if (!canConfirm(store) || !INTENT_ID_PATTERN.test(offer.reference) || !offer.email) return "skip";
  const mark = confirmationKey(offer.reference);
  const [seen] = await redisPipeline([["GET", mark]]);
  if (seen) return "already";
  let key: SaleKey | null = null;
  if (activeKeys(offer.product)) {
    try {
      key = await keyForSale(store, offer.product, offer.reference, offer.email);
    } catch (error) {
      // Left out rather than holding the email back: it is still on the
      // thanks page and on the buyer's list of purchases.
      console.error("reading a licence key for an offer's email failed", error);
    }
  }
  // Each product of a bundle added this way has its own key, under the offer's payment.
  const keys: KeyLine[] = [];
  for (const item of offer.items ?? []) {
    if (!activeKeys(item)) continue;
    try {
      const found = await keyForSale(store, item, offer.reference, offer.email);
      if (found) keys.push({ title: item.title, key: found });
    } catch (error) {
      console.error("reading a licence key for an offer's email failed", error);
    }
  }
  const letter = offerConfirmationFor(store, offer, key, keys);
  if (!letter) return "skip";
  const [claimed] = await redisPipeline([["SET", mark, "sending", "NX", "EX", SENDING_MARK_SECONDS]]);
  if (claimed === null) return "already";
  let sent = false;
  try {
    sent = await sendEmail({
      from: fromStore(store),
      to: letter.to,
      subject: letter.subject,
      text: letter.text,
      replyTo: store.email,
      idempotencyKey: `nimbus-confirm:${offer.reference}`,
    });
  } finally {
    await redisPipeline(sent ? [["SET", mark, "sent", "EX", SENT_MARK_SECONDS]] : [["DEL", mark]]);
  }
  return sent ? "sent" : "failed";
}

/**
 * The licence keys a paid checkout earns: the product's, and the one ticked
 * at checkout's. A key that cannot be read or given right now is left out
 * rather than holding the email back; it is still on the thanks page and on
 * the buyer's list of purchases.
 */
async function keysFor(store: Store, session: SessionRecord, listings: Listing[]): Promise<KeyLine[]> {
  const meta = session.metadata ?? {};
  const id = typeof session.id === "string" ? session.id : "";
  const typed = session.customer_details?.email;
  const email = typeof typed === "string" ? typed : "";
  // The product, the one ticked at checkout, and each product of a bundle.
  const products = deliveredIds(meta)
    .map((pid) => listings.find((p) => p.id === pid))
    .filter((p): p is Listing => Boolean(p && activeKeys(p)));
  const lines: KeyLine[] = [];
  for (const product of products) {
    try {
      const key = await keyForSale(store, product, id, email);
      if (key) lines.push({ title: product.title, key });
    } catch (error) {
      console.error("reading a licence key for an email failed", error);
    }
  }
  return lines;
}

export type ResendOutcome = "sent" | "unknown" | "call" | "refunded" | "failed";

/**
 * Sends a buyer their purchase email again, when the creator — or someone on
 * their team who answers buyers — asks from the studio's list of sales.
 *
 * The same email as the first, read afresh from the checkout on the
 * creator's own Stripe account, whatever its age, with one line on top saying
 * it is a copy sent at the store's request. The licence key in it is the one
 * the sale already has; a sale never gets a second. A checkout that is not
 * this store's, a booked call (which has its own confirmation) and a sale
 * refunded in full are refused rather than sent.
 */
export async function resendPurchase(store: Store, sessionId: string): Promise<ResendOutcome> {
  if (!canConfirm(store) || !SESSION_ID_PATTERN.test(sessionId)) return "unknown";
  let session: SessionRecord & { payment_intent?: unknown };
  try {
    session = (await onAccount(
      "GET",
      store.stripeAccountId as string,
      `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.latest_charge`,
    )) as SessionRecord & { payment_intent?: unknown };
  } catch (error) {
    if (error instanceof StripeError && error.status === 404) return "unknown";
    throw error;
  }
  if (session.id !== sessionId) return "unknown";
  if (session.metadata?.kind === "call") return "call";
  if (await purchaseRefunded(store.stripeAccountId, session)) return "refunded";
  const created = typeof session.created === "number" ? session.created : 0;
  // Read by id, so a sale of any product of a store of any size is found.
  const listings = await listingsNamed(store, session.metadata);
  const letter = confirmationFor(store, session, created, await keysFor(store, session, listings), listings);
  if (!letter) return "unknown";
  const sent = await sendEmail({
    from: fromStore(store),
    to: letter.to,
    subject: letter.subject,
    text: [`${senderName(store.name)} asked us to send you this again. It is a copy of your confirmation.`, "", letter.text].join("\n"),
    replyTo: store.email,
  });
  return sent ? "sent" : "failed";
}
