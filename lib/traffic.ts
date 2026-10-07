/**
 * How many visits a store had this month.
 *
 * lib/traffic-rules.ts says what a visit is and why it is the measure a
 * plan covers and a bill is made from. This file keeps it.
 *
 *   nl:traffic:day:<folder>:<day>    who came that day, each once
 *   nl:traffic:n:<folder>:<month>    visits, added up, that month
 *   nl:traffic:folders:<month>       the stores that had any, that month
 *
 * A page of a store says it was opened (app/api/store/hit). The visitor is
 * reduced to a few letters made from the day, the store and the address
 * they came from (visitorAddress), and put in the day's set. The set
 * answers whether they were already in it; only somebody new to the day
 * adds a visit to the month. The letters are made with a key of our own and
 * cannot be turned back into an address, and the set is gone two days
 * later: what is kept is a count.
 *
 * Counted exactly, by a set and not by an estimate, because a bill is made
 * from it.
 *
 * What this errs toward. Everybody behind one address, a household or an
 * office, is one visit a day. A count that cannot be written is not made.
 * A robot that says it is one, and the store's owner, are never counted
 * (lib/visit.ts). Every one of those is in the creator's favor, which is
 * the way round a figure that is billed from has to err.
 */
import { createHash, createHmac } from "node:crypto";
import { monthKey, rememberFolderOwner } from "@/lib/delivery";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { deriveKey } from "@/lib/secret-box";
import { type Store, storeFolder, storeRef } from "@/lib/store";
import { visitLimitFor, visitorAddress } from "@/lib/traffic-rules";

const dayKey = (folder: string, day: string) => `nl:traffic:day:${folder}:${day}`;
const countKey = (folder: string, month: string) => `nl:traffic:n:${folder}:${month}`;
const foldersKey = (month: string) => `nl:traffic:folders:${month}`;

/** A day's set is kept until the day after it is over, and a little longer. */
const DAY_KEEP_SECONDS = 2 * 24 * 60 * 60;
/** A month's figures are kept long enough to be billed, asked about and answered for. */
const KEEP_SECONDS = 400 * 24 * 60 * 60;

const FOLDER_PATTERN = /^[0-9a-f]{32}$/;

/**
 * The few letters a visitor is kept as for a day. Made with a key only this
 * deployment has (lib/secret-box.ts), so that somebody who read the set
 * could not find an address in it by trying every address there is.
 */
function fingerprint(of: string): string {
  const key = deriveKey("traffic-visitor");
  const made = key ? createHmac("sha256", key).update(of) : createHash("sha256").update(of);
  return made.digest("hex").slice(0, 16);
}

/**
 * Somebody opened a page of this store. Adds a visit to the month if they
 * are new to today; answers whether they were.
 *
 * Never throws: a count that cannot be written must not cost anybody the
 * page they opened.
 */
export async function recordVisit(store: Store, ip: string, now = Date.now()): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  try {
    const folder = await storeFolder(storeRef(store));
    const day = new Date(now).toISOString().slice(0, 10);
    const who = fingerprint(`${day}|${folder}|${visitorAddress(ip)}`);
    const [fresh] = await redisPipeline([["SADD", dayKey(folder, day), who]]);
    if (Number(fresh) !== 1) return false;
    const month = monthKey(new Date(now));
    const [count] = await redisPipeline([
      ["INCR", countKey(folder, month)],
      ["EXPIRE", countKey(folder, month), KEEP_SECONDS],
      ["EXPIRE", dayKey(folder, day), DAY_KEEP_SECONDS],
      ["SADD", foldersKey(month), folder],
      ["EXPIRE", foldersKey(month), KEEP_SECONDS],
    ]);
    // Whose folder this is, for the daily job that bills and writes
    // (lib/usage-billing.ts, storeOf): written with a month's first visit.
    if (Number(count) === 1) await rememberFolderOwner(folder, storeRef(store));
    return true;
  } catch (error) {
    console.error("could not count a visit to a store", error);
    return false;
  }
}

/** The visits a store had in a month ("2026-10"); this month by default. */
export async function visitsIn(folder: string, month = monthKey()): Promise<number> {
  if (!isRedisConfigured() || !folder) return 0;
  try {
    const [raw] = await redisPipeline([["GET", countKey(folder, month)]]);
    const visits = Number(raw);
    return Number.isFinite(visits) && visits > 0 ? Math.floor(visits) : 0;
  } catch (error) {
    console.error("could not read a store's visits", error);
    return 0;
  }
}

/** The stores that had any visit in a month. */
export async function visitedFolders(month = monthKey()): Promise<string[]> {
  if (!isRedisConfigured()) return [];
  const [raw] = await redisPipeline([["SMEMBERS", foldersKey(month)]]);
  return Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string" && FOLDER_PATTERN.test(f)).sort() : [];
}

/**
 * Whether a store's pages are resting for the remainder of the month: it
 * has no plan that a visit can be charged to, and has had the visits such a
 * store has (lib/traffic-rules.ts). Never true for a store that pays, which
 * is not asked about at all.
 *
 * Answers false when the count cannot be read: a figure we do not have must
 * not take a store's page down.
 */
export async function isResting(store: Store, now = Date.now()): Promise<boolean> {
  const limit = visitLimitFor(store, now / 1000);
  if (limit === null) return false;
  return (await visitsIn(await storeFolder(storeRef(store)), monthKey(new Date(now)))) >= limit;
}
