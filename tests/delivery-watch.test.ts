/**
 * The store that costs more than it pays, and whether we hear about it.
 *
 * Delivery is the one cost with no ceiling anywhere in the code. The 200 GB
 * a month the subscription covers is counted and never enforced, on purpose:
 * somebody paid the creator for that file, and cutting their buyer off to
 * protect our margin would be taking money for a sale and then not
 * completing it. So the protection cannot be a door. It has to be knowing.
 *
 * And we did not know. The creator could see they were over, in their own
 * studio, while the first we would have heard of a store moving twenty-five
 * terabytes was the invoice — a month late and already paid.
 *
 * These hold the part that closes it: a store is written down the moment it
 * crosses, exactly once, and the number we read back is the real one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DELIVERY_ALLOWANCE_BYTES,
  bytesWords,
  deliveredThisMonth,
  recordDelivery,
  storesOverAllowance,
} from "@/lib/delivery";
import { store as redis } from "./redis-stub";

const GB = 1024 * 1024 * 1024;
const file = (handle: string) => `stores/${handle}/products/thing.zip`;

test("a store inside the allowance is counted and not named", async () => {
  await recordDelivery(file("quiet"), 10 * GB);
  const month = await deliveredThisMonth("quiet");
  assert.equal(month.bytes, 10 * GB);
  assert.equal(month.allowance, DELIVERY_ALLOWANCE_BYTES);
  assert.equal(month.over, false);
  assert.deepEqual(
    (await storesOverAllowance()).map((s) => s.folder),
    [],
    "nothing to say on a quiet month",
  );
});

test("the delivery that crosses the line is the one that writes it down", async () => {
  // Right up to the line, and still nothing.
  await recordDelivery(file("busy"), DELIVERY_ALLOWANCE_BYTES - GB);
  assert.equal((await deliveredThisMonth("busy")).over, false);
  assert.equal(
    (await storesOverAllowance()).some((s) => s.folder === "busy"),
    false,
    "at the line is not over it",
  );

  // The next file takes it past.
  await recordDelivery(file("busy"), 2 * GB);
  assert.equal((await deliveredThisMonth("busy")).over, true);
  const over = await storesOverAllowance();
  const found = over.find((s) => s.folder === "busy");
  assert.ok(found, "the store is named once it is over");
  assert.equal(found.bytes, DELIVERY_ALLOWANCE_BYTES + GB, "with what it has actually sent");
});

test("a store far over is named once, not once per file", async () => {
  for (let i = 0; i < 40; i += 1) await recordDelivery(file("runaway"), 20 * GB);
  const named = (await storesOverAllowance()).filter((s) => s.folder === "runaway");
  assert.equal(named.length, 1, "a set, so forty more files do not make forty more rows");
  assert.equal(named[0].bytes, 800 * GB);
});

test("nothing is ever blocked, whatever the number says", async () => {
  // recordDelivery returns nothing and throws nothing: it cannot be the
  // reason a buyer does not get what they paid for.
  const huge = await recordDelivery(file("runaway"), 5_000 * GB);
  assert.equal(huge, undefined);
  assert.equal((await deliveredThisMonth("runaway")).bytes, 5_800 * GB);
});

test("the worst offender is listed first, because that is the one to call", async () => {
  const over = await storesOverAllowance();
  const bytes = over.map((s) => s.bytes);
  assert.deepEqual(bytes, [...bytes].sort((a, b) => b - a));
  assert.equal(over[0].folder, "runaway");
});

test("a path that is not a store's file is not counted against anyone", async () => {
  await recordDelivery("not/a/store/path.zip", 900 * GB);
  await recordDelivery("", 900 * GB);
  assert.equal(
    (await storesOverAllowance()).some((s) => ["not", ""].includes(s.folder)),
    false,
  );
});

test("a size that is not a size is ignored rather than stored", async () => {
  const before = (await deliveredThisMonth("quiet")).bytes;
  await recordDelivery(file("quiet"), Number.NaN);
  await recordDelivery(file("quiet"), -5 * GB);
  await recordDelivery(file("quiet"), 0);
  assert.equal((await deliveredThisMonth("quiet")).bytes, before);
});

test("the figures read as figures in an email", () => {
  assert.equal(bytesWords(DELIVERY_ALLOWANCE_BYTES), "200 GB");
  assert.equal(bytesWords(1.5 * 1024 * GB), "1.5 TB");
  assert.equal(bytesWords(2.5 * GB), "2.5 GB");
  assert.equal(bytesWords(40 * GB), "40 GB");
});

test("the watch reads nothing when there is nothing written", async () => {
  redis.run(["DEL", "nl:store:delivery:over:" + new Date().toISOString().slice(0, 7)]);
  assert.deepEqual(await storesOverAllowance(), []);
});

test("the promise in the Terms is one the machine can keep alone", () => {
  const terms = readFileSync(join(process.cwd(), "app/terms/page.tsx"), "utf8");
  const section = terms.slice(terms.indexOf('id="fair-use"'), terms.indexOf('id="fair-use"') + 4000);

  // The clause may not promise a letter that only a person could send.
  assert.doesNotMatch(
    section,
    /we will write to you first/,
    "a promise that waits for somebody to notice is not a promise. Section 5 should " +
      "describe the automatic notice, not a letter written by hand.",
  );
  assert.match(section, /automatic/, "it should say plainly that the notice is automatic");
  assert.match(
    section,
    /never\s+in the middle of delivering something a buyer has already paid for/,
    "and must keep the one thing that is never automated: cutting off a paid delivery",
  );

  // And the thing that sends it has to exist.
  const cron = readFileSync(join(process.cwd(), "app/api/cron/usage/route.ts"), "utf8");
  assert.match(cron, /ownersOf/, "the daily run must look up who to write to");
  assert.match(cron, /sendEmail/, "and actually send it");
  const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
  assert.match(vercel, /\/api\/cron\/usage/, "and be scheduled, or it never runs");
});
