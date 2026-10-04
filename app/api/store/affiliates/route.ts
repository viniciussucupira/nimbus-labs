import type { NextRequest } from "next/server";
import { StoreFullError, setAffiliateSetting, storeForEmail } from "@/lib/store";
import { readMoney } from "@/lib/money";
import { guardStoreWrite, text } from "@/lib/store-request";
import { MAX_COMMISSION, MIN_COMMISSION, parseAffiliateSetting } from "@/lib/affiliate-setting";
import { MAX_REFERENCE_LENGTH, addPayout, decide, readAffiliate, removePayout, setAffiliateRate } from "@/lib/affiliates";
import { PROMO_ID_PATTERN, giveCode, takeCodeBack } from "@/lib/affiliate-codes";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The creator running their affiliate programme, one action at a time:
 *
 * `{ action: "settings", enabled, percent, days, rule, payday, hold, rates: { <product>: 0-90 } }`,
 *   where `payday` is the day of the month they pay (1-28, or 0 for no promised
 *   day), `hold` is how many days a sale waits before it can be paid, and
 *   `rule` is "last" or "first": which of two links a buyer followed earns it;
 * `{ action: "code", promo, id }`, giving one of the creator's own discount
 *   codes to one affiliate so a sale that used it earns them their share with
 *   no click at all; an empty `id` takes the code back;
 * `{ action: "approve" | "decline" | "remove" | "restore", id }`;
 * `{ action: "payout", id, amount: "25.50", date: "2026-09-26", reference }`,
 *   which only writes down a payment the creator made themselves;
 * `{ action: "unpay", payout }`, to take back one written down by mistake;
 * `{ action: "rate", id, rate: 1-90 | null }`, a share for this affiliate
 *   alone, or back to the program's own shares.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings", 16_000);
  if (!guarded.ok) return guarded.response;
  const body = guarded.body;
  const action = text(body.action, 20);
  const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

  try {
    if (action === "settings") {
      const setting = parseAffiliateSetting({ ...body, enabled: body.enabled === true });
      // Out-of-range numbers are refused, not quietly replaced by the defaults.
      if (Number(body.percent) !== setting.percent) return fail("percent");
      if (Number(body.days) !== setting.days) return fail("days");
      // A rule we do not have is refused rather than quietly becoming "last".
      if (body.rule !== undefined && body.rule !== setting.rule) return fail("rule");
      if (Number(body.payday) !== setting.payday) return fail("payday");
      if (Number(body.hold) !== setting.hold) return fail("hold");
      const asked = body.rates && typeof body.rates === "object" ? Object.keys(body.rates as object).length : 0;
      if (asked !== Object.keys(setting.rates).length) return fail("rate");
      const result = await setAffiliateSetting(guarded.ref, setting);
      if (!result.ok) return fail(result.reason);
      return Response.json({ ok: true });
    }

    const store = await storeForEmail(guarded.ref);
    if (!store) return fail("none");
    if (!store.statsId) return fail("unknown");

    if (action === "approve" || action === "decline" || action === "remove" || action === "restore") {
      const done = await decide(store, text(body.id, 20), action);
      return done ? Response.json({ ok: true }) : fail("unknown");
    }
    if (action === "payout") {
      // In the store's currency, which is what the payout is written down in.
      const cents = readMoney(text(body.amount, 12), store.currency);
      if (cents === null || cents < 1) return fail("amount");
      const date = text(body.date, 10);
      if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return fail("date");
      const payout = await addPayout(store, {
        aff: text(body.id, 20),
        cents,
        currency: store.currency,
        date,
        reference: text(body.reference, MAX_REFERENCE_LENGTH * 2),
      });
      return payout ? Response.json({ ok: true }) : fail("unknown");
    }
    if (action === "rate") {
      const rate = body.rate === null || body.rate === "" ? null : Number(body.rate);
      if (rate !== null && !Number.isInteger(rate)) return fail("rate");
      if (rate !== null && (rate < MIN_COMMISSION || rate > MAX_COMMISSION)) return fail("rate");
      const done = await setAffiliateRate(store, text(body.id, 20), rate);
      return done ? Response.json({ ok: true, rate: done.rate }) : fail("unknown");
    }
    if (action === "code") {
      const promo = text(body.promo, 90);
      if (!PROMO_ID_PATTERN.test(promo)) return fail("promo");
      const id = text(body.id, 20);
      if (!id) return (await takeCodeBack(store, promo)) ? Response.json({ ok: true }) : fail("unknown");
      // Only somebody already in the programme, so a code cannot be handed to
      // an address nobody has approved.
      const affiliate = await readAffiliate(store, id);
      if (affiliate?.status !== "approved") return fail("unknown");
      return (await giveCode(store, promo, id)) ? Response.json({ ok: true }) : fail("unknown");
    }
    if (action === "unpay") {
      return (await removePayout(store, text(body.payout, 20))) ? Response.json({ ok: true }) : fail("unknown");
    }
    return fail("unknown");
  } catch (error) {
    if (error instanceof StoreFullError) return fail("store_full", 409);
    console.error("changing the affiliate programme failed", error);
    return fail("server_error", 500);
  }
}
