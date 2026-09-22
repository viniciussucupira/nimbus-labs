import type { NextRequest } from "next/server";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isBillingConfigured } from "@/lib/billing";
import { sendReminders } from "@/lib/billing-reminders";

/**
 * Run on a schedule by Vercel: warns every creator before a trial turns into
 * a charge, and before a yearly plan renews.
 *
 * Safe to call by anyone: each charge is warned of once, only to the person
 * paying it, and one run at a time.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isRedisConfigured() || !isBillingConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const [got] = await redisPipeline([["SET", "nl:remind:lock", "1", "NX", "EX", 300]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  try {
    const counts = await sendReminders();
    return Response.json({ ok: true, ...counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("sending billing reminders failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    await redisPipeline([["DEL", "nl:remind:lock"]]).catch(() => {});
  }
}
