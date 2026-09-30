/**
 * A creator's affiliates: people who send buyers to the store and earn a
 * share of what those buyers pay.
 *
 * The one rule this file is built around: Nimbus never holds, moves or pays
 * out any of this money. Every sale is paid to the creator's own Stripe
 * account, in full, like every other sale here. What is kept is the record —
 * who applied, who the creator let in, which sale came through whose link,
 * what that earns and what the creator says they have paid — and the creator
 * pays their affiliates themselves, however they like. The studio says so,
 * and so does every page an affiliate sees.
 *
 * How a sale is credited:
 *
 *   - an affiliate's link is the store's address with ?via=<code>. Following
 *     it leaves a first-party cookie on the store's own address (proxy.ts)
 *     holding the code and the time. The last link followed wins;
 *   - when the buyer opens a checkout within the store's window, and the code
 *     belongs to someone the creator approved, the affiliate and the share
 *     the product earns today travel with the charge in its metadata. Only
 *     one-off payments are credited: memberships and payment plans are not;
 *   - once Stripe says the checkout is settled, the sale is written down here
 *     with what was paid before tax, read from Stripe. The thanks page and
 *     the five-minute job both do this, so a buyer who never comes back is
 *     still counted, and each sale is written once;
 *   - what it earns is worked out when it is shown, against the refunds on
 *     the creator's Stripe account, so a refunded sale earns nothing and a
 *     partly refunded one earns on what was kept.
 *
 * What stops it being gamed:
 *
 *   - nobody earns on their own purchase: a sale paid with the affiliate's own
 *     address is written down as such and earns nothing, and a browser signed
 *     in as that affiliate is not credited at all;
 *   - the creator cannot be their own affiliate;
 *   - a click counts once per visitor per day, clicks from one connection are
 *     capped per hour, and the creator's own clicks and known robots are not
 *     counted;
 *   - applying needs the address to be real — the application only exists
 *     once its emailed link is opened — and is capped per hour, per
 *     connection and per address.
 *
 * Records, under the store's own stats id so they move with the store:
 *
 *   nl:aff:<id>:people   hash  affiliate id -> the affiliate
 *   nl:aff:<id>:emails   hash  address -> affiliate id
 *   nl:aff:<id>:codes    hash  code -> affiliate id
 *   nl:aff:<id>:clicks   hash  affiliate id -> clicks counted
 *   nl:aff:<id>:sales    hash  Stripe reference -> the sale
 *   nl:aff:<id>:payouts  hash  payout id -> what the creator says they paid
 */
import { saleHandles } from "@/lib/store";
import { createHash, randomBytes } from "node:crypto";
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, normaliseEmail } from "@/lib/auth";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount } from "@/lib/stripe-account";
import { isSettled } from "@/lib/instant-pay";
import { SITE_URL } from "@/lib/site-url";
import {
  AFFILIATE_CODE_PATTERN,
  MAX_AFFILIATES,
  commissionOn,
  commissionRate,
  readViaCookie,
} from "@/lib/affiliate-setting";
import type { Store } from "@/lib/store";
import { plainAmount } from "@/lib/money";
import { alertCreator } from "@/lib/phone-alerts";

/** How long the emailed link to apply or sign in keeps working. */
export const AFFILIATE_LINK_SECONDS = 24 * 60 * 60;
/** How long an affiliate stays signed in on one browser. */
export const AFFILIATE_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const AFFILIATE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
export const AFFILIATE_ID_PATTERN = /^[0-9a-f]{12}$/;
export const MAX_NOTE_LENGTH = 200;
export const MAX_REFERENCE_LENGTH = 80;
/** Applications from one connection to one store, and for one inbox, per hour. */
const APPLY_IP_LIMIT = 10;
const APPLY_ADDRESS_LIMIT = 5;
/** Clicks counted from one connection to one store per hour. */
const CLICK_IP_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60 * 60;
/** How many pages of a hundred refunds are read when the book is opened. */
const REFUND_PAGES = 10;

/** The cookie an affiliate's own browser is signed in with, one per store. */
export function affiliateCookieName(handle: string): string {
  return `nl_aff_${handle.replace(/[^a-z0-9._-]/g, "")}`;
}

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const peopleKey = (id: string) => `nl:aff:${id}:people`;
const emailsKey = (id: string) => `nl:aff:${id}:emails`;
const codesKey = (id: string) => `nl:aff:${id}:codes`;
const clicksKey = (id: string) => `nl:aff:${id}:clicks`;
const salesKey = (id: string) => `nl:aff:${id}:sales`;
const payoutsKey = (id: string) => `nl:aff:${id}:payouts`;
const linkKey = (token: string) => `nl:aff:link:${sha(`nimbus-aff-link:${token}`).slice(0, 40)}`;
const sessionKey = (token: string) => `nl:aff:session:${sha(`nimbus-aff-session:${token}`).slice(0, 40)}`;
const seenKey = (parts: string) => `nl:aff:seen:${sha(`nimbus-aff-seen:${parts}`).slice(0, 40)}`;
const clickIpKey = (ip: string, id: string) => `nl:rl:aff:click:${sha(`nimbus-aff-click:${ip}:${id}`).slice(0, 32)}`;
const applyIpKey = (ip: string, handle: string) => `nl:rl:aff:ip:${sha(`nimbus-aff-ip:${ip}:${handle}`).slice(0, 32)}`;
const applyAddressKey = (email: string) => `nl:rl:aff:addr:${sha(`nimbus-aff-addr:${email}`).slice(0, 32)}`;

