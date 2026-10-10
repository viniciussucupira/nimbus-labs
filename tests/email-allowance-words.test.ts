/**
 * The number of emails a month a page promises has to be the number the code
 * sends.
 *
 * Pro's allowance was lowered from fifty thousand to twenty-five thousand so
 * that the plan could not run at a loss (lib/plan.ts). The limit moved; six
 * sentences did not. The email page, the comparison with Stan, the help page,
 * the studio's own counter and the Terms of Service all went on promising
 * fifty thousand while a store was stopped at twenty-five — on the Terms, in
 * the paragraph that says what a subscription buys.
 *
 * They were typed, and a typed number is right only on the day it is typed.
 * Now each one is read from PRO_MONTHLY_EMAILS and TRIAL_MONTHLY_EMAILS, and
 * this fails the build if a figure for emails a month is ever typed again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRO_MONTHLY_EMAILS, TRIAL_MONTHLY_EMAILS } from "@/lib/plan";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...walk(rel));
    else if (rel.endsWith(".ts") || rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

/** Comments may name the old number, to say what changed; pages may not. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** A figure typed next to "emails" and "a month": "50,000 emails a month", "sends up to 50,000 a month". */
const TYPED = /\b\d{1,3}(?:,\d{3})+\s+(?:emails\s+)?a month\b|\bfull\s+\d{1,3}(?:,\d{3})+\s+opens\b|\bmonth holds\s+\d{1,3}(?:,\d{3})+/g;

test("no page types a number of emails a month", () => {
  const found: string[] = [];
  for (const file of [...walk("app"), ...walk("components"), ...walk("lib")]) {
    // The limit itself, and the sender's own plan, are stated where they are set.
    if (file === "lib/plan.ts" || file === "lib/mail.ts") continue;
    const text = withoutComments(readFileSync(join(process.cwd(), file), "utf8"));
    for (const match of text.match(TYPED) ?? []) found.push(`${file}: "${match}"`);
  }
  assert.deepEqual(
    found,
    [],
    "a month's emails are PRO_MONTHLY_EMAILS and TRIAL_MONTHLY_EMAILS (lib/plan.ts). A figure typed into a " +
      "sentence stays behind when the limit moves, and the page goes on promising what the code no longer sends.",
  );
});

test("the pages that state the allowance read it from the limit", () => {
  for (const file of ["lib/feature-pages.ts", "lib/site-pages.ts", "app/terms/page.tsx", "lib/help-content.ts", "components/email-studio.tsx"]) {
    assert.match(readFileSync(join(process.cwd(), file), "utf8"), /PRO_MONTHLY_EMAILS/, `${file} states Pro's emails a month`);
  }
});

test("the two numbers are the ones the margin was worked out against", () => {
  // tests/plan-margin.test.ts holds the arithmetic; this holds the order.
  assert.ok(TRIAL_MONTHLY_EMAILS < PRO_MONTHLY_EMAILS, "a trial sends less than the plan it is a trial of");
});
