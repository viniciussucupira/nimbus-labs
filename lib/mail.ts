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
import { NIMBUS_FROM, type BatchMessage, sendBatch } from "@/lib/email";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { PRO_MONTHLY_EMAILS, TRIAL_MONTHLY_EMAILS, canUse } from "@/lib/plan";
import { tokensFor } from "@/lib/contacts";
import { SITE_URL } from "@/lib/site-url";
import type { Store } from "@/lib/store";

export const MAX_SUBJECT = 150;
export const MAX_MAIL_BODY = 20_000;
/** How many go in one request to the sender. */
export const BATCH_SIZE = 100;

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

/** What this store may send this month: 0 when it is not on Pro. */
export function monthlyAllowance(store: Store, nowSeconds = Date.now() / 1000): number {
  if (!canUse(store, "email")) return 0;
  return store.trialEnds > nowSeconds ? TRIAL_MONTHLY_EMAILS : PRO_MONTHLY_EMAILS;
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
 * How many list emails the whole company sends in one UTC day.
 *
 * The sender's plan has a daily ceiling shared with sign-in links and
 * receipts, and those must always get through. Until the sender's plan is
 * raised, list email keeps to a small share of that ceiling; the number is
 * set in MARKETING_DAILY_CAP, and 0 there means no daily ceiling of ours.
 */
const DEFAULT_DAILY_CAP = 50;
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

export type Reserved = "ok" | "month" | "day";

/** Takes `n` from the month (and the company's day), or nothing when that would pass either. */
export async function reserve(store: Store, n: number): Promise<Reserved> {
  if (n <= 0) return "ok";
  if (!store.listId) return "month";
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

function linked(text: string): string {
  return text
    .split(URL_PATTERN)
    .map((part, i) =>
      i % 2 === 1
        ? `<a href="${escape(part)}" style="color:#4c1d95;text-decoration:underline">${escape(part)}</a>`
        : escape(part).replace(/\n/g, "<br>"),
    )
    .join("");
}

/** The creator's text as HTML: paragraphs, lists and links, nothing else. */
export function bodyHtml(body: string): string {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    let list: string[] = [];
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push(`<p style="margin:0 0 16px">${linked(para.join("\n"))}</p>`);
      if (list.length) out.push(`<ul style="margin:0 0 16px;padding-left:22px">${list.map((l) => `<li style="margin:0 0 6px">${linked(l)}</li>`).join("")}</ul>`);
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

/** One email, for one reader, with everything it has to carry. */
export function render(store: Store, subject: string, body: string, token: string | null): Rendered {
  const fromName = store.mail?.fromName || store.name;
  const address = store.mail?.address ?? "";
  const unsub = token ? `${SITE_URL}/unsubscribe?t=${token}` : `${SITE_URL}/@${store.handle}`;
  const oneClick = token ? `${SITE_URL}/api/mail/unsubscribe?t=${token}` : "";
  const why = `You are getting this because you told ${fromName} you wanted to hear from them, at nimbuslabsai.com/@${store.handle}.`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f7f5f0">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1c1917">
<div style="background:#ffffff;border-radius:16px;padding:28px 24px">${bodyHtml(body)}</div>
<div style="padding:20px 8px 0;font-size:13px;line-height:1.5;color:#57534e">
<p style="margin:0 0 8px">${escape(why)}</p>
<p style="margin:0 0 8px"><a href="${escape(unsub)}" style="color:#57534e;text-decoration:underline">Unsubscribe</a> in one click, and ${escape(fromName)} will not email you again.</p>
${address ? `<p style="margin:0 0 8px">${escape(fromName)} · ${escape(address)}</p>` : ""}
<p style="margin:0">Sent with Nimbus Labs.</p>
</div></div></body></html>`;
  const text = [
    body.trim(),
    "",
    "—",
    why,
    `Unsubscribe in one click: ${unsub}`,
    address ? `${fromName} · ${address}` : "",
    "Sent with Nimbus Labs.",
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
  stopped: "allowance" | "day" | "retry" | "refused" | null;
};

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
): Promise<SendOutcome> {
  const done: string[] = [];
  for (let i = 0; i < emails.length; ) {
    const room = await dailyRoom();
    if (room <= 0) return { done, rest: emails.slice(i), stopped: "day" };
    const chunk = emails.slice(i, i + Math.min(BATCH_SIZE, room));
    const reserved = await reserve(store, chunk.length);
    if (reserved !== "ok") return { done, rest: emails.slice(i), stopped: reserved === "month" ? "allowance" : "day" };
    const tokens = await tokensFor(store.listId as string, chunk, store.handle);
    const messages: BatchMessage[] = chunk
      .filter((email) => tokens.has(email))
      .map((email) => {
        const r = render(store, subject, body, tokens.get(email)!);
        return { from: fromLine(store), to: email, subject: r.subject, text: r.text, html: r.html, replyTo: store.email, headers: r.headers };
      });
    if (messages.length) await paced();
    const outcome = await sendBatch(messages, `${keyBase}:${i}:${chunk.length}`);
    if (outcome !== "sent") {
      await release(store, chunk.length);
      return { done, rest: emails.slice(i), stopped: outcome };
    }
    if (messages.length < chunk.length) await release(store, chunk.length - messages.length);
    for (const m of messages) done.push(m.to);
    i += chunk.length;
  }
  return { done, rest: [], stopped: null };
}