export type AffiliateStatus = "pending" | "approved" | "declined" | "removed";

export type Affiliate = {
  id: string;
  email: string;
  /** What their link carries: ?via=<code>. */
  code: string;
  status: AffiliateStatus;
  /** When they applied, and when the creator last decided, in ms. */
  appliedAt: number;
  decidedAt: number;
  /** Where they said they would share the store, in their words. */
  note: string;
};

/** A sale that came through an affiliate's link. */
export type Referral = {
  /** The Checkout Session, or the one-click payment, that paid for it. */
  ref: string;
  /** The payment behind it, which is what a refund is made against. */
  pi: string;
  aff: string;
  /** When it was paid, in seconds. */
  at: number;
  product: string;
  title: string;
  /** What was paid before tax, in the currency's smallest unit: what the share is taken of. */
  base: number;
  /** What was paid in all, tax included, in the currency's smallest unit. */
  total: number;
  /**
   * What it was paid in, as Stripe says. Sales written down before stores
   * had a choice have none, and were in US dollars.
   */
  currency: string;
  /** The share it earns, in percent, as it was when the buyer paid. */
  rate: number;
  /** Paid with the affiliate's own address: written down, earns nothing. */
  self: boolean;
};

export type Payout = {
  id: string;
  aff: string;
  /** In the currency's smallest unit. */
  cents: number;
  /** The store's currency when it was written down; US dollars before there was a choice. */
  currency: string;
  /** The day the creator paid it, as they typed it: YYYY-MM-DD. */
  date: string;
  /** Their own note of it: a PayPal id, a bank reference, "cash". */
  reference: string;
  at: number;
};

/** Whether the programme is on and can keep its records. */
export function affiliatesOn(store: Store): boolean {
  return store.affiliates.enabled && Boolean(store.statsId) && isRedisConfigured();
}

/** Whether people can apply: the programme is on and its emails can be sent. */
export function canApply(store: Store): boolean {
  return affiliatesOn(store) && isSenderConfigured();
}

function parseAffiliate(raw: unknown): Affiliate | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<Affiliate>;
    if (typeof value.id !== "string" || !AFFILIATE_ID_PATTERN.test(value.id)) return null;
    if (typeof value.email !== "string" || typeof value.code !== "string") return null;
    const status: AffiliateStatus =
      value.status === "approved" || value.status === "declined" || value.status === "removed" ? value.status : "pending";
    return {
      id: value.id,
      email: value.email,
      code: value.code,
      status,
      appliedAt: typeof value.appliedAt === "number" ? value.appliedAt : 0,
      decidedAt: typeof value.decidedAt === "number" ? value.decidedAt : 0,
      note: typeof value.note === "string" ? value.note : "",
    };
  } catch {
    return null;
  }
}

function parseReferral(raw: unknown): Referral | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<Referral>;
    if (typeof value.ref !== "string" || typeof value.aff !== "string") return null;
    const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
    return {
      ref: value.ref,
      pi: typeof value.pi === "string" ? value.pi : "",
      aff: value.aff,
      at: n(value.at),
      product: typeof value.product === "string" ? value.product : "",
      title: typeof value.title === "string" ? value.title : "",
      base: n(value.base),
      total: n(value.total),
      currency: readCurrencyCode(value.currency),
      rate: n(value.rate),
      self: value.self === true,
    };
  } catch {
    return null;
  }
}

function parsePayout(raw: unknown): Payout | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<Payout>;
    if (typeof value.id !== "string" || typeof value.aff !== "string" || typeof value.cents !== "number") return null;
    return {
      id: value.id,
      aff: value.aff,
      cents: value.cents,
      currency: readCurrencyCode(value.currency),
      date: typeof value.date === "string" ? value.date : "",
      reference: typeof value.reference === "string" ? value.reference : "",
      at: typeof value.at === "number" ? value.at : 0,
    };
  } catch {
    return null;
  }
}

/** A three-letter currency code as Stripe writes it; US dollars when absent. */
function readCurrencyCode(raw: unknown): string {
  return typeof raw === "string" && /^[a-z]{3}$/.test(raw) ? raw : "usd";
}

