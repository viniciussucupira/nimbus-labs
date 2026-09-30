/**
 * Who may listen to a private podcast (lib/podcast-rules.ts).
 *
 *   nl:pod:t:<sha(token)>              the feed a token opens: store, product, address
 *   nl:pod:by:<store>:<product>:<key>  the token an address already has, so it keeps one feed
 *   nl:pod:ok:<store>:<product>:<key>  whether that address holds the product, for a few minutes
 *
 * A feed address is a secret: whoever has it can listen. So every read of it
 * and every episode fetched asks whether its address still holds the product
 * (lib/community-access.ts holdsProducts, the same answer a community's door
 * gives), and a feed that is fetched far more than any one person's apps do
 * is slowed down.
 */
import { createHash, randomBytes } from "node:crypto";
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, normaliseEmail } from "@/lib/auth";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { holdsProducts } from "@/lib/community-access";
import { sendEmail } from "@/lib/email";
import { withinLimit } from "@/lib/request-guard";
import { FEED_TOKEN } from "@/lib/podcast-rules";
import type { Listing, Store } from "@/lib/store";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const addressKey = (email: string) => sha(`nimbus-podcast:${normaliseEmail(email)}`).slice(0, 32);
const tokenKey = (token: string) => `nl:pod:t:${sha(token)}`;
const byKey = (sid: string, pid: string, email: string) => `nl:pod:by:${sid}:${pid}:${addressKey(email)}`;
const okKey = (sid: string, pid: string, email: string) => `nl:pod:ok:${sid}:${pid}:${addressKey(email)}`;

export type FeedGrant = { s: string; h: string; p: string; e: string };

/** The feed token for this address and product: the one it already has, or a new one. */
export async function feedToken(store: Store, productId: string, email: string): Promise<string | null> {
  if (!store.statsId || !isRedisConfigured()) return null;
  const sid = store.statsId;
  const [existing] = await redisPipeline([["GET", byKey(sid, productId, email)]]);
  if (typeof existing === "string" && FEED_TOKEN.test(existing)) return existing;
  const token = randomBytes(24).toString("hex");
  const grant: FeedGrant = { s: sid, h: store.handle, p: productId, e: normaliseEmail(email) };
  const [set] = await redisPipeline([["SET", byKey(sid, productId, email), token, "NX"]]);
  if (set === null) {
    const [again] = await redisPipeline([["GET", byKey(sid, productId, email)]]);
    return typeof again === "string" ? again : null;
  }
  await redisPipeline([["SET", tokenKey(token), JSON.stringify(grant)]]);
  return token;
}

export async function readFeedToken(token: string): Promise<FeedGrant | null> {
  if (!FEED_TOKEN.test(token) || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", tokenKey(token)]]);
  if (typeof raw !== "string") return null;
  try {
    const g = JSON.parse(raw) as FeedGrant;
    return typeof g.s === "string" && typeof g.p === "string" && typeof g.e === "string" ? g : null;
  } catch {
    return null;
  }
}

/** Whether this address may listen now: the creator always, a buyer while they hold it. */
export async function mayListen(store: Store, productId: string, email: string): Promise<boolean> {
  if (!store.statsId) return false;
  if (normaliseEmail(email) === normaliseEmail(store.email)) return true;
  return holdsProducts(store, [productId], email, okKey(store.statsId, productId, email), "1");
}

/** A feed read or an episode fetched: counted, and refused past what any one listener's apps ask. */
export async function feedAllowed(token: string): Promise<boolean> {
  return withinLimit("podcast-feed", sha(token).slice(0, 32), 600, 3_600);
}

export type LinkResult = "sent" | "email" | "limited" | "error";

/**
 * Emails an address the page with its own feed, if it holds the product.
 * "sent" either way, so the form tells nobody who bought what.
 */
export async function sendFeedLink(input: { store: Store; product: Listing; email: string; ip: string; base: string; from: string }): Promise<LinkResult> {
  const raw = input.email.trim();
  if (!raw || raw.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(raw)) return "email";
  const { store, product } = input;
  if (!(await withinLimit("podcast-link-ip", `${store.handle}:${input.ip}`, 10, 3_600))) return "limited";
  if (!(await withinLimit("podcast-link-address", sha(normaliseEmail(raw)), 5, 3_600))) return "limited";
  if (!(await mayListen(store, product.id, raw))) return "sent";
  const token = await feedToken(store, product.id, raw);
  if (!token) return "error";
  const sent = await sendEmail({
    from: input.from,
    to: normaliseEmail(raw),
    subject: `Your private podcast: ${product.title}`.slice(0, 200),
    text: [
      `Here is your own feed of ${product.title}, from ${store.name}:`,
      "",
      `${input.base}/podcast/${product.id}?t=${token}`,
      "",
      "Open it on your phone and choose your podcast app; new episodes then arrive in it like any show's. The feed is yours alone: please do not share it. It keeps working for as long as you have the podcast.",
      "",
      `Sent by Nimbus Labs on behalf of ${store.name}.`,
    ].join("\n"),
  });
  return sent ? "sent" : "error";
}
