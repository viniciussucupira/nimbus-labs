/**
 * A pass over each store's recent checkouts, for what the thanks page cannot
 * be trusted to do alone.
 *
 * The thanks page confirms a purchase the moment the buyer lands on it. A
 * buyer who closes the tab while Stripe is sending them there never lands,
 * and a checkout that closes unpaid has no page at all. So the five-minute
 * job walks the stores a slice at a time and, for each one that sells, asks
 * the creator's own Stripe account for the checkouts of the last day — one
 * request per hundred — and hands each on:
 *
 *   - a settled one that has not been confirmed gets its confirmation
 *     (lib/purchase-email.ts);
 *   - a closed, unpaid one on a store with reminders on is offered to
 *     lib/checkout-recovery.ts, which sends only if the buyer agreed;
 *   - a settled one that came through an affiliate's link is written down
 *     for that affiliate (lib/affiliates.ts), once.
 *
 * A store that hands out licence keys also has its refunds read, and the
 * key of every sale refunded in full is revoked (lib/licence-keys.ts), so
 * the creator's software hears about a refund within minutes, without the
 * creator having to go and revoke it by hand.
 *
 * Bounded three ways, so it can never run away with the job: a time budget
 * the caller sets, at most three pages of a hundred checkouts per store, and
 * a place in the list of stores kept in Redis, so each run carries on where
 * the last one stopped and every store is reached in turn. Both emails are
 * guarded by their own marks, so a store seen twice is only work, never a
 * second email.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { onAccount, platformKey } from "@/lib/stripe-account";
import { isSettled } from "@/lib/instant-pay";
import { CONFIRM_WITHIN_SECONDS, type SessionRecord, canConfirm, confirmPurchase, confirmationKey } from "@/lib/purchase-email";
import { remindAbandoned } from "@/lib/checkout-recovery";
import { recoveryOn } from "@/lib/recovery-setting";
import { type Store, storesAfter } from "@/lib/store";
import { affiliatesOn, noteSession } from "@/lib/affiliates";
import { revokeRefunded, storeHasKeys } from "@/lib/licence-keys";

const CURSOR_KEY = "nl:sweep:cursor";
/** At most this many pages of a hundred checkouts are read per store per pass. */
export const MAX_PAGES_PER_STORE = 3;

export type SweepCounts = { stores: number; confirmed: number; reminded: number; failed: number; revoked: number };

/** Whether a store has anything this pass could send about. */
function worthAsking(store: Store): boolean {
  return (
    (canConfirm(store) && store.products.some((product) => product.priceCents > 0 && !product.call)) ||
    (Boolean(store.stripeAccountId) && affiliatesOn(store)) ||
    storeHasKeys(store)
  );
}

/** One store: its checkouts of the last day, each handed to what it needs. */
async function sweepStore(store: Store, counts: SweepCounts, deadline: number): Promise<void> {
  // Refunds first: a key that should no longer open anything matters more
  // than a reminder. One failing never stops the checkouts below.
  if (storeHasKeys(store)) {
    try {
      counts.revoked += await revokeRefunded(store, deadline);
    } catch (error) {
      console.error("reading a store's refunds failed", store.handle, error);
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const since = now - CONFIRM_WITHIN_SECONDS;
  const reminding = recoveryOn(store);
  let after = "";
  for (let page = 0; page < MAX_PAGES_PER_STORE && Date.now() < deadline; page += 1) {
    const listed = await onAccount(
      "GET",
      store.stripeAccountId as string,
      `/checkout/sessions?limit=100&created[gte]=${since}${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`,
    );
    const rows = Array.isArray(listed.data) ? (listed.data as SessionRecord[]) : [];

    // Asked in one round trip: which of the paid ones were already confirmed.
    const paid = rows.filter((row) => isSettled(row) && typeof row.id === "string");
    // An affiliate's sale is written down whether or not its buyer came back.
    if (affiliatesOn(store)) {
      for (const row of paid) {
        if (row.metadata?.via) await noteSession(store, row as Parameters<typeof noteSession>[1]);
      }
    }
    const confirming = canConfirm(store);
    const marks = paid.length && confirming
      ? await redisPipeline(paid.map((row) => ["EXISTS", confirmationKey(row.id as string)]))
      : [];
    for (let i = 0; confirming && i < paid.length && Date.now() < deadline; i += 1) {
      if (Number(marks[i]) === 1) continue;
      const outcome = await confirmPurchase(store, paid[i].id as string, paid[i]);
      if (outcome === "sent") counts.confirmed += 1;
      if (outcome === "failed") counts.failed += 1;
    }

    if (reminding) {
      for (const row of rows) {
        if (Date.now() >= deadline) break;
        if (row.status !== "expired" || row.consent?.promotions !== "opt_in") continue;
        const outcome = await remindAbandoned(store, row);
        if (outcome === "sent") counts.reminded += 1;
        if (outcome === "failed") counts.failed += 1;
      }
    }

    const last = rows[rows.length - 1];
    if (listed.has_more !== true || !last || typeof last.id !== "string") break;
    after = last.id;
  }
}

/**
 * Walks stores until the deadline or the end of the list, whichever comes
 * first, and remembers where it stopped.
 *
 * The place is the Redis cursor of the batch being read and how many stores
 * of that batch were done, so a run that stops half way through a batch
 * starts the next one at the store after the last it finished.
 */
export async function sweepCheckouts(deadline: number): Promise<SweepCounts> {
  const counts: SweepCounts = { stores: 0, confirmed: 0, reminded: 0, failed: 0, revoked: 0 };
  if (!isRedisConfigured() || !platformKey()) return counts;

  const [saved] = await redisPipeline([["GET", CURSOR_KEY]]);
  const [savedCursor, savedDone] = typeof saved === "string" ? saved.split("|") : ["0", "0"];
  let cursor = /^\d+$/.test(savedCursor ?? "") ? savedCursor : "0";
  let skip = Number(savedDone) || 0;

  while (Date.now() < deadline) {
    const { stores, next } = await storesAfter(cursor);
    let done = 0;
    for (const store of stores) {
      if (done < skip) {
        done += 1;
        continue;
      }
      if (Date.now() >= deadline) break;
      if (worthAsking(store)) {
        counts.stores += 1;
        try {
          await sweepStore(store, counts, deadline);
        } catch (error) {
          // One store's account refusing, or Stripe having a moment, does not
          // hold up everyone after it. It is reached again next time round.
          console.error("reading a store's checkouts failed", store.handle, error);
        }
      }
      done += 1;
    }
    if (done < stores.length) {
      await redisPipeline([["SET", CURSOR_KEY, `${cursor}|${done}`]]);
      return counts;
    }
    skip = 0;
    cursor = next;
    // The end of the list: the next run starts again from the top, rather
    // than this one reading the first stores twice in a row.
    if (next === "0") break;
  }
  await redisPipeline([["SET", CURSOR_KEY, `${cursor}|0`]]);
  return counts;
}