/** A Redis hash reply, as pairs. */
function pairs(reply: unknown): [string, string][] {
  const list = Array.isArray(reply) ? reply.map(String) : [];
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < list.length; i += 2) out.push([list[i], list[i + 1]]);
  return out;
}

export async function listAffiliates(store: Store): Promise<Affiliate[]> {
  if (!store.statsId || !isRedisConfigured()) return [];
  const [reply] = await redisPipeline([["HGETALL", peopleKey(store.statsId)]]);
  return pairs(reply)
    .map(([, raw]) => parseAffiliate(raw))
    .filter((a): a is Affiliate => a !== null)
    .sort((a, b) => b.appliedAt - a.appliedAt);
}

export async function readAffiliate(store: Store, id: string): Promise<Affiliate | null> {
  if (!store.statsId || !isRedisConfigured() || !AFFILIATE_ID_PATTERN.test(id)) return null;
  const [raw] = await redisPipeline([["HGET", peopleKey(store.statsId), id]]);
  return parseAffiliate(raw);
}

async function writeAffiliate(store: Store, affiliate: Affiliate): Promise<void> {
  await redisPipeline([["HSET", peopleKey(store.statsId as string), affiliate.id, JSON.stringify(affiliate)]]);
}

async function within(key: string, limit: number): Promise<boolean> {
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", RATE_WINDOW_SECONDS, "NX"],
    ["INCR", key],
  ]);
  return Number(count) <= limit;
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


/** The address an affiliate shares: the store's own domain when it has one live. */
export function affiliateLink(store: Store, code: string): string {
  const base = store.domain?.liveAt ? `https://${store.domain.name}` : `${SITE_URL}/@${store.handle}`;
  return `${base}${store.domain?.liveAt ? "/" : ""}?via=${code}`;
}

// ---- Applying and signing in ---------------------------------------------

export type ApplyRequest = "sent" | "email" | "limited" | "unavailable" | "owner" | "error";

type LinkGrant = { s: string; e: string; n: string };

/**
 * Emails a link to the address typed. Opening it is what makes the
 * application — so every applicant has proved the address is theirs — and it
 * is also how a returning affiliate signs in to see their numbers.
 */
export async function requestAffiliateLink(input: {
  store: Store;
  email: string;
  note: string;
  ip: string;
  origin: string;
}): Promise<ApplyRequest> {
  const { store, ip, origin } = input;
  const raw = input.email.trim();
  if (!raw || raw.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(raw)) return "email";
  const email = normaliseEmail(raw);
  if (!canApply(store)) return "unavailable";
  if (email === normaliseEmail(store.email)) return "owner";
  if (!(await within(applyIpKey(ip, store.handle), APPLY_IP_LIMIT))) return "limited";
  if (!(await within(applyAddressKey(email), APPLY_ADDRESS_LIMIT))) return "limited";

  const [known] = await redisPipeline([["HGET", emailsKey(store.statsId as string), email]]);
  const token = randomBytes(32).toString("hex");
  const note = input.note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_LENGTH);
  const grant: LinkGrant = { s: store.statsId as string, e: email, n: note };
  await redisPipeline([["SET", linkKey(token), JSON.stringify(grant), "EX", AFFILIATE_LINK_SECONDS]]);

  const name = store.name;
  const link = `${origin}/@${store.handle}/affiliates?token=${token}`;
  const sent = await sendEmail({
    from: `"${displayName(name)} via Nimbus Labs" <${senderAddress()}>`,
    to: email,
    subject: typeof known === "string" ? `Your affiliate page for ${name}` : `Confirm your affiliate application to ${name}`,
    text: [
      typeof known === "string"
        ? `Here is the way in to your affiliate page for ${name}:`
        : `You asked to become an affiliate of ${name}. Open this link and press the button to send your application:`,
      "",
      link,
      "",
      typeof known === "string"
        ? "It shows your link, your clicks, your sales and what you have earned and been paid."
        : `${name} decides on each application. Once you are approved, your page gives you your own link, and a one-time purchase made through it within ${store.affiliates.days} ${store.affiliates.days === 1 ? "day" : "days"} of a click earns you a share.`,
      "",
      `Commissions are paid to you by ${name} directly, not by Nimbus Labs, which never holds the money.`,
      "",
      "The link works for 24 hours. If you did not ask for this, ignore this email; nothing happens unless the link is used.",
    ].join("\n"),
  });
  return sent ? "sent" : "error";
}

function parseGrant(raw: unknown): LinkGrant | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<LinkGrant>;
    if (typeof value.s !== "string" || typeof value.e !== "string") return null;
    return { s: value.s, e: value.e, n: typeof value.n === "string" ? value.n : "" };
  } catch {
    return null;
  }
}

