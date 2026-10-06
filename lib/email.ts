/**
 * The one place that sends email.
 *
 * Everything that needs to reach an inbox goes through here, so there is a
 * single answer to "is sending switched on?" and a single place to change if
 * the provider ever changes.
 */
import { RESEND_TIMEOUT_MS, timed } from "@/lib/fetch-timeout";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";

// Local tests may point this at a mock server on 127.0.0.1; nothing else is
// accepted, so a test can never reach the real sender.
const BASE = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.RESEND_API_BASE ?? "")
  ? `${process.env.RESEND_API_BASE}`
  : "https://api.resend.com";
const API = `${BASE}/emails`;

/** Where the sender's API is, for the one other file that reads from it (lib/inbound-mail.ts). */
export const RESEND_BASE = BASE;

export const NIMBUS_FROM =
  process.env.NIMBUS_FROM_EMAIL?.trim() || "Marktmorgen <onboarding@resend.dev>";

export const STORE_FROM =
  process.env.RECOVERY_FROM_EMAIL?.trim() ||
  "Harbor Kitchen <onboarding@resend.dev>";

/**
 * How many emails of every kind this deployment has handed to the sender in a
 * calendar month (UTC): sign-in links, receipts and creators' list email
 * together, because the sender counts them together.
 *
 * It is counted here, in the one place everything is sent from, so that list
 * email can be held back before the sender's own ceiling is reached
 * (lib/mail.ts, senderRoom). A count that could not be written is let go: no
 * email is ever lost, or held up, over a counter.
 */
export const sentKey = (now = new Date()) => `nl:sender:${now.toISOString().slice(0, 7)}`;

async function countSent(n: number): Promise<void> {
  if (n <= 0 || !isRedisConfigured()) return;
  const key = sentKey();
  await redisPipeline([
    ["INCRBY", key, n],
    ["EXPIRE", key, 70 * 86_400],
  ]).catch(() => {});
}

/** Every email handed to the sender this month, of every kind. 0 when it cannot be read. */
export async function sentThisMonth(): Promise<number> {
  if (!isRedisConfigured()) return 0;
  try {
    const [raw] = await redisPipeline([["GET", sentKey()]]);
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

function getKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

export function isSenderConfigured(): boolean {
  return getKey() !== null;
}

/**
 * What goes into a header of an email, made safe to put there.
 *
 * Subjects and sender names are built from text creators and buyers typed —
 * a product title, a store name, an affiliate's address — and a line break
 * in a header is how an email is made to carry headers, or recipients, that
 * nobody wrote. The sender's API takes JSON rather than raw headers, but we
 * do not rely on it to clean what we send: every control character becomes a
 * space here, runs of space become one, and the length is capped.
 */
export function headerText(value: string, max = 250): string {
  return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

/** One plain address, or null: no spaces, no commas, one @, nothing that could name a second recipient. */
export function oneAddress(value: string | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text || text.length > 254 || !/^[^\s@,;<>"()]+@[^\s@,;<>"()]+\.[^\s@,;<>"()]+$/.test(text)) return null;
  return text;
}

/** A From line: `Name <address>` or a bare address, with nothing that breaks the header. */
function fromLine(value: string): string {
  return headerText(value, 320);
}

function cleanHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (/^[A-Za-z0-9-]{1,64}$/.test(name)) out[name] = headerText(value, 2000);
  }
  return out;
}

export async function sendEmail(message: {
  from: string;
  to: string;
  subject: string;
  text: string;
  /** The same message as a page, when there is one; the text is always sent with it. */
  html?: string;
  /** Where replies go, when that is not the sender. */
  replyTo?: string;
  /** Files to attach, their content in base64, as Resend's API takes them. */
  attachments?: { filename: string; content: string }[];
  /** Extra headers, such as the one that lets a mail app offer unsubscribe. */
  headers?: Record<string, string>;
  /**
   * For a message that must go out once: the sender answers a repeat of the
   * same key, within a day, without sending it again.
   */
  idempotencyKey?: string;
}): Promise<boolean> {
  const key = getKey();
  if (!key) return false;
  const to = oneAddress(message.to);
  if (!to) return false;
  const replyTo = oneAddress(message.replyTo);
  const headers = cleanHeaders(message.headers);

  const payload = JSON.stringify({
    from: fromLine(message.from),
    to: [to],
    subject: headerText(message.subject),
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    ...(message.attachments?.length ? { attachments: message.attachments } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(headers ? { headers } : {}),
  });
  // A sign-in link or a receipt must not be lost because the sender was busy
  // with a creator's newsletter a second earlier: asked to slow down, it
  // waits a moment and tries again.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      // Given up after RESEND_TIMEOUT_MS (lib/fetch-timeout.ts): not sent,
      // as far as the caller knows. A message that must go out once carries
      // an idempotency key, so trying it again later cannot send it twice.
      const response = await timed(RESEND_TIMEOUT_MS, (signal) =>
        fetch(API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey.slice(0, 256) } : {}),
          },
          body: payload,
          cache: "no-store",
          signal,
        }),
      );
      if (response.ok) {
        await countSent(1);
        return true;
      }
      if (response.status === 429 && attempt < 2) {
        await pause(1_000 + attempt * 1_000);
        continue;
      }
      console.error("email rejected", response.status);
      return false;
    } catch (error) {
      console.error("email failed", error);
      return false;
    }
  }
  return false;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type BatchMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
  /**
   * Labels the sender keeps with the email and gives back when it tells us
   * what became of it: which store's it was, so a bounce can be counted for
   * that store (lib/mail-health.ts). Never shown to the reader.
   */
  tags?: Record<string, string>;
};

