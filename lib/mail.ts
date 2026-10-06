/**
 * Email from a creator to their list: how it looks, who it is from, what it
 * must carry, and how much a store may send.
 *
 * Every email carries, whatever the creator writes:
 *   - who it is from, by the creator's own name, with replies going to them;
 *   - why the reader is getting it;
 *   - an unsubscribe link that works in one press, and the header that lets
 *     a mail app offer the same thing;
 *   - the creator's postal address, which the law in the United States asks
 *     of every commercial email.
 *
 * Only people who agreed are ever written to (lib/contacts.ts), and a month
 * has a published number of emails, counted before each batch goes out.
 */
import { NIMBUS_FROM, type BatchMessage, sendBatch, sendEmail, sentThisMonth } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { TRIAL_MONTHLY_EMAILS, canUse, monthlyEmails } from "@/lib/plan";
import { tokensFor } from "@/lib/contacts";
import { SITE_URL } from "@/lib/site-url";
import { SUPPORT_EMAIL } from "@/lib/creator-research";
import type { Store } from "@/lib/store";
import { type MailTag, taggedLink } from "@/lib/mail-links";
import { type Pause, healthId, healthTags, noteSent, pausedFor, rampBack, rampRoom } from "@/lib/mail-health";

export const MAX_SUBJECT = 150;
export const MAX_MAIL_BODY = 20_000;
/** How many go in one request to the sender. */
export const BATCH_SIZE = 100;
/**
 * How many go in one request when each person is first checked against the
 * creator's Stripe account (community announcements, live events'
 * reminders): a checked batch is the five-minute job's unit of work, and it
 * starts none after its mark (app/api/cron/mail), so a smaller one keeps a
 * run inside its sixty seconds — 25 checks, five at a time, is a few
 * seconds even when none is cached. The batch boundaries stay fixed, so a
 * batch tried again carries the same key and is never sent twice.
 */
export const CHECKED_BATCH_SIZE = 25;

/** The address marketing email is sent from; the name in front is the creator's. */
function marketingAddress(): string {
  const configured = process.env.MARKETING_FROM_EMAIL?.trim() || NIMBUS_FROM;
  const match = configured.match(/<([^>]+)>/);
  return (match ? match[1] : configured).trim();
}

