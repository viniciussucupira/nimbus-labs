/**
 * Signing a creator in, without a password.
 *
 * The creator types their email and we send a link. Clicking it signs them in.
 * There is no password to invent, none to forget, and no table of other
 * people's passwords for us to guard — which is the kind of thing a one-person
 * company should not be guarding.
 *
 * Two short-lived records do the work, both in Redis, both keyed by a one-way
 * hash so the raw token and the raw session id never rest anywhere:
 *
 *   nl:auth:link:<hash>     -> email, 15 minutes, deleted the moment it is used
 *   nl:auth:session:<hash>  -> email, 30 days, deleted on sign-out
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_LENGTH = 254;
export const SESSION_COOKIE = "nl_session";

const LINK_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60 * 60;

export function isAuthConfigured(): boolean {
  return isRedisConfigured() && isSenderConfigured();
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const linkKey = async (token: string) =>
  `nl:auth:link:${(await sha256Hex(`nimbus-auth-link:${token}`)).slice(0, 40)}`;

const sessionKey = async (id: string) =>
  `nl:auth:session:${(await sha256Hex(`nimbus-auth-session:${id}`)).slice(0, 40)}`;

const rateKey = async (ip: string) =>
  `nl:rl:signin:${(await sha256Hex(`nimbus-signin:${ip}`)).slice(0, 32)}`;

/** Five sign-in emails an hour from one address on the internet. */
export async function withinRateLimit(ip: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const key = await rateKey(ip);
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", RATE_WINDOW_SECONDS, "NX"],
    ["INCR", key],
  ]);
  return Number(count) <= RATE_LIMIT;
}

/** Creates the one-time link and emails it. Returns false if nothing was sent. */
export async function sendSignInLink(
  email: string,
  origin: string,
): Promise<boolean> {
  const address = normaliseEmail(email);
  const token = randomToken();

  await redisPipeline([
    ["SET", await linkKey(token), address, "EX", LINK_TTL_SECONDS],
  ]);

  const link = `${origin}/api/auth/callback?token=${token}`;
  return sendEmail({
    from: NIMBUS_FROM,
    to: address,
    subject: "Your sign-in link",
    text: [
      "Here is your link to sign in to Nimbus Labs.",
      "",
      link,
      "",
      "It works once and stops working in 15 minutes.",
      "If you did not ask for it, ignore this email — nothing happens.",
    ].join("\n"),
  });
}

/**
 * Spends a sign-in link and opens a session. The link is deleted first, so a
 * link that leaks after the fact is already worthless.
 */
export async function useSignInLink(token: string): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const key = await linkKey(token);
  const [email] = await redisPipeline([["GET", key]]);
  if (typeof email !== "string" || !email) return null;
  await redisPipeline([["DEL", key]]);

  const id = randomToken();
  await redisPipeline([
    ["SET", await sessionKey(id), email, "EX", SESSION_TTL_SECONDS],
  ]);
  return id;
}

export async function emailForSession(
  id: string | undefined,
): Promise<string | null> {
  if (!id || !isRedisConfigured()) return null;
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const [email] = await redisPipeline([["GET", await sessionKey(id)]]);
  return typeof email === "string" && email ? email : null;
}

export async function endSession(id: string | undefined): Promise<void> {
  if (!id || !isRedisConfigured()) return;
  if (!/^[0-9a-f]{64}$/.test(id)) return;
  try {
    await redisPipeline([["DEL", await sessionKey(id)]]);
  } catch (error) {
    console.error("sign-out failed", error);
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
