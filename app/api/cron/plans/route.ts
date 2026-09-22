import type { NextRequest } from "next/server";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { settlePlans } from "@/lib/plans";

/**
 * Run on a schedule by Vercel: gives every paid payment plan its end, so no
 * buyer is ever charged more payments than they agreed to.
 *
 * Safe to call by anyone: it only ever finishes plans that are already paid,
 * the way they were sold, and one run at a time.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isRedisConfigured()) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  const [got] = await redisPipeline([["SET", "nl:plans:lock", "1", "NX", "EX", 120]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  try {
    const counts = await settlePlans();
    return Response.json({ ok: true, ...counts }, { headers: { "Cache-Control": "no-store" } });
  } finally {
    await redisPipeline([["DEL", "nl:plans:lock"]]).catch(() => {});
  }
}
