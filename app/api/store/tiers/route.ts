import type { NextRequest } from "next/server";
import { setStoreTiers, storeForEmail } from "@/lib/store";
import { readListings } from "@/lib/catalog";
import { guardStoreWrite } from "@/lib/store-request";
import { MAX_TIERS, MIN_TIERS, canTier } from "@/lib/tier-rules";

/**
 * Sets the memberships members can switch between (lib/tier-rules.ts):
 * `{ tiers: [id, …] }`, 2 to 6 of the store's memberships that run until
 * canceled, at one price. Fewer than two switches it off. Memberships already
 * switched keep the tier they are on either way.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings");
  if (!guarded.ok) return guarded.response;
  const fail = (error: string) => Response.json({ ok: false, error }, { status: 400 });
  const store = await storeForEmail(guarded.ref);
  if (!store) return fail("none");
  const asked = Array.isArray(guarded.body.tiers) ? guarded.body.tiers.filter((id): id is string => typeof id === "string").slice(0, 40) : [];
  const ids = [...new Set(asked)];
  if (ids.length === 1 || ids.length > MAX_TIERS) return fail("count");
  const listed = ids.length ? await readListings(store, ids) : [];
  if (listed.length !== ids.length || !listed.every(canTier)) return fail("tier");
  const result = await setStoreTiers(guarded.ref, ids.length >= MIN_TIERS ? ids : []);
  return result.ok ? Response.json({ ok: true, tiers: result.store.tiers }) : fail(result.reason);
}
