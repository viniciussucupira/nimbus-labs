/**
 * How much a store has sent out this month.
 *
 * Storage is cheap and delivery is not: a gigabyte sitting still costs about
 * two cents a month, and the same gigabyte leaving costs about five cents
 * every time somebody downloads it. So the number that decides whether a $29
 * store pays for itself is not how big the files are — it is how many of them
 * go out. This counts that, publishes it, and says something when it is past
 * what the price covers.
 *
 * What it deliberately does NOT do is stop a delivery. Somebody paid the
 * creator for that file. Cutting the buyer off to protect our margin would be
 * taking money for a sale and then not completing it, which is the thing this
 * whole company is supposed to be the opposite of. Going over is a
 * conversation with the creator, not a door slammed on their customer.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { STREAM_PREFIX } from "@/lib/stream-rules";
import { VAULT_PREFIX } from "@/lib/vault-rules";

/**
 * What the monthly price covers, per store, per calendar month.
 *
 * Two hundred gigabytes costs us about $9.50 at published rates, out of the
 * roughly $27.86 a $29 subscription leaves after the card fee. To reach it a
 * creator has to send two hundred copies of a one-gigabyte file in a month,
 * which is a store doing very well. The number is published rather than kept
 * in a drawer, because a limit a creator cannot see is a limit they can only
 * discover by being punished for it.
 */
export const DELIVERY_ALLOWANCE_BYTES = 200 * 1024 * 1024 * 1024;

/**
 * Where free copies stop, and only free copies.
 *
 * A paid download is never refused, at any number, for the reason above: the
 * buyer paid for that file. But the delivery that can run away without
 * anybody having paid for anything is the free one — a lead magnet that
 * finds an audience, or is posted somewhere it was not meant to go, and is
 * pulled fifty thousand times. At the published rate that is thousands of
 * dollars against a $29 subscription, and no sale anywhere in it.
 *
 * So free copies pause at fifty gigabytes a month, by themselves, and start
 * again when the month turns. Nobody is cut off from something they bought,
 * because nobody bought it, and the creator is told the same day.
 *
 * Fifty, and not more, because the figure has to be set against what the
 * plan brings in rather than against what feels generous. At $0.11 a
 * gigabyte — the rate for a file too large to cache, which is the worst
 * case — fifty gigabytes is $5.50 against the $27.86 a $29 subscription
 * leaves after the card fee. This was twice the published allowance, 400 GB,
 * until the totals were added up: at that figure one store giving things
 * away could cost $44 a month on its own, and the plan lost money in its own
 * worst case. A brake set above the revenue it protects is not a brake.
 *
 * And it is not tight for giving things away. Fifty gigabytes is a ten
 * megabyte lead magnet downloaded five thousand times in a month, or a
 * hundred megabyte video five hundred times. A store past it is not running
 * a storefront any more.
 */
export const FREE_PAUSE_ABOVE_BYTES = 50 * 1024 * 1024 * 1024;

/**
 * What a gigabyte past the allowance costs, in cents.
 *
 * A paid download is never refused, at any number — the buyer paid for that
 * file. Which leaves one cost in the whole system with no ceiling, and only
 * two ways to put one on it: cut off a buyer, or stop a creator selling.
 * Both destroy the thing being protected.
 *
 * So it is priced instead of limited. Delivery costs us $0.05 a gigabyte,
 * and $0.11 for a file too large to cache; fifteen cents covers the worse of
 * those with room, and a store reaching it is a store selling enough that
 * the figure is small against what it is making.
 *
 * Published here, in the Terms and in the studio before it ever applies,
 * because a charge the contract does not mention is the surprise this whole
 * system exists to prevent. The creator is emailed automatically the morning
 * after they pass the allowance, so nothing is ever charged to somebody who
 * was not told first.
 */
export const OVER_ALLOWANCE_CENTS_PER_GB = 15;

/** Counters are dropped a while after the month they describe. */
const KEEP_SECONDS = 70 * 24 * 60 * 60;

/**
 * The stores that have passed the allowance this month.
 *
 * Kept as a set the moment a store crosses, rather than found later by
 * reading every counter, because reading every counter means scanning the
 * whole keyspace once a day on a store we pay per command for — and the
 * crossing is a single moment that already has the number in its hand.
 *
 * It exists because the creator could see they were over and we could not.
 * The warning in their studio has been there all along; the one that reaches
 * us had not, so the first we would hear of a store sending twenty-five
 * terabytes was the invoice, a month late and already paid.
 */
const overKey = (month: string) => `nl:store:delivery:over:${month}`;

/**
 * Which creator a delivery folder belongs to.
 *
 * A folder name is a one-way hash of the creator's address, so that a public
 * file path says nothing about whose store it is. That is right, and it
 * leaves this file holding a number it cannot attach to a person — which is
 * why the notice about going over the allowance could only ever have been
 * written by hand.
 *
 * So the pairing is kept here, in our own store, where it was always
 * readable to us and never to anybody else. Nothing about the public path
 * changes; the hash still reveals nothing. It is written when a creator
 * uploads, which is the one moment both halves are in the same hand, and
 * read only by the daily run that writes to them.
 */
const ownerKey = (folder: string) => `nl:store:folder-owner:${folder}`;

/** Remembers whose folder this is, so the allowance notice can reach them. */
export async function rememberFolderOwner(folder: string, email: string): Promise<void> {
  if (!isRedisConfigured() || !folder || !email) return;
  try {
    await redisPipeline([["SET", ownerKey(folder), email.toLowerCase()]]);
  } catch (error) {
    console.error("could not remember a folder's owner", error);
  }
}

