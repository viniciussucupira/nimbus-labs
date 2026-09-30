import type { NextRequest } from "next/server";
import { cronAllowed } from "@/lib/request-guard";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isSenderConfigured } from "@/lib/email";
import { sendPaydayEmails } from "@/lib/affiliate-payday";

/** Long enough to walk every store, short enough to end before the platform does. */
const RUN_MS = 50_000;

/**
 * Run on a schedule by Vercel: on the day a creator told their affiliates
 * they pay, sends them the batch that is due.
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
    const counts = await sendPaydayEmails(Date.now() + RUN_MS);
    return Response.json({ ok: true, ...counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("sending affiliate payday emails failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    await redisPipeline([["DEL", "nl:aff:payday:lock"]]).catch(() => {});
  }
}