/** The address an emailed link is for, while it still works. For the page. */
export async function linkEmail(store: Store, token: string): Promise<string | null> {
  if (!AFFILIATE_TOKEN_PATTERN.test(token) || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", linkKey(token)]]);
  const grant = parseGrant(raw);
  return grant && grant.s === store.statsId ? grant.e : null;
}

/** A readable code for a new affiliate, from their address, not yet taken here. */
async function claimCode(store: Store, email: string, id: string): Promise<string> {
  const stem = (email.split("@")[0] ?? "").replace(/[^a-z0-9]/g, "").slice(0, 14);
  const first = stem.length >= 3 ? stem : `${stem}aff`.slice(0, 14);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = attempt === 0 ? first : `${first}${Math.floor(10 + Math.random() * (attempt < 4 ? 90 : 9990))}`;
    if (!AFFILIATE_CODE_PATTERN.test(code)) continue;
    const [won] = await redisPipeline([["HSETNX", codesKey(store.statsId as string), code, id]]);
    if (Number(won) === 1) return code;
  }
  const code = randomBytes(5).toString("hex");
  await redisPipeline([["HSETNX", codesKey(store.statsId as string), code, id]]);
  return code;
}

export type OpenResult =
  | { ok: true; session: string; affiliate: Affiliate; created: boolean }
  | { ok: false; reason: "expired" | "full" | "unavailable" };

/**
 * The button on the page an emailed link opens. The first time for an
 * address, it makes the application; every time, it signs this browser in.
 */
export async function openAffiliateLink(store: Store, token: string): Promise<OpenResult> {
  if (!affiliatesOn(store)) return { ok: false, reason: "unavailable" };
  if (!AFFILIATE_TOKEN_PATTERN.test(token)) return { ok: false, reason: "expired" };
  const statsId = store.statsId as string;
  const [raw] = await redisPipeline([["GET", linkKey(token)]]);
  const grant = parseGrant(raw);
  if (!grant || grant.s !== statsId) return { ok: false, reason: "expired" };

  let affiliate: Affiliate | null = null;
  let created = false;
  const [knownId] = await redisPipeline([["HGET", emailsKey(statsId), grant.e]]);
  if (typeof knownId === "string") affiliate = await readAffiliate(store, knownId);
  if (!affiliate) {
    const [count] = await redisPipeline([["HLEN", peopleKey(statsId)]]);
    if (Number(count) >= MAX_AFFILIATES) return { ok: false, reason: "full" };
    const id = randomBytes(6).toString("hex");
    // One application per address, however many links are opened at once.
    const [won] = await redisPipeline([["HSETNX", emailsKey(statsId), grant.e, id]]);
    if (Number(won) !== 1) {
      const [other] = await redisPipeline([["HGET", emailsKey(statsId), grant.e]]);
      affiliate = typeof other === "string" ? await readAffiliate(store, other) : null;
      if (!affiliate) return { ok: false, reason: "expired" };
    } else {
      const code = await claimCode(store, grant.e, id);
      affiliate = { id, email: grant.e, code, status: "pending", appliedAt: Date.now(), decidedAt: 0, note: grant.n };
      await writeAffiliate(store, affiliate);
      created = true;
    }
  }

  const session = randomBytes(32).toString("hex");
  await redisPipeline([
    ["SET", sessionKey(session), JSON.stringify({ s: statsId, a: affiliate.id }), "EX", AFFILIATE_SESSION_SECONDS],
    // Spent: an emailed link signs in once.
    ["DEL", linkKey(token)],
  ]);

  if (created && isSenderConfigured()) {
    await sendEmail({
      from: `Nimbus Labs <${senderAddress()}>`,
      to: store.email,
      subject: `New affiliate application: ${affiliate.email}`,
      text: [
        `${affiliate.email} applied to be an affiliate of ${store.name}.`,
        ...(affiliate.note ? [`Where they will share it: ${affiliate.note}`] : []),
        "",
        `Approve or decline them in your studio: ${SITE_URL}/studio/affiliates${store.sid ? `?store=${store.sid}` : ""}`,
        "",
        "Nothing changes until you decide. Commissions are paid by you, directly, never by Nimbus Labs.",
      ].join("\n"),
    }).catch((error) => console.error("telling a creator about an application failed", error));
  }
  // And their phone, when a device of theirs asked for applications
  // (lib/phone-alerts.ts): no address on a lock screen, only that one came.
  if (created) {
    await alertCreator(
      store,
      "affiliate",
      { title: "New affiliate application", body: `Someone applied to promote ${store.name}. Approve or decline them in your studio.`, url: store.sid ? `/studio/affiliates?store=${store.sid}` : "/studio/affiliates" },
      { seed: affiliate.id },
    ).catch((error) => console.error("an application notification failed", error));
  }
  return { ok: true, session, affiliate, created };
}

/** The affiliate a browser is signed in as, on this store, or null. */
export async function affiliateForSession(store: Store, session: string | undefined): Promise<Affiliate | null> {
  if (!session || !AFFILIATE_TOKEN_PATTERN.test(session) || !store.statsId || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", sessionKey(session)]]);
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as { s?: unknown; a?: unknown };
    if (value.s !== store.statsId || typeof value.a !== "string") return null;
    return await readAffiliate(store, value.a);
  } catch {
    return null;
  }
}

