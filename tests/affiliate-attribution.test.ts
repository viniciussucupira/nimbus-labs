/**
 * Which affiliate a sale belongs to.
 *
 * Two things were missing, and both of them cost a creator's affiliates money
 * that was really theirs.
 *
 * The first: a buyer who follows two affiliates' links could only ever be
 * credited to the second one, because the cookie held one click and
 * overwrote it. Hotmart has let producers choose the first click for years.
 * A creator whose affiliates do the introducing — a newsletter writer who
 * finds people months before they buy — had no way to pay the person who
 * actually found them.
 *
 * The second, and the one nobody else has: a sale with no click at all. An
 * affiliate who reads a code out on a podcast, says it from a stage, prints it
 * in a PDF or puts it in a caption that takes no links produces no cookie, so
 * the sale they made was credited to nobody. A code fixes that, and a code is
 * the one piece of tracking that survives every browser, because the buyer
 * types it themselves.
 *
 * These hold both, and hold the line that matters more than either: a code
 * never takes a sale away from the affiliate whose link was followed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_COOKIE_DAYS,
  attributionWords,
  parseAffiliateSetting,
  readViaCookie,
  viaCookieValue,
} from "@/lib/affiliate-setting";
import { PROMO_ID_PATTERN, affiliateForCodes, promoCodesOn } from "@/lib/affiliate-codes";

const DAY = 86_400;
const now = 1_767_000_000;

/** Every TypeScript file under a directory of the project, by relative path. */
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

// ---- The cookie, which now remembers both ends of the journey -------------

test("a first click is both ends of the journey", () => {
  const value = viaCookieValue(undefined, "ana", now);
  const read = readViaCookie(value);
  assert.deepEqual(read, { last: { code: "ana", at: now }, first: { code: "ana", at: now } });
});

test("a second affiliate's link moves the last click and leaves the first alone", () => {
  const first = viaCookieValue(undefined, "ana", now);
  const second = viaCookieValue(first, "bruno", now + 10 * DAY);
  assert.deepEqual(readViaCookie(second), {
    last: { code: "bruno", at: now + 10 * DAY },
    first: { code: "ana", at: now },
    // Which of the two earns it is the store's own rule, decided at the
    // checkout. The cookie only has to be able to answer either question.
  });
});

test("a third click still points back to the first", () => {
  let value = viaCookieValue(undefined, "ana", now);
  value = viaCookieValue(value, "bruno", now + DAY);
  value = viaCookieValue(value, "clara", now + 2 * DAY);
  const read = readViaCookie(value);
  assert.equal(read?.first.code, "ana");
  assert.equal(read?.last.code, "clara");
});

test("the same affiliate clicked twice is one affiliate at both ends", () => {
  const value = viaCookieValue(viaCookieValue(undefined, "ana", now), "ana", now + DAY);
  const read = readViaCookie(value);
  assert.equal(read?.first.at, now, "the first click keeps its own time, which is what the window runs from");
  assert.equal(read?.last.at, now + DAY);
});

test("a cookie written before the first click was kept still works", () => {
  // Every cookie in the wild on the day this shipped looked like this.
  const read = readViaCookie(`ana.${now}`);
  assert.deepEqual(read, { last: { code: "ana", at: now }, first: { code: "ana", at: now } });
});

test("nothing usable in the cookie is nothing, not a guess", () => {
  for (const raw of [undefined, "", "~", "ana", `ana.${now}~`, "!!.123", `${"a".repeat(30)}.${now}`]) {
    const read = readViaCookie(raw);
    if (read) assert.equal(read.last.code, "ana", `"${raw}" should not have produced a click`);
    else assert.equal(read, null);
  }
});

test("a first click dated after the last one is a cookie somebody edited", () => {
  const read = readViaCookie(`ana.${now}~bruno.${now + DAY}`);
  assert.equal(read?.first.code, "ana", "an impossible first click falls back to the real last one");
  assert.equal(read?.first.at, now);
});

// ---- The rule itself -----------------------------------------------------

test("last click is the default, and the only thing a missing rule can mean", () => {
  assert.equal(parseAffiliateSetting({}).rule, "last");
  assert.equal(parseAffiliateSetting({ rule: "" }).rule, "last");
  // Every programme written down before the rule existed was last click.
  assert.equal(parseAffiliateSetting({ enabled: true, percent: 30, days: 60 }).rule, "last");
});

