/**
 * The list of creators who agreed to be listed, and the page that is not built.
 *
 * Yesterday's decision was to collect the consent and not build the catalogue:
 * a page with ten stores on it tells an affiliate there is nobody here, and
 * running a public marketplace brings duties toward the people in it that do
 * not switch off again. Today the question came back as "the page is a day of
 * work — shouldn't it just be ready?", and checking the answer showed the
 * claim was wrong.
 *
 * The only way to enumerate stores is `storesAfter`, a SCAN across the whole
 * keyspace in pages of two hundred keys. Fine for a nightly job. Not for a
 * page: every store carries dozens of keys of its own, so a directory built on
 * a scan would spend thousands of Redis commands on every visit, and Upstash
 * bills by the command. So the page is not a day of work — the page is a day
 * of work *after* an index exists.
 *
 * Which is the part that cannot be caught up on. A consent collected for a
 * year with nowhere recording it is a year of permissions and no list, and the
 * day the list is wanted is the worst day to be running a migration over every
 * store to rebuild it. The page, by contrast, is better not written: there is
 * not one row of real data to render, so all that could be verified is that it
 * compiles, and code nobody runs rots into a day spent twice.
 *
 * So: the index is kept in step, the figure arrives on its own, and these hold
 * the line that nothing publishes anything.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  OPEN_DIRECTORY_AT,
  directoryReadiness,
  forgetListing,
  listedCount,
  listedStores,
  rememberListing,
  wouldList,
} from "@/lib/directory-index";
import { parseAffiliateSetting } from "@/lib/affiliate-setting";
import type { Store } from "@/lib/store";

function store(sid: string, over: Record<string, unknown> = {}): Store {
  return {
    sid,
    handle: sid,
    name: `Store ${sid}`,
    affiliates: parseAffiliateSetting({ enabled: true, percent: 25, directory: true, ...over }),
  } as unknown as Store;
}

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

// ---- who would be listed ------------------------------------------------

test("consent is necessary and not sufficient", () => {
  assert.equal(wouldList(store("a")), true);
  assert.equal(wouldList(store("b", { directory: false })), false, "no consent, no row");
  assert.equal(
    wouldList(store("c", { enabled: false })),
    false,
    "a programme switched off earns an affiliate nothing, so the row would waste their click",
  );
  assert.equal(wouldList({ ...store("d"), sid: "" } as Store), false, "a store with no id cannot be listed");
});

// ---- the index, kept in step both ways ---------------------------------

test("saying yes puts a store in the list", async () => {
  await rememberListing(store("s1"));
  assert.equal(await listedCount(), 1);
});

test("saying yes twice is one store, not two", async () => {
  await rememberListing(store("s1"));
  await rememberListing(store("s1"));
  assert.equal(await listedCount(), 1, "a set, so saving the programme twice does not double the count");
});

test("saying no takes it out again, which is the half that gets forgotten", async () => {
  await rememberListing(store("s1", { directory: false }));
  assert.equal(await listedCount(), 0, "a list that only ever grows stops matching the consents behind it");
});

test("switching the whole programme off takes it out too", async () => {
  await rememberListing(store("s2"));
  assert.equal(await listedCount(), 1);
  await rememberListing(store("s2", { enabled: false }));
  assert.equal(await listedCount(), 0);
});

test("a store being deleted leaves no row behind", async () => {
  await rememberListing(store("s3"));
  await forgetListing("s3");
  assert.equal(await listedCount(), 0);
  await forgetListing("");
  await forgetListing("never-existed");
});

test("the list can be read back, or keeping it was pointless", async () => {
  await rememberListing(store("s4"));
  await rememberListing(store("s5"));
  const { sids } = await listedStores();
  assert.deepEqual(sids.sort(), ["s4", "s5"]);
  await forgetListing("s4");
  await forgetListing("s5");
});

// ---- the figure that decides -------------------------------------------

test("the threshold is a declared number, not a judgement on the day", () => {
  assert.equal(typeof OPEN_DIRECTORY_AT, "number");
  assert.ok(OPEN_DIRECTORY_AT >= 50, "below about fifty programmes there is nothing to browse");
  assert.ok(OPEN_DIRECTORY_AT <= 500, "and a figure nobody ever reaches is the same as having no answer");
});

test("below the figure it says plainly that there is nothing to do", async () => {
  const reading = await directoryReadiness();
  assert.equal(reading.listed, 0);
  assert.equal(reading.needed, OPEN_DIRECTORY_AT);
  assert.equal(reading.ready, false);
  assert.match(reading.words, /reads as an empty room/);
  assert.match(reading.words, /nothing to do here yet/);
});

test("at the figure it says the question is worth deciding, not that it is decided", async () => {
  for (let i = 0; i < OPEN_DIRECTORY_AT; i += 1) await rememberListing(store(`bulk${i}`));
  const reading = await directoryReadiness();
  assert.equal(reading.ready, true);
  assert.match(reading.words, /Nothing is published/, "reaching a number is not permission to open anything");
  assert.match(reading.words, /worth deciding/);
  for (let i = 0; i < OPEN_DIRECTORY_AT; i += 1) await forgetListing(`bulk${i}`);
});

test("the figure arrives on its own, once, and never again", () => {
  // He does not want to go and look, and a number crossed is news the first
  // morning and noise every morning after it.
  const cron = readFileSync(join(process.cwd(), "app/api/cron/usage/route.ts"), "utf8");
  assert.match(cron, /directoryReadiness\(\)/, "the daily run has to read it");
  assert.match(cron, /console\.log\(`directory-watch:/, "and record it every day");
  assert.match(cron, /"SET", DIRECTORY_TOLD, "1", "NX"/, "and write to him exactly once, on the day it crosses");
  assert.match(cron, /duties toward the people listed in it/, "with what deciding yes would actually mean");
});

// ---- and nothing is published ------------------------------------------

test("no route serves a directory, and none is half-written", () => {
  const pages = walk("app").filter((f) => /\/(directory|marketplace|catalog|catalogue|browse)\//.test(f));
  assert.deepEqual(pages, [], "a public catalogue is a decision to make once, not a route to find already there");
});

test("the index is written on the save and read by nothing that publishes", () => {
  // The flag may be read here and in the store's own save. Anywhere else is
  // something starting to build a page out of it.
  const readers = walk("app")
    .concat(walk("lib"), walk("components"))
    .filter((f) => /affiliates\.directory|listedStores\(|listedCount\(/.test(readFileSync(join(process.cwd(), f), "utf8")))
    .filter((f) => f !== "lib/directory-index.ts");
  assert.deepEqual(readers, [], "only lib/directory-index.ts reads the consent; the page it would feed does not exist");

  const store = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
  assert.match(store, /rememberListing\(next\)/, "the index has to be kept in step where the programme is saved");
});

test("the reason the page is not written is written down", () => {
  const src = readFileSync(join(process.cwd(), "lib/directory-index.ts"), "utf8");
  assert.match(src, /There is no directory/, "so nobody later reads this as an unfinished feature");
  assert.match(src, /SCAN over the whole keyspace/, "and the measured reason an index was needed first");
  assert.match(src, /charges by the command/, "including the part that makes a scan the wrong shape for a page");
});
