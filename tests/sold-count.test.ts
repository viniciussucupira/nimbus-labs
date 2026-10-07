/**
 * "Bought N times" (lib/sold-count.ts): a count read from the creator's own
 * Stripe account, never typed, shown only when the creator switched it on.
 *
 * What is checked:
 *
 *   - nothing is said below ten, and the words are exactly what was counted;
 *   - a store that did not switch it on reads nothing and asks nothing;
 *   - a reading is kept, and two pages asking at once read Stripe once;
 *   - an old reading is known to be old, so it is read again.
 */
import { claimHandle, ensureStatsId, setStripeAccount, storeForEmail, updateLook } from "@/lib/store";
import { DEFAULT_LOOK } from "@/lib/store-look";
import { SHOWN_FROM, SOLD_FRESH_MS, readSoldCounts, refreshSoldCounts, soldWords, stale } from "@/lib/sold-count";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

async function main(): Promise<void> {
  redis.clear();

  part("The words");
  is("nothing below ten", [soldWords(undefined), soldWords(0), soldWords(SHOWN_FROM - 1)], [null, null, null]);
  is("from ten, exactly what was counted", soldWords(1234), "Bought 1,234 times");

  const owner = "sold@example.com";
  await claimHandle(owner, "soldshop", "Sold Shop", "");
  await ensureStatsId(owner);
  await setStripeAccount(owner, "acct_1TestSold00001", true);
  let store = (await storeForEmail(owner))!;

  let reads = 0;
  const read = async () => {
    reads += 1;
    return { byProduct: { p1: { sales: 42 }, p2: { sales: 0 } } };
  };

  part("Off unless switched on");
  is("nothing read", await readSoldCounts(store), null);
  is("and Stripe not asked", [await refreshSoldCounts(store, read), reads], [null, 0]);

  part("Switched on");
  await updateLook(owner, { ...DEFAULT_LOOK, sold: true });
  store = (await storeForEmail(owner))!;
  is("saved with the look", store.look.sold, true);
  const now = 1_800_000_000_000;
  const [one, two] = await Promise.all([refreshSoldCounts(store, read, now), refreshSoldCounts(store, read, now)]);
  is("two pages at once read Stripe once", reads, 1);
  is("one of them got the counts", Boolean(one) !== Boolean(two), true);
  const kept = await readSoldCounts(store);
  is("kept, with nothing for a product that sold none", kept?.byProduct, { p1: 42 });
  is("fresh at first", stale(kept, now + 1000), false);
  is("old after a few hours", stale(kept, now + SOLD_FRESH_MS + 1), true);

  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