export async function endAffiliateSession(session: string | undefined): Promise<void> {
  if (!session || !AFFILIATE_TOKEN_PATTERN.test(session) || !isRedisConfigured()) return;
  await redisPipeline([["DEL", sessionKey(session)]]);
}

// ---- The creator's decisions ---------------------------------------------

export type Decision = "approve" | "decline" | "remove" | "restore";

/** Lets someone in, turns them down, or takes them out. Their history stays. */
export async function decide(store: Store, id: string, decision: Decision): Promise<Affiliate | null> {
  const affiliate = await readAffiliate(store, id);
  if (!affiliate) return null;
  const status: AffiliateStatus =
    decision === "approve" || decision === "restore" ? "approved" : decision === "decline" ? "declined" : "removed";
  const next: Affiliate = { ...affiliate, status, decidedAt: Date.now() };
  await writeAffiliate(store, next);
  if (decision === "approve" && affiliate.status === "pending" && isSenderConfigured()) {
    await sendEmail({
      from: `"${displayName(store.name)} via Nimbus Labs" <${senderAddress()}>`,
      to: affiliate.email,
      subject: `You are an affiliate of ${store.name}`,
      text: [
        `${store.name} approved your application. Your link:`,
        "",
        affiliateLink(store, affiliate.code),
        "",
        `A one-time purchase made through it within ${store.affiliates.days} ${store.affiliates.days === 1 ? "day" : "days"} of a click earns you ${store.affiliates.percent}% of what the buyer paid before tax${Object.keys(store.affiliates.rates).length ? " (some products earn a different share; your page lists them)" : ""}. Memberships and payment plans do not earn, and a refunded sale earns nothing.`,
        "",
        `Your clicks, sales and earnings: ${SITE_URL}/@${store.handle}/affiliates`,
        "",
        `Commissions are paid to you by ${store.name} directly, not by Nimbus Labs, which never holds the money.`,
      ].join("\n"),
    }).catch((error) => console.error("telling an affiliate they were approved failed", error));
  }
  return next;
}

export async function addPayout(
  store: Store,
  input: { aff: string; cents: number; currency: string; date: string; reference: string },
): Promise<Payout | null> {
  if (!(await readAffiliate(store, input.aff))) return null;
  const payout: Payout = {
    id: randomBytes(6).toString("hex"),
    aff: input.aff,
    cents: input.cents,
    currency: input.currency,
    date: input.date,
    reference: input.reference.replace(/\s+/g, " ").trim().slice(0, MAX_REFERENCE_LENGTH),
    at: Date.now(),
  };
  await redisPipeline([["HSET", payoutsKey(store.statsId as string), payout.id, JSON.stringify(payout)]]);
  return payout;
}

export async function removePayout(store: Store, id: string): Promise<boolean> {
  if (!store.statsId || !/^[0-9a-f]{12}$/.test(id)) return false;
  const [removed] = await redisPipeline([["HDEL", payoutsKey(store.statsId), id]]);
  return Number(removed) === 1;
}

// ---- Clicks and the checkout ---------------------------------------------

/** The approved affiliate behind a code, or null. */
async function approvedByCode(store: Store, code: string): Promise<Affiliate | null> {
  if (!affiliatesOn(store) || !AFFILIATE_CODE_PATTERN.test(code)) return null;
  const [id] = await redisPipeline([["HGET", codesKey(store.statsId as string), code]]);
  if (typeof id !== "string") return null;
  const affiliate = await readAffiliate(store, id);
  return affiliate?.status === "approved" ? affiliate : null;
}

/**
 * Counts a click on an affiliate's link: once per visitor per day, a limited
 * number per connection per hour, and not from the affiliate's own browser.
 * The caller has already left out the creator and known robots.
 */
export async function recordClick(
  store: Store,
  code: string,
  visitor: { ip: string; userAgent: string; session: string | undefined },
): Promise<boolean> {
  const affiliate = await approvedByCode(store, code);
  if (!affiliate) return false;
  const own = await affiliateForSession(store, visitor.session);
  if (own?.id === affiliate.id) return false;
  const statsId = store.statsId as string;
  if (!(await within(clickIpKey(visitor.ip, statsId), CLICK_IP_LIMIT))) return false;
  const day = Math.floor(Date.now() / 86_400_000);
  const [fresh] = await redisPipeline([
    ["SET", seenKey(`${statsId}|${affiliate.id}|${visitor.ip}|${visitor.userAgent}|${day}`), "1", "NX", "EX", 2 * 86_400],
  ]);
  if (fresh === null) return false;
  await redisPipeline([["HINCRBY", clicksKey(statsId), affiliate.id, 1]]);
  return true;
}

