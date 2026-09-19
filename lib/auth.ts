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
 *   nl:auth:sessions:<hash> -> the set of a creator's live sessions, so that
 *                              they can close every one of them at once
 *   nl:auth:move:<hash>     -> a move from one address to another, 15 minutes,
 *                              spent on the tap that finishes it
 *
 * Two counters keep the sending honest: one for the machine that asks, one for
 * the address that would receive. The second one matters because the first one
 * cannot see a flood that arrives from many machines at once.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_LENGTH = 254;
export const SESSION_COOKIE = "nl_session";

const LINK_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const RATE_LIMIT = 5;
// Deliberately higher than RATE_LIMIT, so one machine that has spent its own
// five cannot, by itself, lock a creator out of their address for an hour.
const ADDRESS_LIMIT = 8;
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

const sessionsKey = async (email: string) =>
  `nl:auth:sessions:${(await sha256Hex(`nimbus-auth-sessions:${email}`)).slice(0, 40)}`;

const rateKey = async (ip: string) =>
  `nl:rl:signin:${(await sha256Hex(`nimbus-signin:${ip}`)).slice(0, 32)}`;

const moveKey = async (token: string) =>
  `nl:auth:move:${(await sha256Hex(`nimbus-auth-move:${token}`)).slice(0, 40)}`;

const addressKey = async (email: string) =>
  `nl:rl:address:${(await sha256Hex(`nimbus-signin-address:${email}`)).slice(0, 32)}`;

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

/**
 * Starts a move of the sign-in address, and tells both sides.
 *
 * The link goes to the NEW address, because holding that inbox is the whole
 * proof being asked for. The OLD address gets a plain notice instead of a
 * link, so that a creator whose account is already in someone else's hands
 * learns about it while it is still theirs to save.
 */
export async function sendMoveLink(
  from: string,
  to: string,
  origin: string,
): Promise<boolean> {
  const fromAddress = normaliseEmail(from);
  const toAddress = normaliseEmail(to);
  const token = randomToken();

  await redisPipeline([
    [
      "SET",
      await moveKey(token),
      JSON.stringify({ from: fromAddress, to: toAddress }),
      "EX",
      LINK_TTL_SECONDS,
    ],
  ]);

  // Best effort, and deliberately not awaited into the result: the creator's
  // move must not fail because a notice could not be delivered.
  void sendEmail({
    from: NIMBUS_FROM,
    to: fromAddress,
    subject: "Someone asked to move your Nimbus account",
    text: [
      `A request was made to move your Nimbus Labs account to ${toAddress}.`,
      "",
      "If that was you, finish it from the link sent to that address.",
      "",
      "If it was not you, sign in here and sign out everywhere. Nothing has",
      "moved yet, and nothing moves until someone opens the link sent to that",
      "other address.",
    ].join("\n"),
  }).catch(() => undefined);

  return sendEmail({
    from: NIMBUS_FROM,
    to: toAddress,
    subject: "Finish moving your Nimbus account",
    text: [
      `Your Nimbus Labs account at ${fromAddress} is being moved here.`,
      "",
      `${origin}/signin/confirm-move?token=${token}`,
      "",
      "It works once and stops working in 15 minutes.",
      "If you did not ask for it, ignore this email — nothing happens.",
    ].join("\n"),
  });
}

/** Spends a move link and says which address is moving where. */
export async function useMoveLink(
  token: string,
): Promise<{ from: string; to: string } | null> {
  if (!isRedisConfigured()) return null;
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const key = await moveKey(token);
  let raw: unknown;
  try {
    [raw] = await redisPipeline([["GETDEL", key]]);
  } catch {
    const [read] = await redisPipeline([["GET", key]]);
    const [removed] = await redisPipeline([["DEL", key]]);
    raw = Number(removed) === 1 ? read : null;
  }
  if (typeof raw !== "string" || !raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { from, to } = parsed as { from?: unknown; to?: unknown };
    if (typeof from !== "string" || typeof to !== "string") return null;
    if (!from || !to) return null;
    return { from, to };
  } catch {
    return null;
  }
}

/** Opens a session for an address that has just proved it holds the inbox. */
export async function openSession(email: string): Promise<string> {
  const id = randomToken();
  const opened = await sessionKey(id);
  const owned = await sessionsKey(normaliseEmail(email));
  await redisPipeline([
    ["SET", opened, normaliseEmail(email), "EX", SESSION_TTL_SECONDS],
    ["SADD", owned, opened],
    ["EXPIRE", owned, SESSION_TTL_SECONDS + 86_400],
  ]);
  return id;
}

/** Eight sign-in emails an hour to one address, however many machines ask. */
export async function withinAddressLimit(email: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const key = await addressKey(normaliseEmail(email));
  const [, count] = await redisPipeline([
    ["SET", key, "0", "EX", RATE_WINDOW_SECONDS, "NX"],
    ["INCR", key],
  ]);
  return Number(count) <= ADDRESS_LIMIT;
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

  // The link lands on a page that asks for one tap. It deliberately does not
  // land on something a mail filter could spend by merely opening it.
  const link = `${origin}/signin/confirm?token=${token}`;
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

  // Reading and spending the link must be one step. Two clicks that land at
  // the same moment would otherwise both find the email still there and both
  // open a session. GETDEL does it in a single command; where that command is
  // missing, the fallback keeps the guarantee by trusting the delete, not the
  // read — only the caller whose DEL actually removed the key gets in.
  const key = await linkKey(token);
  let email: unknown;
  try {
    [email] = await redisPipeline([["GETDEL", key]]);
  } catch {
    const [read] = await redisPipeline([["GET", key]]);
    const [removed] = await redisPipeline([["DEL", key]]);
    email = Number(removed) === 1 ? read : null;
  }
  if (typeof email !== "string" || !email) return null;

  const id = randomToken();
  const opened = await sessionKey(id);
  const owned = await sessionsKey(email);
  await redisPipeline([
    ["SET", opened, email, "EX", SESSION_TTL_SECONDS],
    // The creator's own list of open sessions, which is what makes "sign out
    // everywhere" possible. It outlives any single session by a day, so the
    // last entry is never orphaned before the session it names.
    ["SADD", owned, opened],
    ["EXPIRE", owned, SESSION_TTL_SECONDS + 86_400],
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
    const key = await sessionKey(id);
    const [email] = await redisPipeline([["GET", key]]);
    const commands: (string | number)[][] = [["DEL", key]];
    if (typeof email === "string" && email) {
      commands.push(["SREM", await sessionsKey(email), key]);
    }
    await redisPipeline(commands);
  } catch (error) {
    console.error("sign-out failed", error);
  }
}

/**
 * Closes every session this creator has open, anywhere.
 *
 * This is the answer to a session cookie that walked off on a borrowed laptop:
 * without it, a thirty-day session is thirty days whatever the creator does.
 * Returns how many were closed.
 */
export async function endAllSessions(email: string): Promise<number> {
  if (!isRedisConfigured()) return 0;
  const owned = await sessionsKey(normaliseEmail(email));
  try {
    const [members] = await redisPipeline([["SMEMBERS", owned]]);
    const keys = Array.isArray(members)
      ? members.filter((key): key is string => typeof key === "string")
      : [];
    await redisPipeline([
      ...keys.map((key) => ["DEL", key] as (string | number)[]),
      ["DEL", owned],
    ]);
    return keys.length;
  } catch (error) {
    console.error("sign-out everywhere failed", error);
    return 0;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
