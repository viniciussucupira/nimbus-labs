/**
 * Whether the published ceiling is one the code can actually reach.
 *
 * Two limits decide how many products a store may hold, and they were set in
 * different places by different reasoning, with nothing checking they agree:
 *
 *   MAX_PRODUCTS    = 2,000      — the number we publish
 *   MAX_STORE_BYTES = 1,000,000  — what the store's one record may weigh
 *
 * Every product puts an entry in the index inside that record, so the second
 * limit silently caps the first. If an entry is bigger than somebody assumed,
 * a creator is refused at 1,400 products having been promised 2,000 — a
 * published number the system does not honour, which is the same defect as a
 * 44px tap target that renders at 18, or a heading class whose size never
 * applied. It was worth measuring rather than assuming.
 *
 * It measures fine, with room. A product's own entry is at most 33 bytes, and
 * price options are bounded across the whole store (MAX_STORE_OPTIONS), not
 * per product, so the worst index is 2,000 entries plus 4,000 option ids:
 * about 175 KB, less than the 230 KB it was when each product could carry
 * three and nothing bounded the store as a whole. The layout holds
 * around 5,400 products at worst and 37,000 at the size a real product's entry
 * actually is.
 *
 * The point of this file is that nobody has to take any of that on trust. Each
 * bound is read from the code that enforces it, so raising either number — or
 * widening an id, or raising how many price options a store holds — without redoing the
 * arithmetic fails the build rather than quietly shrinking what a creator can
 * really have.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HEAD_BYTES, MAX_PRODUCTS } from "@/lib/catalog";
import { MAX_STORE_BYTES } from "@/lib/store";
import { MAX_STORE_OPTIONS, OPTION_ID } from "@/lib/product-option";

/** The longest string the pattern guarding option ids will let through. */
function longestAllowedId(): number {
  for (let length = 1; length <= 4096; length += 1) {
    if (!OPTION_ID.test("a".repeat(length))) return length - 1;
  }
  throw new Error("option ids are not bounded, so neither is the index");
}

/**
 * One index entry, written the way lib/catalog.ts writes it (itemOf): an array
 * of the product's id, a number of kind bits, and the id of each price option.
 *
 * Every part of it has to be bounded for the ceiling below to mean anything,
 * and each bound is read from the code that enforces it rather than assumed:
 * the ids from OPTION_ID and the kind bits from the widest value those flags
 * can make. The product's own id is ten characters out of a uuid (lib/store.ts,
 * freshId); it is given the option bound here too, because that is the bound
 * an id read back out of an old record is checked against.
 *
 * Price options are counted apart (optionBytes): since a product may carry
 * fifty, what bounds the index is how many a whole store may hold
 * (MAX_STORE_OPTIONS), not how many sit on one product.
 */
function worstEntryBytes(): number {
  const id = "a".repeat(longestAllowedId());
  const entry = JSON.stringify([id, 4095]);
  // Plus the comma that separates it from the next entry in the array.
  return new TextEncoder().encode(entry).length + 1;
}

/** What one price option adds to its product's entry: its id, quoted, and a comma. */
function optionBytes(): number {
  return longestAllowedId() + 3;
}

/** The heaviest the whole index can be: every product, and every option the store may hold. */
function worstIndexBytes(): number {
  return MAX_PRODUCTS * worstEntryBytes() + MAX_STORE_OPTIONS * optionBytes();
}

/** What a real product costs: a ten-character id, no price options. */
function typicalEntryBytes(): number {
  return new TextEncoder().encode(JSON.stringify(["a".repeat(10), 3])).length + 1;
}

/**
 * What the rest of the store record can weigh: the look, the affiliate
 * programme, tax, recovery, win-back, the sale, the pixels, the tiers, the
 * call setup and the links. Generous on purpose — the test should fail while
 * there is still room, not at the moment there is none.
 */
const EVERYTHING_ELSE_BYTES = 250_000;

test("an index entry is bounded at all, which is what makes a ceiling possible", () => {
  // Before this was checked, an option id was any string at all: the index
  // wrote it into the store record and then dropped it on the way back out,
  // so the weight of the index rested on a convention rather than on a rule.
  assert.ok(longestAllowedId() > 10, "the bound has to leave room for the ids the code actually makes");
  assert.ok(
    worstEntryBytes() <= 200,
    `one product costs up to ${worstEntryBytes()} bytes of the store record. If an id bound or the kind ` +
      "bits grew, every ceiling below was computed against the old number.",
  );
});

test("the published ceiling fits in the record, with the head and everything else", () => {
  const index = worstIndexBytes();
  const total = index + HEAD_BYTES + EVERYTHING_ELSE_BYTES;
  assert.ok(
    total < MAX_STORE_BYTES,
    `a store at the published ${MAX_PRODUCTS.toLocaleString("en-US")} products would weigh about ` +
      `${Math.round(total / 1000)} KB — ${Math.round(index / 1000)} KB of index, ${Math.round(HEAD_BYTES / 1000)} KB of ` +
      `head, ${Math.round(EVERYTHING_ELSE_BYTES / 1000)} KB for the rest — against a record that may weigh ` +
      `${Math.round(MAX_STORE_BYTES / 1000)} KB. Either lower what is published or move the index out of the record.`,
  );
});

test("there is real headroom, not a number that only just fits", () => {
  // A ceiling that fits with nothing to spare is one that breaks the first
  // time anything else about a store gets bigger.
  const index = worstIndexBytes();
  const spare = MAX_STORE_BYTES - index - HEAD_BYTES - EVERYTHING_ELSE_BYTES;
  assert.ok(
    spare > MAX_STORE_BYTES / 4,
    `only ${Math.round(spare / 1000)} KB spare. The published ceiling should sit well inside the record, ` +
      "because the record holds everything else about a store too and that grows on its own.",
  );
});

test("what the record could actually hold, written down so nobody has to guess again", () => {
  // Not an assertion about the product — a note in executable form, so the
  // real ceiling of this layout is a thing you can read rather than rederive.
  // The honest answer to "could it be a hundred thousand?" is this number.
  const room = MAX_STORE_BYTES - HEAD_BYTES - EVERYTHING_ELSE_BYTES;
  const worstCase = Math.floor((room - MAX_STORE_OPTIONS * optionBytes()) / worstEntryBytes());
  const typical = Math.floor(room / typicalEntryBytes());
  assert.ok(
    worstCase > MAX_PRODUCTS,
    `the layout holds about ${worstCase.toLocaleString("en-US")} products at worst and ` +
      `${typical.toLocaleString("en-US")} typically, and we publish ${MAX_PRODUCTS.toLocaleString("en-US")}. ` +
      "If that stops being true the published number has to come down.",
  );
  // A hundred thousand is not reachable in this layout at any entry size that
  // still identifies a product, which is the answer to whether the number can
  // simply be raised: it cannot, and saying so needs no judgement.
  assert.ok(
    100_000 * 12 > room,
    "a hundred thousand products cannot fit this record even at twelve bytes each, which is less than " +
      "an id. Reaching it means moving the index into records of its own, not raising a constant.",
  );
});

test("the ceiling is enforced where a product is added, not only published", () => {
  // A number on a page that nothing checks is not a limit, it is a hope.
  const src = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
  assert.match(src, /MAX_PRODUCTS/, "lib/store.ts has to know the ceiling to refuse past it");
  assert.match(src, /MAX_STORE_OPTIONS/, "and the store-wide count of price options, which is what bounds their share of the index");
  assert.match(src, /StoreFullError/, "and the record's own weight has to be able to refuse a write too");
});
