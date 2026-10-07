/**
 * Video watched past what a plan covers, put on the creator's next invoice.
 *
 * lib/watch-rules.ts says what is covered and what an hour past it costs;
 * lib/watch.ts keeps how long each store's video was watched. This is the
 * daily job's part (app/api/cron/usage): for every store past its hours it
 * works out what the month has come to, takes away what was already put on
 * an invoice, and adds the difference as one line on the store's own
 * subscription (lib/billing.ts, addToNextInvoice). Stripe charges it with
 * the plan, to the card the plan is paid with. Nobody has to notice, and
 * nobody is cut off.
 *
 * Until this existed the Terms said a charge would be made that nothing
 * made, and the one cost here with no ceiling had nothing set against it.
 *
 *   nl:watch:billed:<folder>:<month>    cents of that month already on an invoice
 *   nl:watch:adding:<folder>:<month>    a line being added, until it is known to be there
 *   nl:watch:told:<folder>:<month>      the creator was written to about that month
 *   nl:watch:monthly:<subscription>     a yearly plan was set to bill added lines monthly
 *
 * Never twice. What is being added is written down before Stripe is asked,
 * with a mark that goes on the line itself. If the answer never comes back,
 * the next run looks for the mark before it adds anything: found, the line
 * is counted as billed; not found, the same request is made again under the
 * same key, which Stripe will not carry out a second time.
 *
 * While a month is running a line is added only once it is worth a dollar,
 * so an invoice does not fill with one-cent lines. When the month is over
 * whatever is left is added, down to the cent.
 */
import { addToNextInvoice, billAddedLinesMonthly, findInvoiceLine, isBillingConfigured } from "@/lib/billing";
import { monthKey, storeKeysOf } from "@/lib/delivery";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { type Store, storeFolder, storeForEmail, storeRef } from "@/lib/store";
import { watchedFolders, watchedIn } from "@/lib/watch";
import {
  SMALLEST_LINE_CENTS,
  VIDEO_HOURS_INCLUDED,
  VIDEO_SECONDS_INCLUDED,
  canBeCharged,
  hoursWords,
  monthBefore,
  monthWords,
  videoOwedCents,
} from "@/lib/watch-rules";

const billedKey = (folder: string, month: string) => `nl:watch:billed:${folder}:${month}`;
const addingKey = (folder: string, month: string) => `nl:watch:adding:${folder}:${month}`;
const toldKey = (folder: string, month: string) => `nl:watch:told:${folder}:${month}`;
const monthlyKey = (subscriptionId: string) => `nl:watch:monthly:${subscriptionId}`;

const KEEP_SECONDS = 400 * 24 * 60 * 60;
/** The first days of a month in which the month before is still settled, so a day Stripe could not be reached is made up. */
const SETTLE_DAYS = 5;

/** `seconds` is what the line says was watched, kept so a second try sends word for word what the first did. */
type Adding = { from: number; to: number; at: number; seconds: number; customerId: string; subscriptionId: string };

function parseAdding(raw: unknown): Adding | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Partial<Adding>;
    if (typeof value.from !== "number" || typeof value.to !== "number" || !(value.to > value.from) || value.from < 0) return null;
    if (typeof value.customerId !== "string" || typeof value.subscriptionId !== "string" || typeof value.at !== "number") return null;
    const seconds = typeof value.seconds === "number" && value.seconds > 0 ? value.seconds : 0;
    return { from: value.from, to: value.to, at: value.at, seconds, customerId: value.customerId, subscriptionId: value.subscriptionId };
  } catch {
    return null;
  }
}

export type Settled = {
  folder: string;
  month: string;
  /** How long the store's video was watched that month, in seconds. */
  seconds: number;
  /** What the month has come to in all, in cents, and what this run put on an invoice. */
  owed: number;
  added: number;
  /**
   *   nothing   inside what the plan covers, or all of it already billed
   *   waiting   past it by less than a line is worth while the month runs
   *   billed    a line was added
   *   no_plan   the store has no plan that can be charged (its video pauses instead, lib/learn.ts)
   *   no_store  nobody is known to own the folder
   *   failed    Stripe could not be asked; it is tried again tomorrow
   */
  state: "nothing" | "waiting" | "billed" | "no_plan" | "no_store" | "failed";
  store: Store | null;
};

const mark = (folder: string, month: string, from: number) => `watch:${folder}:${month}:${from}`;

function describe(month: string, seconds: number): string {
  return `Video watched past your plan's ${VIDEO_HOURS_INCLUDED} hours in ${monthWords(month)} (${hoursWords(seconds)} watched so far)`;
}

/** Adds one line, or finds that it is there already. True when the line is on the subscription. */
async function carryOut(folder: string, month: string, adding: Adding): Promise<boolean> {
  try {
    const sign = mark(folder, month, adding.from);
    // A request made before may have gone through without our hearing of it.
    if (await findInvoiceLine(adding.customerId, sign, Math.floor(adding.at / 1000) - 60)) return true;
    await addToNextInvoice({
      customerId: adding.customerId,
      subscriptionId: adding.subscriptionId,
      cents: adding.to - adding.from,
      description: describe(month, adding.seconds),
      mark: sign,
      idempotencyKey: `nl-${sign}:${adding.to}`,
    });
    return true;
  } catch (error) {
    console.error("adding video hours to an invoice failed", error);
    return false;
  }
}