/**
 * Who a checkout is credited to, read from the click cookie: an approved
 * affiliate, within the store's window — and never the browser of that
 * affiliate themselves.
 *
 * `rate` is this product's own share, and it may be 0. That is deliberate.
 * An order can hold more than this product: a bump rides in the same charge
 * and earns its own product's share. So whether the order earns anything at
 * all is not knowable here, only where the order is finally assembled, and
 * the guard belongs there — in lib/store-checkout.ts for a checkout, in
 * lib/calls.ts for a booking. Deciding it here voided the bump's commission
 * whenever the main product happened to be set to 0%, which is exactly the
 * case a creator uses to pay on the add-on and not on the front offer.
 */
export async function attributionFor(
  store: Store,
  productId: string,
  cookies: { via: string | undefined; session: string | undefined },
): Promise<{ aff: string; rate: number } | null> {
  if (!affiliatesOn(store)) return null;
  const click = readViaCookie(cookies.via);
  if (!click) return null;
  const now = Math.floor(Date.now() / 1000);
  if (click.at > now + 60 || now - click.at > store.affiliates.days * 86_400) return null;
  const affiliate = await approvedByCode(store, click.code);
  if (!affiliate) return null;
  const own = await affiliateForSession(store, cookies.session);
  if (own?.id === affiliate.id) return null;
  return { aff: affiliate.id, rate: commissionRate(store.affiliates, productId) };
}

/** The share an offer after paying earns the affiliate the order came through. */
export async function funnelRate(store: Store, affId: string, productId: string): Promise<number> {
  if (!affiliatesOn(store)) return 0;
  const affiliate = await readAffiliate(store, affId);
  if (affiliate?.status !== "approved") return 0;
  return commissionRate(store.affiliates, productId);
}

async function writeReferral(store: Store, referral: Referral): Promise<void> {
  if (!store.statsId || !isRedisConfigured()) return;
  // Once per sale, whichever of the thanks page and the five-minute job is first.
  await redisPipeline([["HSETNX", salesKey(store.statsId), referral.ref, JSON.stringify(referral)]]);
}

async function isSelf(store: Store, aff: string, buyer: string): Promise<boolean> {
  if (!buyer) return false;
  const affiliate = await readAffiliate(store, aff);
  return Boolean(affiliate) && normaliseEmail(affiliate!.email) === normaliseEmail(buyer);
}

type SessionLike = {
  id?: unknown;
  mode?: unknown;
  status?: unknown;
  payment_status?: unknown;
  created?: unknown;
  amount_total?: unknown;
  amount_subtotal?: unknown;
  currency?: unknown;
  total_details?: { amount_tax?: unknown } | null;
  payment_intent?: unknown;
  metadata?: Record<string, string> | null;
  customer_details?: { email?: unknown } | null;
};

/**
 * Writes down a settled checkout that came through an affiliate's link.
 * Anything else is left alone, so it is safe to call on every checkout.
 */
export async function noteSession(store: Store, session: SessionLike): Promise<void> {
  const meta = session.metadata ?? {};
  const aff = meta.via ?? "";
  if (!AFFILIATE_ID_PATTERN.test(aff) || typeof session.id !== "string") return;
  if (session.mode !== undefined && session.mode !== "payment") return;
  if (!isSettled(session)) return;
  const handles = saleHandles(store);
  if (!handles.has(meta.store ?? "")) return;
  const total = typeof session.amount_total === "number" ? session.amount_total : 0;
  const tax = typeof session.total_details?.amount_tax === "number" ? session.total_details.amount_tax : 0;
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && typeof session.payment_intent === "object" && typeof (session.payment_intent as { id?: unknown }).id === "string"
        ? ((session.payment_intent as { id: string }).id)
        : "";
  const buyer = typeof session.customer_details?.email === "string" ? session.customer_details.email : "";
  const base = Math.max(0, total - tax);
  let rate = Number(meta.via_rate) || 0;
  // A bump in the same order earns its own product's share, none when the
  // creator left that product out: the one rate kept for the sale is the
  // two shares together, over the whole of it.
  const bumpCents = Number(meta.bump_cents);
  const bumpRate = Number(meta.bump_rate);
  const subtotal = typeof session.amount_subtotal === "number" ? session.amount_subtotal : 0;
  if (meta.bump && Number.isFinite(bumpCents) && bumpCents > 0 && Number.isFinite(bumpRate) && subtotal > 0 && base > 0) {
    const bumpShare = Math.min(1, bumpCents / subtotal);
    rate = Math.round((rate * (1 - bumpShare) + bumpRate * bumpShare) * 100) / 100;
  }
  await writeReferral(store, {
    ref: session.id,
    pi,
    aff,
    at: typeof session.created === "number" ? session.created : Math.floor(Date.now() / 1000),
    product: meta.product ?? "",
    title: (meta.title ?? "").slice(0, 200),
    base,
    total,
    currency: readCurrencyCode(session.currency),
    rate,
    self: await isSelf(store, aff, buyer),
  });
}

