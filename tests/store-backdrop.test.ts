/**
 * What lies behind a store's cards (lib/store-look.ts, BACKDROPS; added 9
 * October 2026). Checked: plain on every store saved before, and on anything
 * that is not one of the five; each draws from the page's own colors only,
 * at a low strength; only the aurora moves.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKDROPS, backdropClass, backdropStyle, lookStyle, parseLook } from "@/lib/store-look";

test("plain unless one of the five is picked", () => {
  assert.equal(parseLook({ theme: "sand" }).backdrop, "plain");
  assert.equal(parseLook({ backdrop: "video" }).backdrop, "plain");
  assert.equal(parseLook({ backdrop: "dots" }).backdrop, "dots");
  assert.deepEqual(BACKDROPS.map((b) => b.id), ["plain", "glow", "dots", "grid", "aurora"]);
});

test("each is drawn from the page's own colors, never a file", () => {
  for (const { id } of BACKDROPS) {
    const style = backdropStyle(id);
    const drawn = style["--st-backdrop"] ?? "";
    assert.ok(!/url\(/.test(drawn), id);
    if (id !== "plain") assert.match(drawn, /var\(--st-(accent|text|accent-2)\)/, id);
  }
  assert.deepEqual(backdropStyle("plain"), {});
});

test("only the aurora moves", () => {
  assert.deepEqual(BACKDROPS.filter((b) => backdropStyle(b.id)["--st-backdrop-play"] === "running").map((b) => b.id), ["aurora"]);
});

test("a page's style carries it", () => {
  assert.ok(lookStyle({ theme: "light", accent: "#5a36ee", backdrop: "glow" })["--st-backdrop"]);
  assert.equal(lookStyle({ theme: "light", accent: "#5a36ee" })["--st-backdrop"], undefined);
  assert.equal(backdropClass({ backdrop: "grid" }), "st-bg-grid");
});
