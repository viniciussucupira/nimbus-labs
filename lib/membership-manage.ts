/**
 * A member cancelling on their own.
 *
 * A membership is charged on the creator's own Stripe account, so the member
 * is the creator's customer, and until now the only way out was to write to
 * the creator and wait. That is the kind of cancellation people remember, and
 * not kindly. Here the member types the address they pay with, we email a
 * link to it, and the link opens Stripe's own page for their membership on
 * the creator's account: cancel, change the card, see the receipts.
 *
 * Three things are deliberate:
 *
 *   - It works whatever state the creator's own Nimbus subscription is in. A
 *     store that stops paying us stops selling; it never traps anybody in a
 *     charge they want to stop.
 *   - The page answers the same whether or not the address has a membership,
 *     so it cannot be used to find out who is a member of what.
 *   - Opening the email link never does anything. Mail scanners open links;
 *     only the button on the page it leads to asks Stripe for the portal.
 *
 * Cancelling ends the membership at the end of the period already paid for,
 * which is what the member has bought and is the fair default.
 */
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, normaliseEmail } from "@/lib/auth";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { StripeError, onAccount, platformKey } from "@/lib/stripe-account";
import type { Store } from "@/lib/store";

/** How long the emailed link keeps working. */
export const MANAGE_LINK_SECONDS = 60 * 60;

/** How many times one emailed link may open the portal. */
const MAX_OPENS = 10;

/** Requests from one connection to one store, and for one inbox, per hour. */
const IP_LIMIT = 10;
const ADDRESS_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60 * 60;

/** Subscription states in which the member can still be charged, or still has access. */
const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

export const MANAGE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]{6,64}$/;
const CONFIG_PATTERN = /^bpc_[A-Za-z0-9]{6,64}$/;

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const tokenKey = async (token: string) =>
  `nl:manage:link:${(await sha256Hex(`nimbus-manage:${token}`)).slice(0, 40)}`;
const opensKey = async (token: string) =>
  `nl:manage:opens:${(await sha256Hex(`nimbus-manage-opens:${token}`)).slice(0, 40)}`;
const ipKey = async (ip: string, handle: string) =>
  `nl:rl:manage:ip:${(await sha256Hex(`nimbus-manage-ip:${ip}:${handle}`)).slice(0, 32)}`;
const addressKey = async (email: string) =>
  `nl:rl:manage:addr:${(await sha256Hex(`nimbus-manage-addr:${email}`)).slice(0, 32)}`;
/** The portal set-up made on one connected account, reused for every member. */
const configKey = (account: string) => `nl:manage:portal:${account}`;

async function within(key: string, limit: number): Promise<boolean> {
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", RATE_WINDOW_SECONDS, "NX"],
    ["INCR", key],
  ]);
  return Number(count) <= limit;
}

/** Whether members of this store can be offered the way out. */
export function canManage(store: Store): boolean {
  return (
    Boolean(store.stripeAccountId) &&
    platformKey() !== null &&
    isRedisConfigured() &&
    isSenderConfigured()
  );
}

/** Whether this store sells anything that renews. */
export function sellsMemberships(store: Store): boolean {
  return store.products.some((product) => product.recurring !== null);
}

type Listed = { data?: unknown };

/**
 * The creator's customer behind an address, when that customer has a
 * membership of this store that is still running. Null otherwise.
 *
 * Asked of the creator's own Stripe account. A membership counts when it was
 * sold by this store under any address the store has used.
 */