/** Writes down a paid offer after paying that follows an affiliate's sale. */
export async function noteCharge(store: Store, pi: Record<string, unknown>): Promise<void> {
  const meta = (pi.metadata ?? {}) as Record<string, string>;
  const aff = meta.via ?? "";
  if (!AFFILIATE_ID_PATTERN.test(aff) || pi.status !== "succeeded" || typeof pi.id !== "string") return;
  const amount = typeof pi.amount === "number" ? pi.amount : 0;
  const buyer = typeof pi.receipt_email === "string" ? pi.receipt_email : "";
  await writeReferral(store, {
    ref: pi.id,
    pi: pi.id,
    aff,
    at: typeof pi.created === "number" ? pi.created : Math.floor(Date.now() / 1000),
    product: meta.product ?? "",
    title: `${(meta.title ?? "").slice(0, 180)} (added after paying)`,
    // A one-click charge never carries tax: the whole amount is the base.
    base: amount,
    total: amount,
    currency: readCurrencyCode(pi.currency),
    rate: Number(meta.via_rate) || 0,
    self: await isSelf(store, aff, buyer),
  });
}

// ---- The book ------------------------------------------------------------

export type LineStatus = "earned" | "partly refunded" | "refunded" | "own purchase";

export type Line = Referral & {
  /** Given back to the buyer, in cents, as Stripe says today. */
  refunded: number;
  /** What it earns now, in cents. */
  commission: number;
  status: LineStatus;
};

export type Row = {
  affiliate: Affiliate;
  clicks: number;
  /** Sales that still earn something. */
  sales: number;
  earned: number;
  paid: number;
  /** earned - paid; below zero when refunds came after a payout. */
  owed: number;
  /**
   * Of what is owed, the part still inside the creator's wait, and so not in
   * a batch yet. Never below zero. It is 0 for every store that set no wait,
   * which is what every store did before there was one.
   */
  waiting: number;
  /**
   * What can be paid today: owed less what is still waiting, floored at what
   * is owed so a payout made ahead of time is not counted twice. Below zero
   * when refunds landed after a payout, exactly as `owed` is.
   */
  payable: number;
};

export type Book = {
  rows: Row[];
  lines: Line[];
  payouts: Payout[];
  /**
   * What the rows' totals are in: the store's currency. Sales and payouts in
   * another one — from before the store changed its currency — are listed
   * with their own currency and left out of the totals, because adding euros
   * to dollars gives a number that means nothing.
   */
  currency: string;
  /** How many sales and payouts are in another currency, and so not in the totals. */
  elsewhere: number;
  /** False when Stripe could not be asked about refunds, or not all of them. */
  refundsChecked: boolean;
};

/**
 * What has been refunded, by payment, on the creator's account, from the
 * oldest sale on the book on. Pending refunds count: the creator already
 * gave the money back.
 */
async function refundsSince(store: Store, since: number): Promise<{ byIntent: Map<string, number>; complete: boolean }> {
  const byIntent = new Map<string, number>();
  if (!store.stripeAccountId) return { byIntent, complete: false };
  let after = "";
  for (let page = 0; page < REFUND_PAGES; page += 1) {
    const listed = await onAccount(
      "GET",
      store.stripeAccountId,
      `/refunds?limit=100&created[gte]=${since}${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`,
    );
    const rows = Array.isArray(listed.data) ? (listed.data as Record<string, unknown>[]) : [];
    for (const refund of rows) {
      if (refund.status !== "succeeded" && refund.status !== "pending") continue;
      const pi = typeof refund.payment_intent === "string" ? refund.payment_intent : "";
      const amount = typeof refund.amount === "number" ? refund.amount : 0;
      if (pi) byIntent.set(pi, (byIntent.get(pi) ?? 0) + amount);
    }
    const last = rows[rows.length - 1];
    if (listed.has_more !== true || !last || typeof last.id !== "string") return { byIntent, complete: true };
    after = last.id;
  }
  return { byIntent, complete: false };
}

/** A sale as it stands today, after any refund. */
export function settleLine(referral: Referral, refunded: number): Line {
  const back = Math.min(Math.max(0, refunded), referral.total);
  const kept = referral.total > 0 ? Math.round((referral.base * (referral.total - back)) / referral.total) : 0;
  const status: LineStatus = referral.self
    ? "own purchase"
    : back >= referral.total && referral.total > 0
      ? "refunded"
      : back > 0
        ? "partly refunded"
        : "earned";
  return { ...referral, refunded: back, commission: referral.self ? 0 : commissionOn(kept, referral.rate), status };
}

/**
 * Everything the studio shows about the programme — and, filtered to one
 * person, what an affiliate sees: their clicks, the sales through their link
 * with what each earns after refunds, and what the creator says they paid.
 */
