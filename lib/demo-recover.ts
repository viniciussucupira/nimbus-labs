/**
 * Getting a lost download back.
 *
 * A download link expires, which is what stops a leaked link from becoming a
 * free copy for everyone. The cost of that is a buyer who closes the tab, loses
 * the email and no longer has what they paid for.
 *
 * The usual fix is to make the buyer create an account. We do not do that: an
 * account is a password to invent, a thing to forget, and a table of other
 * people's credentials for us to guard. Instead the buyer types the address
 * they paid with and we send the link there again. Only the person who reads
 * that inbox gets anything, which is the same protection an account gives, at
 * none of the cost.
 *
 * What is stored: a one-way hash of the address and the Checkout Session id,
 * for as long as the download window lasts, and nothing else.
 *
 * Sending needs RESEND_API_KEY. Without it this file still loads and the
 * endpoint answers honestly that sending is off, rather than pretending an
 * email is on its way.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_LENGTH = 254;

const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60 * 60;

// Local tests may point this at a mock server on 127.0.0.1; nothing else is
// accepted, so a test can never reach the real sender.
const RESEND_API = /^http:\/\/127\.0\.0\.1:\d+$/.test(
  process.env.RESEND_API_BASE ?? "",
)
  ? `${process.env.RESEND_API_BASE}/emails`
  : "https://api.resend.com/emails";

function getSenderKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

export function isSenderConfigured(): boolean {
  return getSenderKey() !== null;
}

export function isRecoveryConfigured(): boolean {
  return isRedisConfigured() && isSenderConfigured();
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function orderKey(email: string): Promise<string> {
  const hash = await sha256Hex(`nimbus-demo-order:${normaliseEmail(email)}`);
  return `nl:demo:order:${hash.slice(0, 32)}`;
}

async function rateKey(ip: string): Promise<string> {
  const hash = await sha256Hex(`nimbus-demo-recover:${ip}`);
  return `nl:rl:recover:${hash.slice(0, 32)}`;
}

/**
 * Remembers which order belongs to an address, for exactly as long as the
 * download itself lasts. After that the record removes itself.
 */
export async function rememberOrder(
  email: string | null,
  sessionId: string,
  secondsLeft: number,
): Promise<void> {
  if (!email || !EMAIL_PATTERN.test(email) || secondsLeft <= 0) return;
  if (!isRedisConfigured()) return;

  try {
    await redisPipeline([
      ["SET", await orderKey(email), sessionId, "EX", Math.ceil(secondsLeft)],
    ]);
  } catch (error) {
    // Losing this record costs a re-send, never a sale. Never break the page.
    console.error("demo order index failed", error);
  }
}

export async function findOrder(email: string): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  const [value] = await redisPipeline([["GET", await orderKey(email)]]);
  return typeof value === "string" && value ? value : null;
}

/** Five attempts an hour from one address on the internet. */
export async function withinRateLimit(ip: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const key = await rateKey(ip);
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", RATE_WINDOW_SECONDS, "NX"],
    ["INCR", key],
  ]);
  return Number(count) <= RATE_LIMIT;
}

const FROM =
  process.env.RECOVERY_FROM_EMAIL?.trim() ||
  "Harbor Kitchen <onboarding@resend.dev>";

export async function sendRecoveryEmail(
  to: string,
  link: string,
): Promise<boolean> {
  const key = getSenderKey();
  if (!key) return false;

  const text = [
    "Here is your download again.",
    "",
    link,
    "",
    "The link works while the download window is open and is tied to your order.",
    "You are getting this because someone asked for the file to be sent to this address on the Harbor Kitchen demo store. If that was not you, ignore this email — nothing else happens.",
  ].join("\n");

  try {
    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: "Your download, again",
        text,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("recovery email rejected", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("recovery email failed", error);
    return false;
  }
}