export async function findMember(store: Store, email: string): Promise<string | null> {
  const account = store.stripeAccountId;
  if (!account) return null;
  const handles = new Set([store.handle, ...store.previousHandles]);

  const customers = (await onAccount(
    "GET",
    account,
    `/customers?email=${encodeURIComponent(email)}&limit=20`,
  )) as Listed;
  const list = Array.isArray(customers.data) ? (customers.data as { id?: unknown; created?: unknown }[]) : [];

  let best: { id: string; at: number } | null = null;
  for (const customer of list) {
    if (typeof customer.id !== "string" || !CUSTOMER_PATTERN.test(customer.id)) continue;
    const subs = (await onAccount(
      "GET",
      account,
      `/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=20`,
    )) as Listed;
    const rows = Array.isArray(subs.data)
      ? (subs.data as { status?: unknown; metadata?: Record<string, string> | null; created?: unknown }[])
      : [];
    for (const sub of rows) {
      if (typeof sub.status !== "string" || !LIVE.has(sub.status)) continue;
      if (!handles.has(sub.metadata?.store ?? "")) continue;
      // A payment plan is paying for something already delivered, not a
      // membership: it ends by itself and is not cancelled from here.
      if (sub.metadata?.kind === "plan") continue;
      const at = typeof sub.created === "number" ? sub.created : 0;
      if (!best || at > best.at) best = { id: customer.id, at };
    }
  }
  return best?.id ?? null;
}

/** A name that can sit inside the quotes of an email's From line. */
function displayName(name: string): string {
  return name.replace(/["\\<>\r\n]/g, "").trim().slice(0, 60) || "A store";
}

/** The address part of NIMBUS_FROM, whatever form it was written in. */
function senderAddress(): string {
  const match = NIMBUS_FROM.match(/<([^>]+)>/);
  return (match ? match[1] : NIMBUS_FROM).trim();
}

export type ManageRequest = "sent" | "email" | "limited" | "unavailable" | "error";

type Grant = {
  /** The connected account the membership is on. */
  a: string;
  /** The creator's customer who owns it. */
  c: string;
  /** The store's address when the link was asked for. */
  h: string;
};

/**
 * Emails a way in to the address typed, when it has a membership here.
 *
 * "sent" is returned whether or not a membership was found. The only person
 * who learns the difference is whoever reads that inbox.
 */
export async function requestManageLink(input: {
  store: Store;
  email: string;
  ip: string;
  origin: string;
}): Promise<ManageRequest> {
  const { store, ip, origin } = input;
  const raw = input.email.trim();
  if (!raw || raw.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(raw)) return "email";
  const email = normaliseEmail(raw);
  if (!canManage(store)) return "unavailable";

  if (!(await within(await ipKey(ip, store.handle), IP_LIMIT))) return "limited";
  if (!(await within(await addressKey(email), ADDRESS_LIMIT))) return "limited";

  const customer = await findMember(store, email);
  if (!customer) return "sent";

  const token = randomToken();
  const grant: Grant = { a: store.stripeAccountId as string, c: customer, h: store.handle };
  await redisPipeline([
    ["SET", await tokenKey(token), JSON.stringify(grant), "EX", MANAGE_LINK_SECONDS],
  ]);

  const name = store.name;
  const link = `${origin}/@${store.handle}/manage?token=${token}`;
  const sent = await sendEmail({
    from: `"${displayName(name)} via Nimbus Labs" <${senderAddress()}>`,
    to: email,
    subject: `Your membership with ${name}`,
    text: [
      `You asked to manage your membership with ${name}. Here is the way in:`,
      "",
      link,
      "",
      "Open the link and press the button. Stripe then shows your membership: you can cancel it, change the card it is paid with, or see your receipts. If you cancel, it stays on until the end of the period you have already paid for, and nothing more is charged.",
      "",
      "The link works for one hour. If you did not ask for this, ignore this email; nothing happens unless the link is used.",
      "",
      `Sent by Nimbus Labs on behalf of ${name}. The membership is charged by ${name} on their own Stripe account.`,
    ].join("\n"),
  });
  return sent ? "sent" : "error";
}

function parseGrant(raw: unknown): Grant | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Grant>;
    if (typeof value.a !== "string" || !/^acct_[A-Za-z0-9]{8,64}$/.test(value.a)) return null;
    if (typeof value.c !== "string" || !CUSTOMER_PATTERN.test(value.c)) return null;
    return { a: value.a, c: value.c, h: typeof value.h === "string" ? value.h : "" };
  } catch {
    return null;
  }
}

