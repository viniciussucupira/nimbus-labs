/**
 * The column that would not shrink, and cut the headline off.
 *
 * Measured on the live /platform and /for pages at 375 points wide. The hero's
 * implicit grid column computed to 409.663px inside a container whose content
 * box is 342.69px — 67 pixels of column that does not exist. The heading and
 * the lead paragraph were laid out to that width, ran off the right of the
 * screen, and the section's own `overflow-hidden` cut the words at the screen
 * edge rather than letting them wrap. The page did not scroll sideways, so
 * every test that looks for a scrollbar said the page was fine.
 *
 * The cause is one CSS default. A grid item is `min-width: auto`, which means
 * it cannot be narrower than the widest thing inside it, and the illustration
 * in the right-hand column is built from truncating rows and nowrap badges
 * that add up to 410px: 368px of row, 40px of padding, 2px of border. The
 * column grew to fit the drawing, and took the words with it.
 *
 * Every row in those drawings already carried `min-w-0 flex-1 truncate`. They
 * were written to shrink and no ancestor was willing to make them. So the fix
 * is three `min-w-0`s — the two hero columns, the frame the mockups sit in,
 * and the lists inside it — and the whole hero then measures 342.9px with
 * nothing clipped anywhere.
 *
 * This is the kind of defect that survives any amount of reading, because
 * every individual class is right. It only shows up when something measures
 * the real page at the width a phone actually has.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const topic = readFileSync(join(process.cwd(), "components/topic-page.tsx"), "utf8");
const visuals = readFileSync(join(process.cwd(), "components/feature-visuals.tsx"), "utf8");

test("both hero columns may shrink, or the drawing decides how wide the words are", () => {
  const at = topic.indexOf("lg:grid-cols-[1.05fr_0.95fr]");
  assert.ok(at > 0, "the hero grid should still be here");
  // Both children of that grid: the text column opens immediately, the column
  // with the illustration comes after the heading, lead, badges and buttons.
  const hero = topic.slice(at, at + 3_600);
  assert.match(
    hero,
    /min-w-0 \$\{light \? "" : "on-dark"\}/,
    "the text column needs min-w-0: it is the one that was being dragged to 410px",
  );
  assert.match(
    hero,
    /flex min-w-0 justify-center lg:justify-end/,
    "and so does the column holding the illustration, which is where the 410px comes from",
  );
});

test("the reason is written down beside it, because every class in it looks correct", () => {
  const at = topic.indexOf("lg:grid-cols-[1.05fr_0.95fr]");
  const before = topic.slice(Math.max(0, at - 900), at);
  assert.match(before, /min-width:auto/, "the comment has to name the default that causes it");
  assert.match(before, /409\.663px/, "and the measurement, so nobody has to take it on trust");
});

test("the frame the mockups sit in can shrink, and so can its lists", () => {
  const at = visuals.indexOf("function Window(");
  assert.ok(at > 0, "Window should still be the frame");
  const body = visuals.slice(at, at + 400);
  assert.match(body, /className="min-w-0 overflow-hidden/, "the frame itself");
  // The rows were always ready to truncate; nothing was pressing them.
  const lists = [...visuals.matchAll(/<ul className="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(lists.length > 0, "the visuals should still have lists");
  for (const cls of lists) {
    assert.match(cls, /\bmin-w-0\b/, `a list inside a mockup needs min-w-0, not: ${cls}`);
  }
});

test("the rows inside a mockup are built to truncate, which is what makes shrinking safe", () => {
  // If these ever stop truncating, min-w-0 stops being enough and the text
  // starts overflowing the frame instead of the frame overflowing the screen.
  assert.match(
    visuals,
    /min-w-0 flex-1 truncate/,
    "a mockup row that cannot truncate will overflow its own frame once the frame is allowed to shrink",
  );
});

test("nothing in the hero hides an overflow instead of preventing one", () => {
  // The section keeps overflow-hidden — it is there for the background
  // treatment — so the only thing standing between a too-wide child and a
  // silently cut headline is the min-w-0 above. That is worth stating.
  const at = topic.indexOf("lg:grid-cols-[1.05fr_0.95fr]");
  const section = topic.slice(Math.max(0, at - 1_600), at);
  assert.match(section, /overflow-hidden/, "the section still clips, which is why the column must be right");
});
