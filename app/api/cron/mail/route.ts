import type { NextRequest } from "next/server";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isSenderConfigured } from "@/lib/email";
import { storeForHandle } from "@/lib/store";
import { advanceAll } from "@/lib/broadcasts";
import { sendDueSteps } from "@/lib/flows";
import { sendCallReminders } from "@/lib/call-reminders";
import { SITE_URL } from "@/lib/site-url";
import { sweepCheckouts } from "@/lib/checkout-sweep";

export const maxDuration = 60;

/**
 * Run every few minutes by Vercel: confirms purchases whose buyer never
 * reached the thanks page and sends the one reminder after an abandoned
 * checkout (lib/checkout-sweep.ts), starts scheduled emails when their time
 * comes, finishes long ones, sends each step of a sequence when it is due,
 * and sends the reminders before booked calls (lib/call-reminders.ts), which
 * need this job's five-minute rhythm to arrive an hour before and not later.
 */
export async function GET(request: NextRequest) {
  // Vercel sends the secret with every scheduled run. Without one set, only a
  // local development server runs the job on request; in production that is
  // a closed door, not an open one.
  const secret = process.env.CRON_SECRET?.trim();
  if (secret ? request.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isRedisConfigured() || !isSenderConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const [got] = await redisPipeline([["SET", "nl:mail:lock", "1", "NX", "EX", 90]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  try {
    const deadline = Date.now() + 45_000;
    // First, and with a budget of its own: a buyer waiting for what they paid
    // for matters more than a newsletter going out a few minutes sooner, and
    // the budget keeps the newsletter from waiting on it for long.
    let checkouts = null;
    try {
      checkouts = await sweepCheckouts(Date.now() + 12_000);
    } catch (error) {
      console.error("the checkout pass failed", error);
    }
    const broadcasts = await advanceAll(storeForHandle, deadline);
    const steps = await sendDueSteps(storeForHandle, deadline);
    // Reminders are kept apart from the creators' own emails: one failing
    // never stops the other, and the next run picks up whatever was left.
    // They get ten seconds even after a long send, so a busy newsletter day
    // cannot push a reminder past its hour.
    let calls = null;
    try {
      calls = await sendCallReminders(storeForHandle, Math.max(deadline, Date.now() + 10_000), SITE_URL);
    } catch (error) {
      console.error("sending call reminders failed", error);
    }
    return Response.json({ ok: true, checkouts, broadcasts, ...steps, calls }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("the email job failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    await redisPipeline([["DEL", "nl:mail:lock"]]).catch(() => {});
  }
}