/** Whether an emailed link is still good, without spending it. For the page. */
export async function linkIsLive(token: string): Promise<boolean> {
  if (!MANAGE_TOKEN_PATTERN.test(token) || !isRedisConfigured()) return false;
  const [raw] = await redisPipeline([["GET", await tokenKey(token)]]);
  return parseGrant(raw) !== null;
}

/** The portal set-up on this account, made the first time a member needs it. */
async function portalConfiguration(store: Store, origin: string, fresh = false): Promise<string> {
  const account = store.stripeAccountId as string;
  if (!fresh) {
    const [cached] = await redisPipeline([["GET", configKey(account)]]);
    if (typeof cached === "string" && CONFIG_PATTERN.test(cached)) return cached;
  }

  const body = new URLSearchParams({
    "business_profile[headline]": `Your membership with ${displayName(store.name)}`.slice(0, 60),
    default_return_url: `${origin}/@${store.handle}`,
    "features[subscription_cancel][enabled]": "true",
    "features[subscription_cancel][mode]": "at_period_end",
    "features[subscription_cancel][cancellation_reason][enabled]": "true",
    "features[subscription_cancel][cancellation_reason][options][0]": "too_expensive",
    "features[subscription_cancel][cancellation_reason][options][1]": "unused",
    "features[subscription_cancel][cancellation_reason][options][2]": "missing_features",
    "features[subscription_cancel][cancellation_reason][options][3]": "switched_service",
    "features[subscription_cancel][cancellation_reason][options][4]": "other",
    "features[payment_method_update][enabled]": "true",
    "features[invoice_history][enabled]": "true",
    "metadata[made_by]": "nimbus-labs",
  });
  const made = await onAccount("POST", account, "/billing_portal/configurations", body);
  const id = typeof made.id === "string" ? made.id : "";
  if (!CONFIG_PATTERN.test(id)) throw new Error("Stripe returned no portal configuration");
  await redisPipeline([["SET", configKey(account), id]]);
  return id;
}

export type OpenResult = { ok: true; url: string } | { ok: false; reason: "expired" | "used" | "error" };

/**
 * Turns a live emailed link into a Stripe portal session and returns its URL.
 *
 * The link is checked against the store it is opened on: it only works on the
 * connected account it was issued for, so a link cannot be carried to another
 * store.
 */
export async function openPortal(store: Store, token: string, origin: string): Promise<OpenResult> {
  if (!MANAGE_TOKEN_PATTERN.test(token) || !isRedisConfigured()) return { ok: false, reason: "expired" };
  const [raw] = await redisPipeline([["GET", await tokenKey(token)]]);
  const grant = parseGrant(raw);
  if (!grant || grant.a !== store.stripeAccountId) return { ok: false, reason: "expired" };

  const key = await opensKey(token);
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", MANAGE_LINK_SECONDS, "NX"],
    ["INCR", key],
  ]);
  if (Number(count) > MAX_OPENS) return { ok: false, reason: "used" };

  const session = async (configuration: string) =>
    onAccount(
      "POST",
      grant.a,
      "/billing_portal/sessions",
      new URLSearchParams({
        customer: grant.c,
        configuration,
        return_url: `${origin}/@${store.handle}`,
      }),
    );

  try {
    let made: Record<string, unknown>;
    try {
      made = await session(await portalConfiguration(store, origin));
    } catch (error) {
      // The creator may have removed the set-up from their own dashboard.
      // Make it again, once, rather than leaving the member stuck.
      if (error instanceof StripeError && (error.status === 400 || error.status === 404)) {
        made = await session(await portalConfiguration(store, origin, true));
      } else {
        throw error;
      }
    }
    if (typeof made.url !== "string" || !made.url) return { ok: false, reason: "error" };
    return { ok: true, url: made.url };
  } catch (error) {
    console.error("opening the membership portal failed", error);
    return { ok: false, reason: "error" };
  }
}