/** The month a delivery belongs to, in UTC so it never depends on a server. */
export function monthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The store folder a file path belongs to.
 *
 * Every stored file lives at `stores/<folder>/<product>/<name>`, and a lesson
 * video at the video service at `stream/<folder>/<lesson>/<id>`, so the owner
 * can be read from the path itself. That matters on the buyer's download,
 * which knows the file but has never seen the creator's address.
 */
export function folderFromPathname(pathname: string): string | null {
  const parts = pathname.split("/");
  // A lesson video kept by the video service is written down under the same
  // folder, with its own first piece (lib/stream-rules.ts).
  // And so is a file in the store that charges nothing for a download
  // (lib/vault-rules.ts).
  if (parts.length < 4 || (parts[0] !== "stores" && parts[0] !== STREAM_PREFIX && parts[0] !== VAULT_PREFIX)) return null;
  return parts[1] || null;
}

const counterKey = (folder: string, month: string) =>
  `nl:store:delivery:${folder}:${month}`;

/**
 * Adds a delivery to this month's total.
 *
 * Counted when the file is handed over rather than when it finishes arriving,
 * because a download that goes straight from storage never reports back. That
 * makes the number an upper bound: a buyer who cancels halfway is still
 * counted in full. Erring high is the right way round for a figure whose job
 * is to warn.
 *
 * Never throws. A counter that cannot be written must not cost a buyer the
 * file they paid for.
 */
export async function recordDelivery(
  pathname: string,
  bytes: number,
): Promise<void> {
  if (!isRedisConfigured()) return;
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const folder = folderFromPathname(pathname);
  if (!folder) return;

  const month = monthKey();
  const key = counterKey(folder, month);
  try {
    const [total] = await redisPipeline([
      ["INCRBY", key, Math.round(bytes)],
      ["EXPIRE", key, KEEP_SECONDS],
    ]);
    // Written down once, on the delivery that takes the store past the line.
    // Checking the crossing rather than the total keeps a store that is far
    // over from writing this on every file it hands out for the rest of the
    // month.
    const now = Number(total);
    const before = now - Math.round(bytes);
    if (Number.isFinite(now) && now > DELIVERY_ALLOWANCE_BYTES && before <= DELIVERY_ALLOWANCE_BYTES) {
      await redisPipeline([
        ["SADD", overKey(month), folder],
        ["EXPIRE", overKey(month), KEEP_SECONDS],
      ]);
    }
  } catch (error) {
    console.error("could not record a delivery", error);
  }
}

export type DeliveryMonth = {
  bytes: number;
  allowance: number;
  /** True once the month's deliveries are past what the price covers. */
  over: boolean;
};

/** What this store has sent out so far this month. */
export async function deliveredThisMonth(
  folder: string,
): Promise<DeliveryMonth> {
  const allowance = DELIVERY_ALLOWANCE_BYTES;
  if (!isRedisConfigured() || !folder) {
    return { bytes: 0, allowance, over: false };
  }

  try {
    const [raw] = await redisPipeline([["GET", counterKey(folder, monthKey())]]);
    const bytes = typeof raw === "string" ? Number(raw) : Number(raw ?? 0);
    const counted = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
    return { bytes: counted, allowance, over: counted > allowance };
  } catch (error) {
    console.error("could not read this month's deliveries", error);
    return { bytes: 0, allowance, over: false };
  }
}

/**
 * Every store past the allowance this month, with what it has sent.
 *
 * Read by the daily usage watch (app/api/cron/usage/route.ts), which is the
 * only thing that tells us. Nothing here stops a delivery: a creator over
 * the line is a conversation, and this is what makes the conversation
 * possible in the week it matters rather than after the invoice.
 */
export async function storesOverAllowance(
  now: Date = new Date(),
): Promise<{ folder: string; bytes: number }[]> {
  if (!isRedisConfigured()) return [];
  const month = monthKey(now);
  try {
    const [raw] = await redisPipeline([["SMEMBERS", overKey(month)]]);
    const folders = Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string" && f !== "") : [];
    if (folders.length === 0) return [];
    const totals = await redisPipeline(folders.map((f) => ["GET", counterKey(f, month)]));
    return folders
      .map((folder, i) => ({ folder, bytes: Number(totals[i]) || 0 }))
      .filter((row) => row.bytes > DELIVERY_ALLOWANCE_BYTES)
      .sort((a, b) => b.bytes - a.bytes);
  } catch (error) {
    console.error("could not read the stores over the allowance", error);
    return [];
  }
}

/** "1.4 TB", for a line in an email. */
export function bytesWords(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
}

/**
 * Whether this store's free copies are paused for the rest of the month.
 *
 * Asked before a free file is handed over, and never before a paid one.
 * Answers false if it cannot be read: a counter we cannot reach must not
 * become a reason to refuse somebody.
 */
export async function freeDeliveryPaused(folder: string): Promise<boolean> {
  if (!isRedisConfigured() || !folder) return false;
  try {
    const [raw] = await redisPipeline([["GET", counterKey(folder, monthKey())]]);
    const bytes = Number(raw);
    return Number.isFinite(bytes) && bytes > FREE_PAUSE_ABOVE_BYTES;
  } catch (error) {
    console.error("could not read this month's deliveries", error);
    return false;
  }
}

/** The creators behind a set of folders, for the notice that goes to them. */
export async function ownersOf(folders: string[]): Promise<(string | null)[]> {
  if (!isRedisConfigured() || folders.length === 0) return folders.map(() => null);
  try {
    const raw = await redisPipeline(folders.map((f) => ["GET", ownerKey(f)]));
    return raw.map((v) => (typeof v === "string" && v.includes("@") ? v : null));
  } catch (error) {
    console.error("could not read who a folder belongs to", error);
    return folders.map(() => null);
  }
}