export async function readBook(store: Store, only?: string): Promise<Book> {
  if (!store.statsId || !isRedisConfigured()) return { rows: [], lines: [], payouts: [], refundsChecked: true, currency: store.currency, elsewhere: 0 };
  const statsId = store.statsId;
  const [people, clicks, sales, payouts] = await redisPipeline([
    ["HGETALL", peopleKey(statsId)],
    ["HGETALL", clicksKey(statsId)],
    ["HGETALL", salesKey(statsId)],
    ["HGETALL", payoutsKey(statsId)],
  ]);
  const affiliates = pairs(people)
    .map(([, raw]) => parseAffiliate(raw))
    .filter((a): a is Affiliate => a !== null && (!only || a.id === only));
  const clickCount = new Map(pairs(clicks).map(([id, n]) => [id, Number(n) || 0]));
  const referrals = pairs(sales)
    .map(([, raw]) => parseReferral(raw))
    .filter((r): r is Referral => r !== null && (!only || r.aff === only));
  const paid = pairs(payouts)
    .map(([, raw]) => parsePayout(raw))
    .filter((p): p is Payout => p !== null && (!only || p.aff === only))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.at - a.at);

  let refunds = new Map<string, number>();
  let refundsChecked = true;
  if (referrals.length) {
    const since = Math.min(...referrals.map((r) => r.at));
    try {
      const read = await refundsSince(store, since);
      refunds = read.byIntent;
      refundsChecked = read.complete;
    } catch (error) {
      console.error("reading refunds for the affiliate book failed", error);
      refundsChecked = false;
    }
  }
  const lines = referrals.map((r) => settleLine(r, r.pi ? refunds.get(r.pi) ?? 0 : 0)).sort((a, b) => b.at - a.at);

  // A sale made less than the creator's wait ago is not payable yet, so their
  // refund window can pass before the money leaves them. `hold` is 0 for a
  // store that set none, and then `until` is now and nothing is ever waiting.
  const until = Math.floor(Date.now() / 1000) - store.affiliates.hold * 86_400;
  const rows = affiliates
    .map((affiliate): Row => {
      const own = lines.filter((l) => l.aff === affiliate.id && l.currency === store.currency);
      const earned = own.reduce((sum, l) => sum + l.commission, 0);
      const out = paid.filter((p) => p.aff === affiliate.id && p.currency === store.currency).reduce((sum, p) => sum + p.cents, 0);
      const waiting = own.filter((l) => l.at > until).reduce((sum, l) => sum + l.commission, 0);
      const owed = earned - out;
      return {
        affiliate,
        clicks: clickCount.get(affiliate.id) ?? 0,
        sales: own.filter((l) => l.commission > 0).length,
        earned,
        paid: out,
        owed,
        waiting,
        // What has cleared, less what has been paid — never more than is owed
        // in all, and never a negative number of its own making: a creator who
        // has already paid past what cleared simply has nothing to pay today.
        // Owing nothing, or being owed money back after a refund, is `owed`'s
        // to say, and is carried through unchanged.
        payable: owed <= 0 ? owed : Math.max(0, Math.min(owed, earned - waiting - out)),
      };
    })
    .sort((a, b) => b.owed - a.owed || b.affiliate.appliedAt - a.affiliate.appliedAt);
  const elsewhere =
    lines.filter((l) => l.currency !== store.currency).length + paid.filter((p) => p.currency !== store.currency).length;
  return { rows, lines, payouts: paid, refundsChecked, currency: store.currency, elsewhere };
}

const csvCell = (value: string | number) => {
  const text = String(value);
  // A cell a spreadsheet would read as a formula is written as text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The whole book as a spreadsheet: every sale and every payout, one per line. */
export function bookCsv(book: Book, all: Affiliate[]): string {
  const who = new Map(all.map((a) => [a.id, a]));
  const day = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);
  const header = [
    "type",
    "date",
    "affiliate_email",
    "affiliate_code",
    "reference",
    "product",
    "paid_before_tax",
    "refunded",
    "commission_rate_percent",
    "commission",
    "status",
    "payout",
    "payout_reference",
    "currency",
  ];
  const rows: (string | number)[][] = [
    ...book.lines.map((l) => [
      "sale",
      day(l.at),
      who.get(l.aff)?.email ?? "",
      who.get(l.aff)?.code ?? "",
      l.ref,
      l.title,
      plainAmount(l.base, l.currency),
      plainAmount(l.refunded, l.currency),
      l.rate,
      plainAmount(l.commission, l.currency),
      l.status,
      "",
      "",
      l.currency.toUpperCase(),
    ]),
    ...book.payouts.map((p) => [
      "payout",
      p.date,
      who.get(p.aff)?.email ?? "",
      who.get(p.aff)?.code ?? "",
      p.id,
      "",
      "",
      "",
      "",
      "",
      "paid by you",
      plainAmount(p.cents, p.currency),
      p.reference,
      p.currency.toUpperCase(),
    ]),
  ];
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
