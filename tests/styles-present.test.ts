/**
 * Every class the pages use must exist in the stylesheet.
 *
 * Written after shipping a site whose every button, card and link had no
 * styling at all. An edit to globals.css deleted 412 lines — the whole
 * button, card and link system — while removing something else nearby.
 * TypeScript was clean, the linter was clean, all 25 tests passed and the
 * build succeeded, because a missing CSS class is not an error anywhere:
 * the markup still renders, the class simply does nothing. It took
 * looking at the published page to see it.
 *
 * This is the cheap check that would have caught it in a second.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Hand-written classes the markup relies on; Tailwind's own are not ours to check. */
const OURS =
  /\b(btn|btn-[a-z-]+|card|card-flat|card-hover|link|link-arrow|panel-dark|icon-tile|icon-tile-sm|tag|tag-[a-z]+|chip|chip-dark|eyebrow|measure|measure-wide|balance|pretty|container-page|container-narrow|section|section-tight|surface-[a-z]+|device|device-screen|marquee|marquee-track|pulse-dot|nb-swap|nb-pop|nb-fade-up|reveal|seg|seg-item|spinner|t-display|t-h1|t-h2|t-h3|t-lead|serif|rule-soft|nb-grid-lines|on-dark)\b/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test("every class the markup uses is defined in the stylesheet", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const defined = new Set(
    [...css.matchAll(/^\s*\.([a-zA-Z][\w-]*)/gm)].map((m) => m[1]),
  );

  const missing = new Map<string, string>();
  for (const file of [...walk(join(process.cwd(), "app")), ...walk(join(process.cwd(), "components"))]) {
    const src = readFileSync(file, "utf8");
    for (const [name] of src.matchAll(OURS)) {
      if (!defined.has(name) && !missing.has(name)) {
        missing.set(name, file.replace(process.cwd() + "/", ""));
      }
    }
  }

  assert.equal(
    missing.size,
    0,
    `These classes are used but not defined in app/globals.css:\n${[...missing]
      .map(([name, file]) => `  .${name} — first used in ${file}`)
      .join("\n")}`,
  );
});