/** The store a folder belongs to; null when nobody is known to own it, or the store is gone. */
export async function storeOf(folder: string): Promise<Store | null> {
  const [key] = await storeKeysOf([folder]);
  if (!key) return null;
  const store = await storeForEmail(key);
  // The folder is worked out from the store's key: one that does not come
  // back to this folder is not the store these hours belong to.
  if (!store || (await storeFolder(storeRef(store))) !== folder) return null;
  return store;
}

/**
 * A plan paid by the year makes one invoice a year. Its added lines are
 * billed by the month instead, set once for the subscription.
 */
async function monthlyFor(store: Store | null, subscriptionId: string): Promise<void> {
  if (store?.cycle !== "year" || store.subscriptionId !== subscriptionId) return;
  const [first] = await redisPipeline([["SET", monthlyKey(subscriptionId), "1", "NX", "EX", KEEP_SECONDS]]);
  if (first === null) return;
  await billAddedLinesMonthly(subscriptionId).catch(async (error) => {
    console.error("could not set a yearly plan to bill added lines monthly", error);
    // Tried again with the next line. Until then the line waits for the yearly invoice, and is still billed.
    await redisPipeline([["DEL", monthlyKey(subscriptionId)]]).catch(() => {});
  });
}

/**
 * Settles one store's month. `final` when the month is over: whatever is
 * left is billed, however small.
 */
export async function settle(folder: string, month: string, final: boolean, now = Date.now()): Promise<Settled> {
  const seconds = await watchedIn(folder, month);
  const owed = videoOwedCents(seconds);
  const out: Settled = { folder, month, seconds, owed, added: 0, state: "nothing", store: null };
  if (!isRedisConfigured()) return out;

  const [billedRaw, addingRaw] = await redisPipeline([
    ["GET", billedKey(folder, month)],
    ["GET", addingKey(folder, month)],
  ]);
  let billed = Number(billedRaw) > 0 ? Math.floor(Number(billedRaw)) : 0;
  let unfinished = parseAdding(addingRaw);
  if (unfinished && unfinished.from !== billed) {
    // Written down for a figure that has since moved on: it was carried out.
    await redisPipeline([["DEL", addingKey(folder, month)]]);
    unfinished = null;
  }
  if (!unfinished) {
    if (owed - billed <= 0) return out;
    if (!final && owed - billed < SMALLEST_LINE_CENTS) return { ...out, state: "waiting" };
  }

  const store = await storeOf(folder);
  out.store = store;

  // A line that was being added when the last run ended: finished first,
  // for the customer it was begun for.
  if (unfinished) {
    if (!isBillingConfigured() || !(await carryOut(folder, month, unfinished))) return { ...out, state: "failed" };
    billed = unfinished.to;
    out.added += unfinished.to - unfinished.from;
    out.state = "billed";
    await redisPipeline([
      ["SET", billedKey(folder, month), billed, "EX", KEEP_SECONDS],
      ["DEL", addingKey(folder, month)],
    ]);
    await monthlyFor(store, unfinished.subscriptionId);
  }

  const due = owed - billed;
  if (due <= 0 || (!final && due < SMALLEST_LINE_CENTS)) return out;
  if (!store) return { ...out, state: "no_store" };
  if (!canBeCharged(store, now / 1000) || !store.stripeCustomerId || !store.subscriptionId) return { ...out, state: "no_plan" };
  if (!isBillingConfigured()) return { ...out, state: "failed" };

  const adding: Adding = { from: billed, to: owed, at: now, seconds, customerId: store.stripeCustomerId, subscriptionId: store.subscriptionId };
  await redisPipeline([["SET", addingKey(folder, month), JSON.stringify(adding), "EX", KEEP_SECONDS]]);
  if (!(await carryOut(folder, month, adding))) return { ...out, state: "failed" };
  await redisPipeline([
    ["SET", billedKey(folder, month), owed, "EX", KEEP_SECONDS],
    ["DEL", addingKey(folder, month)],
  ]);
  out.added += due;
  await monthlyFor(store, store.subscriptionId);
  return { ...out, state: "billed" };
}

/**
 * The daily run: this month for every store whose video was watched, and
 * the month before while it is still being closed.
 */
export async function settleAll(now = Date.now()): Promise<Settled[]> {
  if (!isRedisConfigured()) return [];
  const today = new Date(now);
  const month = monthKey(today);
  const results: Settled[] = [];
  const runs: [string, boolean][] = [[month, false]];
  if (today.getUTCDate() <= SETTLE_DAYS) runs.unshift([monthBefore(month), true]);
  for (const [which, final] of runs) {
    for (const folder of await watchedFolders(which)) {
      // A store inside what its plan covers has nothing to settle, and is not asked about further.
      if ((await watchedIn(folder, which)) <= VIDEO_SECONDS_INCLUDED) continue;
      try {
        results.push(await settle(folder, which, final, now));
      } catch (error) {
        console.error("settling a store's video hours failed", error);
      }
    }
  }
  return results;
}

/**
 * Whether the creator still has to be written to about this month: true the
 * first time it is asked for a store and a month, and never again.
 */
export async function firstWord(folder: string, month: string): Promise<boolean> {
  const [first] = await redisPipeline([["SET", toldKey(folder, month), "1", "NX", "EX", KEEP_SECONDS]]);
  return first !== null;
}
