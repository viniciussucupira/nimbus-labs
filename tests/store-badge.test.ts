/**
 * "Made with Marktmorgen", and who may take it off.
 *
 * The badge at the foot of a creator's page is how a store brings us the
 * next creator, so removing it is sold rather than given — it is the third
 * thing Pro switches on, beside email and a custom domain.
 *
 * Two ways that could go wrong, and both are quiet. A store could keep the
 * badge off after it stops paying for Pro, which is revenue walking out of
 * the door one store at a time and nothing anywhere would say so. Or the
 * setting could be writable by a store without the feature, which would
 * leave a creator looking at a switch they had turned off and a page that
 * still carried our name. These hold both shut.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOOK, parseLook } from "@/lib/store-look";
import { canUse } from "@/lib/plan";

const pro = { subscriptionActive: true, tier: "pro" as const };
const creator = { subscriptionActive: true, tier: "creator" as const };
const lapsed = { subscriptionActive: false, tier: "pro" as const };

/** What app/[handle]/page.tsx decides, every time the page is drawn. */
function badgeShows(store: { subscriptionActive: boolean; tier: "creator" | "pro" }, badge: boolean) {
  return badge || !canUse(store, "branding");
}

test("the badge is on until somebody turns it off", () => {
  assert.equal(DEFAULT_LOOK.badge, true);
  assert.equal(parseLook(null).badge, true, "a store with no look saved yet shows it");
  assert.equal(parseLook({}).badge, true, "so does a store saved before this field existed");
  assert.equal(parseLook({ badge: "no" }).badge, true, "and anything that is not an explicit false");
  assert.equal(parseLook({ badge: false }).badge, false);
});

test("only a paying Pro store can take it off", () => {
  assert.equal(canUse(pro, "branding"), true);
  assert.equal(canUse(creator, "branding"), false);
  assert.equal(canUse(lapsed, "branding"), false, "Pro that stopped paying is not Pro");
});

test("the plan decides on every page view, not the setting alone", () => {
  assert.equal(badgeShows(pro, false), false, "Pro, asked for off: gone");
  assert.equal(badgeShows(pro, true), true, "Pro, not asked: still there");

  // The one that matters: the setting stays false, the badge comes back.
  assert.equal(
    badgeShows(creator, false),
    true,
    "a store on Creator shows the badge whatever its look says",
  );
  assert.equal(
    badgeShows(lapsed, false),
    true,
    "a store that stopped paying shows the badge again from that moment, with nothing " +
      "having to go back and rewrite its settings",
  );
});

test("the choice survives the downgrade, so coming back to Pro restores it", () => {
  // Nothing in the page's decision writes to the look, so a store that comes
  // back to Pro finds the switch where it left it.
  const saved = parseLook({ theme: "night", accent: "#15803d", badge: false });
  assert.equal(badgeShows(lapsed, saved.badge), true);
  assert.equal(saved.badge, false, "the setting itself is untouched");
  assert.equal(badgeShows(pro, saved.badge), false, "and it takes effect again on Pro");
});
