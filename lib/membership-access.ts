/**
 * Membership access that ends when the membership does.
 *
 * A membership is paid for as it goes, so what it hands over — its file, its
 * course — is open while it is being paid for and closed once it is not.
 * Until this existed the thanks-page link of a membership kept its file open
 * for its three days whatever happened to the membership meanwhile. Now every
 * delivery a membership makes through Marktmorgen asks Stripe first:
 *
 *   - a download from the thanks page or the emailed list of purchases reads
 *     the checkout from the creator's own account on every request, as it
 *     always did, and now reads the membership's state in that same request;
 *   - a course page, lesson or lesson download reads it through lib/learn.ts,
 *     which keeps Stripe's answer for ten minutes;
 *   - anything else that only has the membership's id asks for it here, and
 *     the answer is kept for two minutes.
 *
 * Open means Stripe calls the membership active, in its free trial, or past
 * due — a payment failed and Stripe is still retrying it, which is the
 * member's grace, not a reason to lock them out mid-retry. Anything else —
 * cancelled, unpaid after the retries, paused, a first payment never made —
 * is ended, and the member is shown a page that says so plainly, with the
 * way to join again and, where a card can be fixed, the way to fix it.
 *
 * A membership that ends by itself after a set number of payments has ended
 * too, once the last period is over: that is what the creator sold.
 *
 * What this cannot reach is a link to somewhere else. A product delivered as
 * a link to a Google Drive folder, a Notion page or a private video is on
 * somebody else's server; once the member has the address they have it, and
 * only the creator can take it back there. The studio says so beside that
 * choice.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount } from "@/lib/stripe-account";
import type { Listing, Store } from "@/lib/store";

/** The states in which a membership still hands over what it sells. */
export const LIVE_STATES = new Set(["active", "trialing", "past_due"]);

/** How long an answer read here is reused. */
export const STATUS_SECONDS = 2 * 60;

const SUBSCRIPTION_PATTERN = /^sub_[A-Za-z0-9]{6,200}$/;
const statusKey = (account: string, subscription: string) => `nl:member:status:${account}:${subscription}`;

export function isLive(status: unknown): boolean {
  return typeof status === "string" && LIVE_STATES.has(status);
}

/**
 * Whether a checkout sold a membership, as opposed to a single sale or a
 * payment plan. A plan is also a subscription, but it pays for something
 * already handed over and ends by itself; it never closes anything.
 */
export function soldAMembership(product: Listing, session: { mode?: unknown; metadata?: Record<string, string> | null }): boolean {
  return product.recurring !== null && session.mode === "subscription" && session.metadata?.kind !== "plan";
}

/**
 * Stripe's state for a membership, from the subscription on a checkout —
 * already expanded, or asked for by its id and kept for two minutes. Null
 * when Stripe cannot say, which callers treat as ended: a door that cannot
 * check whether someone still pays stays shut rather than open.
 */
export async function membershipStatus(store: Store, subscription: unknown): Promise<string | null> {
  if (subscription && typeof subscription === "object") {
    const status = (subscription as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }
  const account = store.stripeAccountId;
  if (typeof subscription !== "string" || !SUBSCRIPTION_PATTERN.test(subscription) || !account) return null;
  if (isRedisConfigured()) {
    const [cached] = await redisPipeline([["GET", statusKey(account, subscription)]]);
    if (typeof cached === "string" && cached) return cached;
  }
  const sub = await onAccount("GET", account, `/subscriptions/${encodeURIComponent(subscription)}`);
  const status = typeof sub.status === "string" ? sub.status : null;
  if (status && isRedisConfigured()) {
    await redisPipeline([["SET", statusKey(account, subscription), status, "EX", STATUS_SECONDS]]);
  }
  return status;
}

/** The page that tells a member their membership ended, and how to renew. */
export function renewPath(store: Store, product: Pick<Listing, "id">): string {
  return `/@${store.handle}/renew/${product.id}`;
}
