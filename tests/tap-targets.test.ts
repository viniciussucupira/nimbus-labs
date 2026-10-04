/**
 * Everything a thumb has to find is at least 44 pixels tall.
 *
 * This was measured, not assumed. Every page was loaded at 375 points wide —
 * the narrowest phone still in use — and every link, button, summary, input
 * and select on it was asked for its real height. The answers were not close
 * to 44: pills and tabs at 40, a "Reply" disclosure at 24, the quiet text
 * links the whole community runs on at 18, a store footer's links at 36, the
 * logo at 40.
 *
 * Nearly all of it turned out to be eight rules in app/globals.css rather than
 * two hundred places in the markup, which is the way a design system is
 * supposed to fail: once, where it is defined. So the floor is checked there.
 *
 * Two things this deliberately does not require.
 *
 * A link inside a sentence keeps the line's own height. WCAG exempts it, and
 * it is right to: a 44px box around three words in the middle of a paragraph
 * tears the paragraph apart. "By continuing you agree to the Terms" is one
 * sentence, and the link in it is text, not a control.
 *
 * A badge is not a button. A row of status pills reading "Card", "PayPal",
 * "Apple Pay" is type, and type set 44px tall to satisfy a rule about fingers
 * is simply wrong-looking. Those keep their own height, and say in a comment
 * beside them that they are not pressed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FLOOR = 44;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...walk(rel));
    else if (rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

test("no rule in the stylesheet sets a control shorter than a thumb", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const short: string[] = [];
  // Which rule a line belongs to, so a failure names the class to fix.
  let selector = "";
  for (const line of css.split("\n")) {
    const open = line.match(/^([.#:a-zA-Z][^{]*)\{\s*$/);
    if (open) selector = open[1].trim();
    const m = line.match(/min-height:\s*(\d+)px/);
    if (m && Number(m[1]) > 0 && Number(m[1]) < FLOOR) short.push(`${selector || "?"} → ${m[1]}px`);
  }
  assert.deepEqual(
    short,
    [],
    "a class used by a control is where a short tap target reaches every page at once. " +
      "If one of these is type rather than a control, give it a height in the markup with a comment, not here.",
  );
});

test("nothing in the markup pins an interactive element shorter than a thumb", () => {
  const bad: string[] = [];
  // A number that is a Tailwind step (min-h-6) rather than pixels.
  const step = /\bmin-h-(\d{1,2})\b/;
  const pixels = /\bmin-h-\[(\d{1,3})px\]/;
  const PRESSED = /onClick=|htmlFor=|type="(?:button|submit)"|href=|role="button"|cursor-pointer|<summary/;

  for (const file of walk("app").concat(walk("components"))) {
    const lines = readFileSync(join(process.cwd(), file), "utf8").split("\n");
    lines.forEach((line, i) => {
      const s = line.match(step);
      const p = line.match(pixels);
      const px = p ? Number(p[1]) : s ? Number(s[1]) * 4 : 0;
      if (!px || px >= FLOOR) return;
      // A badge is type, not a control: it keeps its height. What makes that a
      // decision rather than an oversight is the element not being pressed.
      const near = lines.slice(Math.max(0, i - 3), i + 3).join("\n");
      if (!PRESSED.test(near)) return;
      bad.push(`${file}:${i + 1} → ${px}px`);
    });
  }
  assert.deepEqual(bad, [], "an element somebody presses, set shorter than 44px");
});

test("a text link given the 44px box is also told to centre its text in it", () => {
  // min-h on its own only grows the box downward: the words stay at the top
  // and the control looks broken. Every one of these needs a display that
  // honours align-items, which is the mistake this caught across a dozen
  // buttons that already had the right height and looked wrong anyway.
  const bad: string[] = [];
  for (const file of walk("app").concat(walk("components"))) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = m[1] ?? m[2] ?? "";
      if (!/\bmin-h-(?:11|12|14|\[4[4-9]px\]|\[5\d px\])/.test(classes)) continue;
      // A field, a textarea and a block of prose lay themselves out.
      if (/\b(?:field|st-field|textarea|block|grid|table)\b|file:/.test(classes)) continue;
      if (/\b(?:inline-)?flex\b/.test(classes)) continue;
      if (/\bitems-(?:start|center|end|baseline)\b/.test(classes)) continue;
      const where = src.slice(0, m.index).split("\n").length;
      bad.push(`${file}:${where} → ${classes.slice(0, 56)}`);
    }
  }
  assert.deepEqual(bad, [], "a 44px minimum with nothing to centre the label in it leaves the words at the top of an empty box");
});

test("the classes the community is built from clear the floor", () => {
  // Named so a failure points at the thing that broke rather than a line
  // number: these eight are most of the pressable surface of every community
  // page, and the measurement found every one of them short.
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  for (const cls of ["cm-pill", "cm-chip", "cm-tab", "cm-side", "cm-mini", "cm-menu-item", "cm-poll-row", "cm-search", "cm-quiet-link", "chip"]) {
    const at = css.indexOf(`.${cls} {`);
    assert.ok(at > 0, `.${cls} should still exist`);
    const block = css.slice(at, css.indexOf("}", at));
    const m = block.match(/min-height:\s*(\d+)px/);
    assert.ok(m, `.${cls} needs a height of its own: without one it is as tall as its text, which is about eighteen pixels`);
    assert.ok(Number(m[1]) >= FLOOR, `.${cls} is ${m[1]}px`);
  }
});

test("a quiet text link carries a box, because none of them sits in a sentence", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const at = css.indexOf(".cm-quiet-link {");
  const block = css.slice(at, css.indexOf("}", at));
  assert.match(block, /display:\s*inline-flex/, "or the min-height does nothing at all");
  assert.match(block, /align-items:\s*center/, "and the words sit at the top of it");
});
