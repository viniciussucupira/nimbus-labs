import type { NextRequest } from "next/server";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isSenderConfigured } from "@/lib/email";
import { storeForHandle } from "@/lib/store";
import { advanceAll } from "@/lib/broadcasts";
import { sendDueSteps } from "@/lib/flows";

export const maxDuration = 60;

/**
 * Run every few minutes by Vercel: starts scheduled emails when their time
 * comes, finishes long ones, and sends each step of a sequence when it is due.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isRedisConfigured() || !isSenderConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const [got] = await redisPipeline([["SET", "nl:mail:lock", "1", "NX", "EX", 90]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  try {
    const deadline = Date.now() + 45_000;
    const broadcasts = await advanceAll(storeForHandle, deadline);
    const steps = await sendDueSteps(storeForHandle, deadline);
    return Response.json({ ok: true, broadcasts, ...steps }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("the email job failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    await redisPipeline([["DEL", "nl:mail:lock"]]).catch(() => {});
  }
}
