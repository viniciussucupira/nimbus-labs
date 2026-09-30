import type { NextRequest } from "next/server";
import { cronAllowed } from "@/lib/request-guard";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isSenderConfigured } from "@/lib/email";
import { sendPaydayEmails } from "@/lib/affiliate-payday";
import { settleAllPayPal } from "@/lib/paypal-payouts";

/** Long enough to walk every store, short enough to end before the platform does. */
const RUN_MS = 50_000;

/**
 * Run on a schedule by Vercel: first writes into each book what PayPal says
 * it paid from creators' own PayPal (lib/paypal-payouts.ts); then, on the
 * day a creator told their affiliates they pay, sends the batch that is due
 * — or, for a creator who asked, pays it from their PayPal by itself.
 *
 * Safe to run more than once: each store's month is claimed before its email
 * goes out, and one run at a time.
 */
export async function GET(request: NextRequest) {
  if (!(await cronAllowed(request))) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isRedisConfigured() || !isSenderConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const [got] = await redisPipeline([["SET", "nl:aff:payday:lock", "1", "NX", "EX", 300]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  try {
    const started = Date.now();
    const settled = await settleAllPayPal(started + RUN_MS / 3);
    const counts = await sendPaydayEmails(started + RUN_MS);
    return Response.json({ ok: true, settled, ...counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("sending affiliate payday emails failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    await redisPipeline([["DEL", "nl:aff:payday:lock"]]).catch(() => {});
  }
}
