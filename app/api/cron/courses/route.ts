import type { NextRequest } from "next/server";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isSenderConfigured } from "@/lib/email";
import { storeForHandle } from "@/lib/store";
import { readCourse } from "@/lib/course";
import { sendDripEmails } from "@/lib/learn";
import { SITE_URL } from "@/lib/site-url";

/**
 * Run on a schedule by Vercel: tells each student when a module of their
 * course opens for them. Once per student and module, one run at a time.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isRedisConfigured() || !isSenderConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const [got] = await redisPipeline([["SET", "nl:courses:lock", "1", "NX", "EX", 300]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  try {
    const counts = await sendDripEmails(storeForHandle, readCourse, SITE_URL);
    return Response.json({ ok: true, ...counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("sending course emails failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    await redisPipeline([["DEL", "nl:courses:lock"]]).catch(() => {});
  }
}
