import type { NextRequest } from "next/server";
import { StoreFullError, priceToCents, setAffiliateSetting, storeForEmail } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import { parseAffiliateSetting } from "@/lib/affiliate-setting";
import { MAX_REFERENCE_LENGTH, addPayout, decide, removePayout } from "@/lib/affiliates";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The creator running their affiliate programme, one action at a time:
 *
 * `{ action: "settings", enabled, percent, days, rates: { <product>: 0-90 } }`;
 * `{ action: "approve" | "decline" | "remove" | "restore", id }`;
 * `{ action: "payout", id, amount: "25.50", date: "2026-09-26", reference }`,
 *   which only writes down a payment the creator made themselves;
 * `{ action: "unpay", payout }`, to take back one written down by mistake.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, 16_000);
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
      const asked = body.rates && typeof body.rates === "object" ? Object.keys(body.rates as object).length : 0;
      if (asked !== Object.keys(setting.rates).length) return fail("rate");
      const result = await setAffiliateSetting(guarded.email, setting);
      if (!result.ok) return fail(result.reason);
      return Response.json({ ok: true });
    }

    const store = await storeForEmail(guarded.email);
    if (!store) return fail("none");
    if (!store.statsId) return fail("unknown");

    if (action === "approve" || action === "decline" || action === "remove" || action === "restore") {
      const done = await decide(store, text(body.id, 20), action);
      return done ? Response.json({ ok: true }) : fail("unknown");
    }
    if (action === "payout") {
      const cents = priceToCents(text(body.amount, 12));
      if (cents === null || cents < 1) return fail("amount");
      const date = text(body.date, 10);
      if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return fail("date");
      const payout = await addPayout(store, {
        aff: text(body.id, 20),
        cents,
        date,
        reference: text(body.reference, MAX_REFERENCE_LENGTH * 2),
      });
      return payout ? Response.json({ ok: true }) : fail("unknown");
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
