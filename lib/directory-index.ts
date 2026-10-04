/**
 * The list of creators who said their affiliate programme may be listed, and
 * the one number that decides whether listing them is worth doing yet.
 *
 * There is no directory. This builds none, and tests/directory-index.test.ts
 * fails if a route ever starts serving one. What it does is the part that
 * cannot be caught up on later.
 *
 * Why an index and not a scan. The only way to enumerate stores today is
 * `storesAfter`, a SCAN over the whole keyspace in pages of two hundred keys.
 * That is right for a nightly job and wrong for a page: every store carries
 * dozens of keys of its own — statistics, affiliates, codes, buyer bonds — so
 * a directory page built on a scan would spend thousands of Redis commands per
 * visit, and Upstash charges by the command. So the answer is kept rather than
 * discovered: a set written the moment a creator turns the consent on, and
 * unwritten the moment they turn it off. The page, when there is ever a reason
 * to build one, is then a read of one set.
 *
 * And it has to be built alongside the consent, not after it. A consent
 * collected for a year with nowhere to record it is a year of permissions and
 * no list — and the day the list is finally wanted is the day nobody wants to
 * be running a migration across every store to reconstruct it.
 *
 *   nl:dir:listed   set  the sid of every store whose creator said yes
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import type { Store } from "@/lib/store";

const LISTED = "nl:dir:listed";

/**
 * How many listed programmes it would take before a page of them is worth
 * opening, rather than an announcement that nobody is here.
 *
 * A number, declared, so the decision is the product's and not a mood. An
 * affiliate opens a directory to browse; browsing beats asking somewhere above
 * a hundred programmes and nowhere below fifty. 150 is inside the range where
 * the page starts doing its job, and far enough above the bottom that it is
 * not a judgement call on the day.
 *
 * Reaching it is not an instruction to open one. It is the moment the question
 * becomes worth asking at all, which is the only thing a number can tell you.
 */
export const OPEN_DIRECTORY_AT = 150;

/**
 * Whether this store's programme would belong in a directory.
 *
 * Consent is necessary and not sufficient. A listing has to be worth an
 * affiliate's click: a programme switched off earns nobody anything, and a
 * store with nothing that pays a commission is a row that wastes the one
 * glance it gets. Checked here rather than in the eventual page so that the
 * count below means what it says.
 */
export function wouldList(store: Store): boolean {
  return Boolean(store.affiliates.enabled && store.affiliates.directory && store.affiliates.percent > 0 && store.sid);
}

/**
 * Keeps the set in step with what a creator just saved. Called on every save
 * of the programme, not only when the answer changed, because the cost of
 * being certain is one command and the cost of drift is a list that quietly
 * stops matching the consents behind it.
 */
export async function rememberListing(store: Store): Promise<void> {
  if (!store.sid || !isRedisConfigured()) return;
  await redisPipeline([[wouldList(store) ? "SADD" : "SREM", LISTED, store.sid]]);
}

/** Takes a store out, whatever it had said. For a store being deleted. */
export async function forgetListing(sid: string): Promise<void> {
  if (!sid || !isRedisConfigured()) return;
  await redisPipeline([["SREM", LISTED, sid]]);
}

/** How many creators have said yes and would be listed today. */
export async function listedCount(): Promise<number> {
  if (!isRedisConfigured()) return 0;
  const [count] = await redisPipeline([["SCARD", LISTED]]);
  return Number(count) || 0;
}

export type DirectoryReadiness = {
  /** Creators who said yes and whose programme would be worth a row. */
  listed: number;
  /** The figure at which the question is worth asking. */
  needed: number;
  /** Whether that figure has been reached. */
  ready: boolean;
  /** One sentence, for whoever is reading the answer rather than the number. */
  words: string;
};

/**
 * The answer to "is it time?", so that nobody has to remember to go and look.
 *
 * Deliberately a reading and not an action: it opens nothing, publishes
 * nothing and emails nobody. Operating a public marketplace brings duties to
 * the people listed in it that do not switch off again, and that is a decision
 * a person makes once, with this number in front of them.
 */
export async function directoryReadiness(): Promise<DirectoryReadiness> {
  const listed = await listedCount();
  const ready = listed >= OPEN_DIRECTORY_AT;
  return {
    listed,
    needed: OPEN_DIRECTORY_AT,
    ready,
    words: ready
      ? `${listed} creators have agreed to be listed, past the ${OPEN_DIRECTORY_AT} where a directory starts being worth opening. Nothing is published: this is the point at which the question is worth deciding.`
      : `${listed} of ${OPEN_DIRECTORY_AT} creators have agreed to be listed. Below that figure a directory reads as an empty room, so there is nothing to do here yet.`,
  };
}

/**
 * The sids of the listed stores, in pages.
 *
 * Here because the index is pointless if it cannot be read, and reading it is
 * the whole reason it exists. Nothing calls this yet. When something does, it
 * is one command for a page of stores rather than a walk over the database.
 */
export async function listedStores(cursor = "0", count = 100): Promise<{ sids: string[]; next: string }> {
  if (!isRedisConfigured()) return { sids: [], next: "0" };
  const [reply] = await redisPipeline([["SSCAN", LISTED, cursor, "COUNT", String(count)]]);
  const rows = Array.isArray(reply) ? reply : [];
  return {
    next: typeof rows[0] === "string" ? rows[0] : "0",
    sids: Array.isArray(rows[1]) ? (rows[1] as unknown[]).map(String) : [],
  };
}
