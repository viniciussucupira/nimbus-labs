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

/** Counters are dropped a while after the month they describe. */
const KEEP_SECONDS = 70 * 24 * 60 * 60;

/** The month a delivery belongs to, in UTC so it never depends on a server. */
export function monthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The store folder a file path belongs to.
 *
 * Every stored file lives at `stores/<folder>/<product>/<name>`, so the owner
 * can be read from the path itself. That matters on the buyer's download,
 * which knows the file but has never seen the creator's address.
 */
export function folderFromPathname(pathname: string): string | null {
  const parts = pathname.split("/");
  if (parts.length < 4 || parts[0] !== "stores") return null;
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

  const key = counterKey(folder, monthKey());
  try {
    await redisPipeline([
      ["INCRBY", key, Math.round(bytes)],
      ["EXPIRE", key, KEEP_SECONDS],
    ]);
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
