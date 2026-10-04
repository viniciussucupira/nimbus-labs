/**
 * One ladder, and nothing quietly overriding it.
 *
 * Two things were wrong, and the second only showed up under measurement.
 *
 * The ladder had a hole. .t-h2 is 30px on a phone and 44px on a desktop,
 * .t-h3 is 19.2px and 23.2px, and there was nothing in between: a jump of
 * 1.9× on a desktop where every other step on this ladder is about 1.2×.
 * Fourteen section headings across the inner pages had tried to fill it by
 * writing `t-h3 text-[1.5rem]` or `t-h3 text-[1.6rem]`.
 *
 * And none of those worked. Loaded at 375 points wide, every one of those
 * headings reported 19.2px — .t-h3's own minimum. The class is defined after
 * Tailwind's utilities, so the class wins and the arbitrary size beside it had
 * never once applied. Fourteen pieces of dead markup that read as a decision:
 * anybody maintaining the page would believe those headings were 24px, and
 * anybody changing the number would watch nothing happen.
 *
 * So the hole is now a step of its own, .t-section, fluid like the rest, and
 * these hold the two rules that keep it that way: the ladder stays whole, and
 * nothing sits beside one of its rungs pretending to change it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
/** The rungs: a class that sets a font size, so a size beside one is dead. */
const RUNGS = ["t-display", "t-h1", "t-h2", "t-section", "t-h3", "t-lead", "t-small", "t-tiny"];

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

/** The two ends of a clamp(min, …, max), in rem. */
function rung(cls: string): { min: number; max: number } {
  const at = CSS.indexOf(`.${cls} {`);
  assert.ok(at > 0, `.${cls} should exist`);
  const block = CSS.slice(at, CSS.indexOf("}", at));
  const clamped = block.match(/font-size:\s*clamp\(([\d.]+)rem,[^,]+,\s*([\d.]+)rem\)/);
  if (clamped) return { min: Number(clamped[1]), max: Number(clamped[2]) };
  const flat = block.match(/font-size:\s*([\d.]+)rem/);
  assert.ok(flat, `.${cls} needs a font size`);
  return { min: Number(flat[1]), max: Number(flat[1]) };
}

test("the ladder goes down in order, with no rung out of place", () => {
  const sizes = RUNGS.map((c) => ({ c, ...rung(c) }));
  for (let i = 1; i < sizes.length; i += 1) {
    assert.ok(
      sizes[i].max < sizes[i - 1].max,
      `.${sizes[i].c} (${sizes[i].max}rem) is not smaller than .${sizes[i - 1].c} (${sizes[i - 1].max}rem)`,
    );
    assert.ok(sizes[i].min <= sizes[i - 1].min, `.${sizes[i].c} starts above the rung over it on a phone`);
  }
});

test("no step on the ladder is a jump, which is the hole .t-section filled", () => {
  // Every rung within about a third of the one above it. The gap between
  // .t-h2 and .t-h3 used to be 1.9× on a desktop, and fourteen headings tried
  // to paper over it with a fixed size that never applied.
  const sizes = RUNGS.map((c) => ({ c, ...rung(c) }));
  for (let i = 1; i < sizes.length; i += 1) {
    const ratio = sizes[i - 1].max / sizes[i].max;
    assert.ok(
      ratio <= 1.75,
      `.${sizes[i - 1].c} is ${ratio.toFixed(2)}× .${sizes[i].c} on a desktop. A reader cannot see a relationship ` +
        "across a gap that size, and whoever writes the next page will fill it with a one-off number.",
    );
  }
});

test("every rung scales with the screen, except the two that are body copy", () => {
  for (const cls of RUNGS) {
    const at = CSS.indexOf(`.${cls} {`);
    const block = CSS.slice(at, CSS.indexOf("}", at));
    if (cls === "t-small" || cls === "t-tiny") {
      assert.doesNotMatch(block, /clamp\(/, `.${cls} is body copy and holds one size on purpose`);
      continue;
    }
    assert.match(block, /font-size:\s*clamp\(/, `.${cls} should be fluid: a heading fixed in rem is wrong at one end or the other`);
  }
});

test("nothing sits beside a rung pretending to change its size", () => {
  // This is the defect that was invisible: the rung is defined after
  // Tailwind's utilities, so it wins, and the arbitrary size next to it is
  // dead markup that reads as a decision. Measured at 375px, every one of the
  // fourteen `t-h3 text-[1.5rem]` headings was 19.2px — .t-h3's own minimum.
  const dead: string[] = [];
  for (const file of walk("app").concat(walk("components"))) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = m[1] ?? m[2] ?? "";
      const onRung = RUNGS.find((c) => new RegExp(`(?:^|[\\s\`{])${c}(?:$|[\\s\`}])`).test(classes));
      if (!onRung) continue;
      // A size at a breakpoint is a deliberate second size, not a dead one.
      const size = classes.match(/(?:^|\s)text-\[[\d.]+rem\]/);
      if (!size) continue;
      const where = src.slice(0, m.index).split("\n").length;
      dead.push(`${file}:${where} → .${onRung} with ${size[0].trim()}`);
    }
  }
  assert.deepEqual(
    dead,
    [],
    "the class wins and this size never applies. Use the rung that is the size you want, or add one.",
  );
});

test("no two type sizes are too close for a reader to tell apart", () => {
  // 0.9375rem and 0.95rem differ by a fifth of a pixel. Two sizes nobody can
  // distinguish are not a distinction, they are the ladder coming apart —
  // which is what six stray 0.95rem and one 0.7rem were doing.
  const found = new Set<number>();
  for (const file of walk("app").concat(walk("components"))) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    for (const m of src.matchAll(/text-\[([\d.]+)rem\]/g)) found.add(Number(m[1]));
  }
  const sizes = [...found].sort((a, b) => a - b);
  const tooClose: string[] = [];
  for (let i = 1; i < sizes.length; i += 1) {
    const apartPx = (sizes[i] - sizes[i - 1]) * 16;
    if (apartPx < 0.9) tooClose.push(`${sizes[i - 1]}rem and ${sizes[i]}rem (${apartPx.toFixed(2)}px apart)`);
  }
  assert.deepEqual(tooClose, [], "pick whichever of the two the rest of the page already uses");
});

test("the inner pages use the step rather than a number of their own", () => {
  const topic = readFileSync(join(process.cwd(), "components/topic-page.tsx"), "utf8");
  assert.match(topic, /t-section/, "topic-page renders every /platform and /for page: it is where this mattered most");
  for (const file of ["components/topic-page.tsx", "app/help/page.tsx", "app/blog/[slug]/page.tsx", "components/legal-page.tsx", "components/blog-browser.tsx"]) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    assert.doesNotMatch(src, /t-h3 text-\[/, `${file} should take a rung, not override one`);
  }
});
