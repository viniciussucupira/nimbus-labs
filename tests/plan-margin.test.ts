/**
 * No plan may lose money in its own worst case.
 *
 * Every brake in this system was set on its own, against the question "would
 * a real creator ever reach this?" — and every one of them passed that
 * question. Then the worst cases were added up for the first time and both
 * plans lost money: the $29 one by $31 and the $99 one by $15. A brake is
 * not a brake if the sum of all of them sits above the revenue they protect,
 * and no individual check would ever have noticed, because each number was
 * defensible alone.
 *
 * So the sum is the thing that is checked. These are the real published
 * rates, and they move only when the vendors' do:
 *
 *   Vercel Blob storage        $0.023 / GB / month
 *   Vercel Blob data transfer  $0.05  / GB
 *   Fast Origin Transfer       $0.06  / GB   (added for a file over 512 MB,
 *                                             which is never cached)
 *   Resend                     $0.0009 / email
 *   Stripe                     2.9% + $0.30 on each subscription charge
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_PRICES, PRO_MONTHLY_EMAILS, type Tier } from "@/lib/plan";
import { FREE_PAUSE_ABOVE_BYTES } from "@/lib/delivery";
import { STORAGE_BRAKE_BYTES } from "@/lib/storage-quota";
import { AI_MONTHLY } from "@/lib/ai-rules";
import { DELIVERY_ALLOWANCE_BYTES } from "@/lib/delivery";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const GB = 1024 * 1024 * 1024;

const STORAGE_PER_GB = 0.023;
/** The worst rate: a file too large to cache pays transfer and origin both. */
const DELIVERY_PER_GB = 0.05 + 0.06;
const PER_EMAIL = 0.0009;
/** A rough, deliberately high figure for one AI draft. */
const PER_DRAFT = 0.015;
/** Receipts, file delivery and login links, which nothing caps. Set high. */
const TRANSACTIONAL = { creator: 2_000, pro: 5_000 };

/** What reaches us from one monthly charge, after Stripe takes its cut. */
function netOf(tier: Tier): number {
  const gross = PLAN_PRICES[tier].month / 100;
  return gross - (gross * 0.029 + 0.3);
}

/** Everything one store on this plan can run up in a month, at every limit at once. */
function worstCost(tier: Tier): number {
  const storage = (STORAGE_BRAKE_BYTES / GB) * STORAGE_PER_GB;
  const free = (FREE_PAUSE_ABOVE_BYTES / GB) * DELIVERY_PER_GB;
  const email = (tier === "pro" ? PRO_MONTHLY_EMAILS : 0) * PER_EMAIL;
  const drafts = AI_MONTHLY[tier] * PER_DRAFT;
  const receipts = TRANSACTIONAL[tier] * PER_EMAIL;
  return storage + free + email + drafts + receipts;
}

for (const tier of ["creator", "pro"] as const) {
  test(`${tier}: every brake at its limit at once still turns a profit`, () => {
    const cost = worstCost(tier);
    const net = netOf(tier);
    assert.ok(
      cost < net,
      `${tier} costs $${cost.toFixed(2)} at its worst and brings in $${net.toFixed(2)}. ` +
        "A plan that loses money in its own worst case has no brakes, only decoration.",
    );
  });

  test(`${tier}: the margin left in that worst case is a real one`, () => {
    const cost = worstCost(tier);
    const net = netOf(tier);
    const margin = (net - cost) / net;
    assert.ok(
      margin >= 0.45,
      `${tier} keeps ${(margin * 100).toFixed(0)}% in its worst case. Scraping past zero is not ` +
        "the goal: the brakes exist so the floor is comfortable, not survivable.",
    );
  });

  test(`${tier}: no single brake is big enough to swallow the plan by itself`, () => {
    const net = netOf(tier);
    const lines: [string, number][] = [
      ["storage", (STORAGE_BRAKE_BYTES / GB) * STORAGE_PER_GB],
      ["free downloads", (FREE_PAUSE_ABOVE_BYTES / GB) * DELIVERY_PER_GB],
      ["email", (tier === "pro" ? PRO_MONTHLY_EMAILS : 0) * PER_EMAIL],
      ["AI drafts", AI_MONTHLY[tier] * PER_DRAFT],
    ];
    for (const [name, cost] of lines) {
      assert.ok(
        cost <= net / 2,
        `${tier}: ${name} alone is $${cost.toFixed(2)} of $${net.toFixed(2)}. One line taking half ` +
          "the plan leaves nothing for the other three.",
      );
    }
  });
}

test("the free-download brake is smaller than the allowance that is published", () => {
  // The published figure covers paid and free together. Free copies — which
  // nobody paid for — cannot be allowed to eat the whole of it.
  assert.ok(
    FREE_PAUSE_ABOVE_BYTES < DELIVERY_ALLOWANCE_BYTES,
    "giving things away must not be able to consume the whole month's delivery on its own",
  );
});

test("a buyer's download is bounded by nothing, and that is on purpose", () => {
  // Stated here so that nobody ever "fixes" it. Somebody paid the creator for
  // that file. The ceiling on what a runaway store can cost us in paid
  // delivery is the spend cap at the host, not a door shut on a customer.
  const delivery = readFileSync(join(process.cwd(), "lib/delivery.ts"), "utf8");
  assert.match(
    delivery,
    /What it deliberately does NOT do is stop a delivery/,
    "the reasoning for never blocking a paid download must stay written down",
  );
});
