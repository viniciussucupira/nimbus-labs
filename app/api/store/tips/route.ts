import type { NextRequest } from "next/server";
import { setTips, storeForEmail } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import { MAX_TIPS_HEADING, MAX_TIPS_LINE, MAX_TIP_AMOUNTS, readTipAmount } from "@/lib/store-tips";

/**
 * Switches "Support my work" on the store page and saves it (lib/store-tips.ts):
 * `{ on, heading, line, amounts }`, the amounts as typed ("3", "5.50"), up to
 * three. An amount that is not one, or is out of range for the store's
 * currency, is refused by its place in the list rather than dropped. Part of
 * the page.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page", 2_000);
  if (!guarded.ok) return guarded.response;
  const { ref, body } = guarded;
  try {
    const store = await storeForEmail(ref);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 404 });
    const typed = Array.isArray(body.amounts) ? body.amounts.slice(0, MAX_TIP_AMOUNTS + 1) : [];
    if (typed.length > MAX_TIP_AMOUNTS) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    const amounts: number[] = [];
    const bad: number[] = [];
    typed.forEach((raw, i) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) return;
      const amount = readTipAmount(value, store.currency);
      if (amount === null) bad.push(i);
      else amounts.push(amount);
    });
    if (bad.length) return Response.json({ ok: false, error: "amount", bad }, { status: 400 });
    const saved = await setTips(ref, {
      on: body.on === true,
      heading: text(body.heading, MAX_TIPS_HEADING * 2),
      line: text(body.line, MAX_TIPS_LINE * 2),
      amounts,
    });
    if (!saved) return Response.json({ ok: false, error: "none" }, { status: 404 });
    return Response.json({ ok: true, tips: saved.tips });
  } catch (error) {
    console.error("saving the support box failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
