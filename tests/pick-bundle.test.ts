/**
 * A bundle its buyer builds (lib/bundle-rules.ts, picks; added 10 October
 * 2026): "any 3 of these 8". Checked:
 *
 *   - how many a buyer chooses is a whole number from 2, and fewer than the
 *     bundle holds;
 *   - it is sold while it can hand over at least that many;
 *   - only exactly that many different products from its own list count as
 *     a choice, kept in the bundle's order;
 *   - it is never a box at checkout, an offer after paying, a gift, a
 *     purchase for several people or a PayPal sale.
 */
import { MIN_PICK, bundleReady, chosenItems, parsePick, pickProblem, picks } from "@/lib/bundle-rules";
import { canGift } from "@/lib/gift-rules";
import { canGroup } from "@/lib/group-rules";
import { bumpTargetPause } from "@/lib/product-extras";
import { sellsWithPayPal } from "@/lib/paypal-sales";
import type { Listing } from "@/lib/store";
import { done, is, part } from "./check";

const item = (id: string, priceCents = 1900) =>
  ({ id, title: id, priceCents, recurring: null, call: null, options: [], pwyw: null, bundle: null, file: null, link: `https://example.com/${id}`, course: null, stock: null, keys: null, hidden: false }) as unknown as Listing;
const pool = ["guide01", "guide02", "guide03", "guide04"].map((id) => item(id));
const bundle = { ...item("bundle1", 4900), link: null, bundle: pool.map((p) => p.id), pick: 2 } as unknown as Listing;

async function main(): Promise<void> {
  part("How many a buyer chooses");
  is("a whole number from 2", [parsePick(2), parsePick(1), parsePick(2.5), parsePick("3"), parsePick(null)], [2, null, null, null, null]);
  is(`never fewer than ${MIN_PICK}, and fewer than the bundle holds`, [pickProblem(2, 4), pickProblem(3, 4), pickProblem(4, 4), pickProblem(1, 4), pickProblem(null, 4)], [null, null, "pick", "pick", null]);
  is("only a bundle has its buyers choose", [picks(bundle), picks({ bundle: null, pick: 2 }), picks({ ...bundle, pick: null })], [2, null, null]);
  is("sold while it can hand over enough to choose from", [bundleReady(bundle, 4), bundleReady(bundle, 2), bundleReady({ ...bundle, pick: 3 } as Listing, 2), bundleReady({ ...bundle, pick: null } as Listing, 2)], [true, true, false, true]);

  part("What counts as a choice");
  is("exactly that many, from its list, in its order", chosenItems(pool, ["guide03", "guide01"], 2)?.map((p) => p.id), ["guide01", "guide03"]);
  is("never one too few or too many", [chosenItems(pool, ["guide01"], 2), chosenItems(pool, ["guide01", "guide02", "guide03"], 2)], [null, null]);
  is("never the same one twice", chosenItems(pool, ["guide01", "guide01"], 2), null);
  is("never one that is not in it", chosenItems(pool, ["guide01", "other99"], 2), null);
  is("nor anything that is not an id", chosenItems(pool, ["guide01", "../x"], 2), null);

  part("Bought from its own page only");
  is("not a box at checkout, nor an offer after paying", bumpTargetPause(bundle), "targetPick");
  is("not a gift, nor for several people", [canGift(bundle), canGroup(bundle)], [false, false]);
  is("not through PayPal", sellsWithPayPal(bundle), false);
  is("a bundle that hands over everything still is all of those", [bumpTargetPause({ ...bundle, pick: null } as Listing), canGift({ ...bundle, pick: null } as Listing), sellsWithPayPal({ ...bundle, pick: null } as Listing)], [null, true, true]);

  done();
}

void main();
