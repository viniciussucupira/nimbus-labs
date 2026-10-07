/**
 * The free product offered once to a visitor about to leave (lib/store.ts,
 * setExitOffer; components/exit-offer.tsx). What is checked: only something
 * free and published can be chosen; it can be switched off; a store written
 * before it existed has none.
 */
import { addProduct, claimHandle, ensureStatsId, setExitOffer, setProductHidden, storeForEmail } from "@/lib/store";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

async function main(): Promise<void> {
  redis.clear();
  const owner = "exit@example.com";
  await claimHandle(owner, "exitshop", "Exit Shop", "");
  await ensureStatsId(owner);
  is("none on a new store", (await storeForEmail(owner))!.exitOffer, null);

  const paid = await addProduct(owner, "Course", "", "49", null);
  const free = await addProduct(owner, "Free checklist", "", "0", null);
  if (!paid.ok || !free.ok) throw new Error("no products");

  part("Choosing");
  const refused = await setExitOffer(owner, paid.product.id);
  is("not something paid", refused.ok ? "saved" : refused.reason, "not_free");
  const unknown = await setExitOffer(owner, "nothing00");
  is("not something that is not there", unknown.ok ? "saved" : unknown.reason, "unknown");
  const chosen = await setExitOffer(owner, free.product.id);
  is("something free", chosen.ok ? chosen.store.exitOffer : null, free.product.id);
  await setProductHidden(owner, free.product.id, true);
  const draft = await setExitOffer(owner, free.product.id);
  is("not a draft", draft.ok ? "saved" : draft.reason, "not_free");

  part("Switching off");
  const off = await setExitOffer(owner, null);
  is("off", off.ok ? off.store.exitOffer : "failed", null);

  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