test("a rule we do not have never becomes a rule we do", () => {
  for (const rule of ["multiple", "MCC", "first ", true, 1, null]) {
    assert.equal(parseAffiliateSetting({ rule }).rule, "last", `"${String(rule)}" must not be read as a rule`);
  }
  assert.equal(parseAffiliateSetting({ rule: "first" }).rule, "first");
});

test("there is no rule that splits one commission between two affiliates", () => {
  const src = readFileSync(join(process.cwd(), "lib/affiliate-setting.ts"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    code,
    /"multiple"|"mcc"/i,
    "Hotmart offers this and says in its own help pages that professional affiliates feel cheated by it: " +
      "somebody who contributed one click takes a share of the work another affiliate did. One sale, one affiliate.",
  );
});

test("the window beats what Hotmart publishes, without promising a cookie that lives for ever", () => {
  // Hotmart offers 60, 90, 180 days "or for ever". Chrome caps any cookie at
  // 400 days whatever a site asks for, so "for ever" is not a thing anybody
  // can deliver. A year, which is under the cap, is a promise that holds.
  assert.ok(MAX_COOKIE_DAYS > 180, "180 days is what the longest honest competitor offers");
  assert.ok(MAX_COOKIE_DAYS < 400, "a window past the browser's own cap would be a promise the browser breaks");
  assert.equal(MAX_COOKIE_DAYS, 365);
});

test("the sentence an affiliate reads says which rule, and counts the window from the right click", () => {
  const last = attributionWords(parseAffiliateSetting({ days: 30, rule: "last" }));
  assert.match(last, /last affiliate link/);
  assert.match(last, /30 days after that click/);

  const first = attributionWords(parseAffiliateSetting({ days: 30, rule: "first" }));
  assert.match(first, /first affiliate link/);
  assert.match(first, /after that first click/, "on first click the window runs from when the buyer was found");
  assert.match(first, /even if they follow somebody else's link later/, "and says the consequence plainly");
});

test("one day reads as a day", () => {
  assert.match(attributionWords(parseAffiliateSetting({ days: 1, rule: "last" })), /1 day after/);
});

// ---- Crediting a sale by the code the buyer typed ------------------------

const ORDER = (promo: string | null) => ({ discounts: promo ? [{ coupon: "co_x", promotion_code: promo }] : [] });
const PROMO = "promo_1QabcdefghijKLMNOP";
const OTHER = "promo_1QzzzzzzzzzzZZZZZZ";

test("the code typed into an order is read off the order", () => {
  assert.deepEqual(promoCodesOn(ORDER(PROMO)), [PROMO]);
  assert.ok(PROMO_ID_PATTERN.test(PROMO));
});

test("a discount the creator applied themselves belongs to nobody", () => {
  // A sale price and a save-offer coupon are bare coupons with no promotion
  // code: nobody typed them, so there is nobody to credit.
  assert.deepEqual(promoCodesOn({ discounts: [{ coupon: "co_sale" }] }), []);
  assert.deepEqual(promoCodesOn({ discounts: [] }), []);
  assert.deepEqual(promoCodesOn({}), []);
});

test("a promotion code arriving expanded is read the same as an id", () => {
  assert.deepEqual(promoCodesOn({ discounts: [{ promotion_code: { id: PROMO } }] }), [PROMO]);
});

test("anything that is not a promotion code id is not treated as one", () => {
  for (const bad of ["", "co_x", "promo_", "promo_short", 7, null, { nope: 1 }]) {
    assert.deepEqual(promoCodesOn({ discounts: [{ promotion_code: bad }] }), [], `"${String(bad)}" is not an id`);
  }
});

test("a code that was given to somebody credits them", () => {
  const owners = new Map([[PROMO, "a1b2c3d4e5f6"]]);
  assert.equal(affiliateForCodes(ORDER(PROMO), owners), "a1b2c3d4e5f6");
});

test("a code nobody was given credits nobody", () => {
  const owners = new Map([[OTHER, "a1b2c3d4e5f6"]]);
  assert.equal(affiliateForCodes(ORDER(PROMO), owners), "", "the creator's other codes are their own business");
  assert.equal(affiliateForCodes(ORDER(null), owners), "");
  assert.equal(affiliateForCodes(ORDER(PROMO), new Map()), "", "a store that gave none away has nothing to credit");
});

test("the click wins over the code, always", () => {
  // The order of these two in noteSession is the whole promise: a buyer who
  // followed Ana's link and then typed a code they saw on Bruno's podcast is
  // Ana's sale. Reversing it would let one affiliate take another's buyers by
  // handing out a code, which is how a programme stops being trusted.
  const src = readFileSync(join(process.cwd(), "lib/affiliates.ts"), "utf8");
  const start = src.indexOf("export async function noteSession");
  assert.ok(start > 0, "noteSession should exist");
  const body = src.slice(start, start + 3_000);
  const cookie = body.indexOf("meta.via");
  const code = body.indexOf("affiliateForCodes");
  assert.ok(cookie > 0 && code > 0, "both paths should be in noteSession");
  assert.ok(cookie < code, "the affiliate from the click has to be read, and kept, before any code is looked at");
  assert.match(
    body,
    /if \(!AFFILIATE_ID_PATTERN\.test\(aff\)\)/,
    "the code is only read when the order carries no affiliate of its own",
  );
});

test("a code only ever earns for somebody the creator approves today", () => {
  const src = readFileSync(join(process.cwd(), "lib/affiliates.ts"), "utf8");
  const start = src.indexOf("export async function noteSession");
  const body = src.slice(start, start + 3_000);
  assert.match(
    body,
    /status !== "approved"\) return/,
    "an affiliate who was declined or removed keeps their code in the record as history and earns nothing more through it",
  );
});

test("the sweep looks at codes too, or a sale with no click is never written down", () => {
  // The daily sweep is what catches a sale whose buyer never came back to the
  // thanks page. It used to skip every order without `via` in its metadata,
  // which is every order a code credited.
  const sweep = readFileSync(join(process.cwd(), "lib/checkout-sweep.ts"), "utf8");
  assert.match(sweep, /affiliateForCodes/, "the sweep must consider the code typed into an order");
  assert.match(
    sweep,
    /row\.metadata\?\.via \|\| code/,
    "and write down an order that has one even with no affiliate in its metadata",
  );
  assert.match(
    sweep,
    /await codeOwners\(store\)/,
    "reading the store's given-away codes once, not once per order",
  );
});

test("nothing about a person is stored to make any of this work", () => {
  // The code path adds no identifier, no cookie and no profile: a hash of
  // promotion code to affiliate, and the order Stripe already holds.
  const src = readFileSync(join(process.cwd(), "lib/affiliate-codes.ts"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const word of ["cookie", "fingerprint", "userAgent", "email"]) {
    assert.doesNotMatch(code, new RegExp(`\\b${word}\\b`, "i"), `lib/affiliate-codes.ts must not reach for ${word}`);
  }
});

// ---- The directory that does not exist ----------------------------------

test("directory consent is a no until the creator says otherwise", () => {
  assert.equal(parseAffiliateSetting({}).directory, false);
  for (const value of ["true", 1, "yes", {}, [], null]) {
    assert.equal(parseAffiliateSetting({ directory: value }).directory, false, "consent is given, never inferred");
  }
  assert.equal(parseAffiliateSetting({ directory: true }).directory, true);
});

test("no directory is built, only the permission to build one", () => {
  // The slow part of a cross-store directory is consent, not the page, so the
  // answer is collected now. The page is deliberately not here: a catalogue
  // with ten stores in it tells an affiliate there is nobody home.
  const studio = readFileSync(join(process.cwd(), "components/affiliate-studio.tsx"), "utf8");
  assert.match(studio, /if one opens/, "the switch has to be worded in the future tense");
  assert.match(studio, /There is no directory today/, "and say outright that nothing is published");
});

test("a directory nobody can visit is in no plan card and no comparison", () => {
  // Comparison pages may say a competitor has a marketplace and we do not —
  // that is the honest line and it is already there. What they may never do is
  // offer one of ours, or read the consent flag as though it produced a page.
  for (const file of [
    "components/home-parts.tsx",
    "app/page.tsx",
    "lib/site-pages.ts",
    "lib/feature-pages.ts",
    "lib/plan.ts",
    "lib/home-faq.ts",
  ]) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    assert.doesNotMatch(
      src,
      /affiliate directory/i,
      `${file} sells a plan. The directory does not exist, so it cannot be named there.`,
    );
    assert.doesNotMatch(
      src,
      /affiliates\.directory|setting\.directory/,
      `${file} must not read the consent flag: collecting an answer is not the same as having built the thing`,
    );
  }
});

test("nothing anywhere builds a page out of that consent yet", () => {
  // The day this changes, it should change on purpose: a public cross-store
  // listing is a different business, with duties that do not switch off again.
  const hits = walk("app")
    .concat(walk("lib"), walk("components"))
    .filter((file) => /affiliates\.directory/.test(readFileSync(join(process.cwd(), file), "utf8")));
  assert.deepEqual(hits, [], "the flag is set by the studio form and read by nothing: no page is made from it");
});