/** Tags as the sender takes them: ASCII letters, digits, "_" and "-" only, 256 at most; anything else is left out. */
export function cleanTags(tags: Record<string, string> | undefined): { name: string; value: string }[] {
  const ok = /^[A-Za-z0-9_-]{1,256}$/;
  return Object.entries(tags ?? {})
    .filter(([name, value]) => ok.test(name) && ok.test(value))
    .map(([name, value]) => ({ name, value }));
}

/**
 * Sends up to a hundred emails in one request. The key makes a retry of the
 * same batch a no-op at the provider, so nobody gets a message twice.
 *
 * "retry" means nothing was sent and the same batch may be tried again later;
 * "refused" means the provider will not send it as it is.
 */
export async function sendBatch(
  messages: BatchMessage[],
  idempotencyKey: string,
): Promise<"sent" | "retry" | "refused"> {
  const key = getKey();
  if (!key) return "retry";
  if (messages.length === 0) return "sent";
  // What actually goes: a message with no address that can be written to is
  // left out below, and is not counted as sent either.
  const going = messages.slice(0, 100).filter((m) => oneAddress(m.to) !== null);
  try {
    // Given up after RESEND_TIMEOUT_MS: "retry", with the same key next time.
    const response = await timed(RESEND_TIMEOUT_MS, (signal) => fetch(`${BASE}/emails/batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify(
        going
          .map((m) => {
            const replyTo = oneAddress(m.replyTo);
            const headers = cleanHeaders(m.headers);
            const tags = cleanTags(m.tags);
            return {
              from: fromLine(m.from),
              to: [oneAddress(m.to) as string],
              subject: headerText(m.subject),
              text: m.text,
              html: m.html,
              ...(replyTo ? { reply_to: replyTo } : {}),
              ...(headers ? { headers } : {}),
              ...(tags.length ? { tags } : {}),
            };
          }),
      ),
      cache: "no-store",
      signal,
    }));
    if (response.ok) {
      await countSent(going.length);
      return "sent";
    }
    console.error("batch rejected", response.status);
    return response.status === 429 || response.status >= 500 ? "retry" : "refused";
  } catch (error) {
    console.error("batch failed", error);
    return "retry";
  }
}