function displayName(name: string): string {
  return name.replace(/["\\<>\r\n]/g, "").trim().slice(0, 60) || "A creator";
}

export function monthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
const usedKey = (listId: string, month = monthKey()) => `nl:mail:used:${listId}:${month}`;

/** Whether a store's pages may ask visitors to hear from the creator: Pro, and set up. */
export function canWrite(store: Store): boolean {
  return monthlyAllowance(store) > 0 && store.mail !== null && store.listId !== null;
}

/** What this store may send this month: 0 when it is not on Pro or above it. */
export function monthlyAllowance(store: Store, nowSeconds = Date.now() / 1000): number {
  if (!canUse(store, "email")) return 0;
  return store.trialEnds > nowSeconds ? TRIAL_MONTHLY_EMAILS : monthlyEmails(store.tier);
}

/** Whether the store is still in its free trial, when the smaller allowance applies. */
export function inTrial(store: Store, nowSeconds = Date.now() / 1000): boolean {
  return store.trialEnds > nowSeconds;
}

export async function usedThisMonth(listId: string | null): Promise<number> {
  if (!listId || !isRedisConfigured()) return 0;
  const [raw] = await redisPipeline([["GET", usedKey(listId)]]);
  return Number(raw) || 0;
}

/**
 * How many list emails the whole company may send in one UTC day.
 *
 * The sender is on its Pro plan (50,000 a month, no daily ceiling), so by
 * default there is no daily ceiling of ours either: 0 means none. If the
 * sender's plan ever has a daily ceiling again, shared with sign-in links and
 * receipts, MARKETING_DAILY_CAP keeps list email to a share of it, so those
 * always get through; a send that reaches it waits and continues the next day.
 */
const DEFAULT_DAILY_CAP = 0;
function dailyCap(): number {
  const raw = process.env.MARKETING_DAILY_CAP?.trim();
  if (!raw) return DEFAULT_DAILY_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_CAP;
}
const dayKey = (now = new Date()) => `nl:mail:day:${now.toISOString().slice(0, 10)}`;

/** How many more list emails the company may send today. */
async function dailyRoom(): Promise<number> {
  const cap = dailyCap();
  if (cap === 0) return Number.POSITIVE_INFINITY;
  const [used] = await redisPipeline([["GET", dayKey()]]);
  return Math.max(0, cap - (Number(used) || 0));
}

/**
 * The sender's own ceiling, and the part of it list email may use.
 *
 * The sender sells a number of emails a month and lets an account run over
 * it, charged by the thousand, up to five times that number. At five times
 * it pauses the whole account (resend.com/docs/knowledge-base/
 * account-quotas-and-limits, read October 6, 2026). The whole account is
 * every email this site sends: a creator's newsletter, and also the link
 * somebody logs in with and the email that hands a buyer their file. So a
 * few stores with large lists could, with nobody doing anything wrong, stop
 * every creator from logging in.
 *
 * List email is therefore held back at four fifths of that ceiling, counted
 * across every kind of email sent this month (lib/email.ts), and the last
 * fifth is left for the emails a store cannot run without. Held back, not
 * dropped: a send that meets the limit waits and goes on by itself when the
 * sender's plan is raised or the month turns.
 *
 * SENDER_MONTHLY_QUOTA is the number on the sender's plan, 50,000 on the one
 * this was written under; it is set on the host when that plan changes.
 */
const SENDER_PLAN_EMAILS = 50_000;
const SENDER_PAUSES_AT = 5;
const LIST_SHARE = 0.8;

export function senderQuota(): number {
  const n = Number(process.env.SENDER_MONTHLY_QUOTA?.trim());
  return Number.isFinite(n) && n >= 1_000 ? Math.floor(n) : SENDER_PLAN_EMAILS;
}

/** How many emails of every kind may have gone this month before list email waits. */
export function listCeiling(): number {
  return Math.floor(senderQuota() * SENDER_PAUSES_AT * LIST_SHARE);
}

/** How many more list emails the sender's ceiling leaves room for this month. */
export async function senderRoom(): Promise<number> {
  return Math.max(0, listCeiling() - (await sentThisMonth()));
}

const toldKey = (now = new Date()) => `nl:sender:${now.toISOString().slice(0, 7)}:told`;

/**
 * Says so, once a month, to the site's own inbox: raising the sender's plan
 * is a payment, and nobody but the owner can make one. Everything else about
 * the limit looks after itself.
 */
async function tellSenderIsFull(): Promise<void> {
  try {
    const [first] = await redisPipeline([["SET", toldKey(), "1", "NX", "EX", 40 * 86_400]]);
    if (first === null) return;
    const quota = senderQuota();
    await sendEmail({
      from: NIMBUS_FROM,
      to: SUPPORT_EMAIL,
      subject: "List email is waiting: the sender's monthly volume is nearly used",
      text: [
        `This month ${(await sentThisMonth()).toLocaleString("en-US")} emails have gone out, of every kind.`,
        `The sender's plan is ${quota.toLocaleString("en-US")} a month and it pauses the whole account at ${(quota * SENDER_PAUSES_AT).toLocaleString("en-US")}, so creators' list email now waits at ${listCeiling().toLocaleString("en-US")}.`,
        "",
        "Sign-in links, receipts and deliveries are still going out: the rest of the volume is kept for them.",
        "",
        "To let list email continue before the month turns: move the sender to a larger plan, then set SENDER_MONTHLY_QUOTA on the host to that plan's number of emails. Waiting emails go out by themselves after that.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("telling the inbox the sender is nearly full failed", error);
  }
}

/** Whether `n` more list emails fit under the sender's ceiling; says so once when they do not. */
async function senderTakes(n: number): Promise<boolean> {
  if ((await senderRoom()) >= n) return true;
  await tellSenderIsFull();
  return false;
}

export type Reserved = "ok" | "month" | "day" | "sender";

/**
 * Takes `n` from the company's day only (MARKETING_DAILY_CAP), for a bulk
 * notice that is not a creator's list email but goes out from the same
 * sender — the one email to buyers brought over from another platform
 * (lib/imports.ts). False, and nothing taken, when it would pass the cap.
 */
export async function reserveDay(n: number): Promise<boolean> {
  if (n <= 0) return true;
  // The sender's own ceiling comes first: nothing is taken from the day for
  // a send that cannot go at all this month.
  if (!(await senderTakes(n))) return false;
  const cap = dailyCap();
  if (cap === 0) return true;
  const day = dayKey();
  const [today] = await redisPipeline([
    ["INCRBY", day, n],
    ["EXPIRE", day, 3 * 86_400],
  ]);
  if (Number(today) <= cap) return true;
  await redisPipeline([["DECRBY", day, n]]);
  return false;
}

/** Gives back what reserveDay took, for a send that did not go out. */
export async function releaseDay(n: number): Promise<void> {
  if (dailyCap() === 0 || n <= 0) return;
  await redisPipeline([["DECRBY", dayKey(), n]]);
}

/** Takes `n` from the month (and the company's day), or nothing when that would pass either. */
export async function reserve(store: Store, n: number): Promise<Reserved> {
  if (n <= 0) return "ok";
  if (!store.listId) return "month";
  // Before anything is taken from the store's own month: the sender's
  // ceiling, which is everybody's (above).
  if (!(await senderTakes(n))) return "sender";
  const allowance = monthlyAllowance(store);
  const key = usedKey(store.listId);
  const cap = dailyCap();
  const day = dayKey();
  const [total, , today] = await redisPipeline([
    ["INCRBY", key, n],
    ["EXPIRE", key, 70 * 86_400],
    ["INCRBY", day, n],
    ["EXPIRE", day, 3 * 86_400],
  ]);
  const overMonth = Number(total) > allowance;
  const overDay = cap > 0 && Number(today) > cap;
  if (!overMonth && !overDay) return "ok";
  await redisPipeline([
    ["DECRBY", key, n],
    ["DECRBY", day, n],
  ]);
  return overMonth ? "month" : "day";
}

/** Gives back what was taken for a batch that was not sent. */
export async function release(store: Store, n: number): Promise<void> {
  if (store.listId && n > 0) {
    await redisPipeline([
      ["DECRBY", usedKey(store.listId), n],
      ["DECRBY", dayKey(), n],
    ]);
  }
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const URL_PATTERN = /(https:\/\/[^\s<>"')\]]+)/g;
const BULLET = /^[-•]\s+/;

/** The full stop or comma that ends a sentence, which the pattern above takes for part of the address. */
const TRAILING = /[.,;:!?]+$/;

/**
 * `goesTo` is where a link leads when that is not the address as written:
 * the same address with the email's tag on it (lib/mail-links.ts). The reader
 * always sees what the creator typed.
 */
function linked(text: string, goesTo?: (href: string) => string): string {
  return text
    .split(URL_PATTERN)
    .map((part, i) => {
      if (i % 2 === 0) return escape(part).replace(/\n/g, "<br>");
      // "…at https://example.com/plan." — the full stop belongs to the
      // sentence. Left inside the link it opened a page that is not there.
      const tail = part.match(TRAILING)?.[0] ?? "";
      const href = tail ? part.slice(0, -tail.length) : part;
      return `<a href="${escape(goesTo ? goesTo(href) : href)}" style="color:#4c1d95;text-decoration:underline">${escape(href)}</a>${escape(tail)}`;
    })
    .join("");
}

/** The creator's text as HTML: paragraphs, lists and links, nothing else. */
export function bodyHtml(body: string, goesTo?: (href: string) => string): string {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    let list: string[] = [];
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push(`<p style="margin:0 0 16px">${linked(para.join("\n"), goesTo)}</p>`);
      if (list.length) out.push(`<ul style="margin:0 0 16px;padding-left:22px">${list.map((l) => `<li style="margin:0 0 6px">${linked(l, goesTo)}</li>`).join("")}</ul>`);
      para = [];
      list = [];
    };
    for (const line of block.split("\n")) {
      if (BULLET.test(line)) {
        if (para.length) flush();
        list.push(line.replace(BULLET, ""));
      } else {
        if (list.length) flush();
        para.push(line);
      }
    }
    flush();
  }
  return out.join("");
}

export type Rendered = { subject: string; html: string; text: string; headers: Record<string, string> };

/**
 * The way out of an email that is not to the creator's list, such as the
 * announcements a community member asked for (lib/community-mail.ts): its
 * own page and one-click address, why the reader gets it, and what the link
 * stops.
 */
export type Door = { page: string; oneClick: string; why: string; label: string; after: string };

/** One email, for one reader, with everything it has to carry. */
export function render(store: Store, subject: string, body: string, token: string | null, door?: Door, tag?: MailTag): Rendered {
  const fromName = store.mail?.fromName || store.name;
  const address = store.mail?.address ?? "";
  const unsub = door ? door.page : token ? `${SITE_URL}/unsubscribe?t=${token}` : `${SITE_URL}/@${store.handle}`;
  const oneClick = door ? door.oneClick : token ? `${SITE_URL}/api/mail/unsubscribe?t=${token}` : "";
  const why = door ? door.why : `You are getting this because you told ${fromName} you wanted to hear from them.`;
  const label = door ? door.label : "Unsubscribe";
  const after = door ? door.after : `in one click, and ${fromName} will not email you again.`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5f0">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1c1917">
<div style="background:#ffffff;border-radius:16px;padding:28px 24px">${bodyHtml(body, tag ? (href) => taggedLink(href, store, tag) : undefined)}</div>
<div style="padding:20px 8px 0;font-size:13px;line-height:1.5;color:#57534e">
<p style="margin:0 0 8px">${escape(why)}</p>
<p style="margin:0 0 8px"><a href="${escape(unsub)}" style="color:#57534e;text-decoration:underline">${escape(label)}</a> ${escape(after)}</p>
${address ? `<p style="margin:0 0 8px">${escape(fromName)} · ${escape(address)}</p>` : ""}
<p style="margin:0">Sent with Marktmorgen.</p>
</div></div></body></html>`;
  const text = [
    body.trim(),
    "",
    "—",
    why,
    door ? `${door.label}: ${unsub}` : `Unsubscribe in one click: ${unsub}`,
    address ? `${fromName} · ${address}` : "",
    "Sent with Marktmorgen.",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
  const headers: Record<string, string> = oneClick
    ? { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : {};
  return { subject: subject.slice(0, MAX_SUBJECT), html, text, headers };
}

export function fromLine(store: Store): string {
  return `"${displayName(store.mail?.fromName || store.name)}" <${marketingAddress()}>`;
}

/**
 * The sender takes a few requests a second for the whole company, sign-in
 * links and receipts included. Marketing email keeps well under that, so
 * those always get through.
 */
const BATCH_GAP_MS = 1_500;
let lastBatchAt = 0;
async function paced(): Promise<void> {
  const wait = lastBatchAt + BATCH_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastBatchAt = Date.now();
}

export type SendOutcome = {
  /** Addresses the email went to. */
  done: string[];
  /** Addresses not tried, because the send stopped before them. */
  rest: string[];
  stopped: "allowance" | "day" | "sender" | "paused" | "portion" | "retry" | "refused" | null;
  /** Why and until when, for a send stopped as "paused" (lib/mail-health.ts). */
  pause?: Pause;
};

/** What a send that met the sender's ceiling says in the studio. */
export const SENDER_WAIT_NOTE =
  "Waiting on our side: the service that sends our email has reached its volume for the month. The rest go out by themselves as soon as that is raised, or when the month turns. Nothing is lost.";

/**
 * Sends one email to each address, in batches. Stops at the first batch the
 * month cannot cover, or the sender will not take; anyone who has left the
 * list since is skipped.
 */
export async function sendTo(
  store: Store,
  emails: string[],
  subject: string,
  body: string,
  keyBase: string,
  /** Which email this is, so a sale from one of its links can be counted for it (lib/mail-links.ts). */
  tag?: MailTag,
): Promise<SendOutcome> {
  const done: string[] = [];
  // A store whose addresses turned out to be bad ones waits its week out
  // (lib/mail-health.ts). Nothing is taken from its month for it.
  const watched = healthId(store);
  const pause = await pausedFor(watched);
  if (pause) return { done, rest: emails, stopped: "paused", pause };
  const tags = healthTags(store, true);
  for (let i = 0; i < emails.length; ) {
    const room = await dailyRoom();
    if (room <= 0) return { done, rest: emails.slice(i), stopped: "day" };
    // A list with addresses lately brought in goes out in portions that
    // double (lib/mail-health.ts); for any other store this is every one asked for.
    const portion = await rampRoom(watched, Math.min(BATCH_SIZE, room, emails.length - i));
    if (portion <= 0) return { done, rest: emails.slice(i), stopped: "portion" };
    const chunk = emails.slice(i, i + portion);
    const reserved = await reserve(store, chunk.length);
    if (reserved !== "ok") {
      await rampBack(watched, chunk.length);
      return { done, rest: emails.slice(i), stopped: reserved === "month" ? "allowance" : reserved };
    }
    const tokens = await tokensFor(store.listId as string, chunk, store.handle);
    const messages: BatchMessage[] = chunk
      .filter((email) => tokens.has(email))
      .map((email) => {
        const r = render(store, subject, body, tokens.get(email)!, undefined, tag);
        return { from: fromLine(store), to: email, subject: r.subject, text: r.text, html: r.html, replyTo: store.email, headers: r.headers, tags };
      });
    if (messages.length) await paced();
    const outcome = await sendBatch(messages, `${keyBase}:${i}:${chunk.length}`);
    if (outcome !== "sent") {
      await release(store, chunk.length);
      await rampBack(watched, chunk.length);
      return { done, rest: emails.slice(i), stopped: outcome };
    }
    if (messages.length < chunk.length) await release(store, chunk.length - messages.length);
    // What a bounce or a complaint is later measured against.
    await noteSent(watched, messages.length);
    for (const m of messages) done.push(m.to);
    i += chunk.length;
  }
  return { done, rest: [], stopped: null };
}
