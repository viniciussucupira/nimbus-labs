import type { NextRequest } from "next/server";
import { cronAllowed } from "@/lib/request-guard";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isSenderConfigured } from "@/lib/email";
import { storeForHandle } from "@/lib/store";
import { advanceAll } from "@/lib/broadcasts";
import { advanceAnnouncements } from "@/lib/community-mail";
import { sendDueSteps } from "@/lib/flows";
import { sendCallReminders } from "@/lib/call-reminders";
import { SITE_URL } from "@/lib/site-url";
import { sweepCheckouts } from "@/lib/checkout-sweep";
import { deliverDue, watchStripe } from "@/lib/webhooks";
import { settlePendingOffers } from "@/lib/upsell";
import { sendReviewRequests } from "@/lib/review-requests";
import { syncDue } from "@/lib/email-sync";

export const maxDuration = 60;

/**
 * Run every few minutes by Vercel: confirms purchases whose buyer never
 * reached the thanks page and sends the one reminder after an abandoned
 * checkout (lib/checkout-sweep.ts), starts scheduled emails when their time
 * comes, finishes long ones, sends each step of a sequence when it is due,
 * sends the reminders before booked calls (lib/call-reminders.ts), which
 * need this job's five-minute rhythm to arrive an hour before and not later,
 * finishes a community announcement's email (lib/community-mail.ts), and
 * sends the review requests that are due (lib/review-requests.ts).
 * Last, it reads each store's Stripe events for the creator's webhooks and
 * retries the webhook deliveries that are due (lib/webhooks.ts), then the
 * people waiting to be sent to a creator's own email platform
 * (lib/email-sync.ts) — which need
 * Redis and Stripe but not email, so they run even where sending is off, as
 * does writing down the sales that came through an affiliate's link (the
 * checkout pass). Right after the checkout pass, the one-click offers still
 * waiting on Stripe are settled (lib/upsell.ts), so an offer the bank
 * confirmed later gets its email and its affiliate credit without waiting
 * for the buyer to come back.
 *
 * The run has sixty seconds, shared out so that nothing starves what comes
 * after it: the checkout pass up to twelve, the creators' emails until
 * thirty-four, call reminders at least ten more but nothing past forty-four,
 * review requests what is left until forty-seven, and the webhooks the rest,
 * starting nothing after fifty — one try can take eight more.
 */
export async function GET(request: NextRequest) {
  // Vercel sends the secret with every scheduled run, compared here in
  // constant time. Without one set, only a local development server runs the
  // job on request; in production that is a closed door, not an open one.
  if (!(await cronAllowed(request))) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isRedisConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  const [got] = await redisPipeline([["SET", "nl:mail:lock", "1", "NX", "EX", 90]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  const started = Date.now();
  const webhooksBy = started + 50_000;
  try {
    // First, and with a budget of its own: a buyer waiting for what they paid
    // for matters more than a newsletter going out a few minutes sooner, and
    // the budget keeps the newsletter from waiting on it for long. Without
    // email it still writes down affiliates' sales.
    let checkouts = null;
    try {
      checkouts = await sweepCheckouts(started + 12_000);
    } catch (error) {
      console.error("the checkout pass failed", error);
    }
    let offers = null;
    try {
      offers = await settlePendingOffers(storeForHandle, Math.max(Date.now(), started + 12_000) + 4_000);
    } catch (error) {
      console.error("settling waiting offers failed", error);
    }
    if (!isSenderConfigured()) {
      return Response.json({ ok: true, mail: "unavailable", checkouts, offers, webhooks: await runWebhooks(webhooksBy) }, { headers: { "Cache-Control": "no-store" } });
    }
    const deadline = started + 34_000;
    const broadcasts = await advanceAll(storeForHandle, deadline);
    const steps = await sendDueSteps(storeForHandle, deadline);
    let announcements = 0;
    try {
      announcements = await advanceAnnouncements(storeForHandle, deadline);
    } catch (error) {
      console.error("sending community announcements failed", error);
    }
    // Reminders are kept apart from the creators' own emails: one failing
    // never stops the other, and the next run picks up whatever was left.
    // They get ten seconds even after a long send, so a busy newsletter day
    // cannot push a reminder past its hour, but nothing past forty-four, so
    // the webhooks always have their turn.
    let calls = null;
    try {
      calls = await sendCallReminders(storeForHandle, Math.min(started + 44_000, Math.max(deadline, Date.now() + 10_000)), SITE_URL);
    } catch (error) {
      console.error("sending call reminders failed", error);
    }
    // Review requests are the least urgent email here: a day late is no harm.
    let reviews = null;
    try {
      reviews = await sendReviewRequests(storeForHandle, started + 47_000);
    } catch (error) {
      console.error("sending review requests failed", error);
    }
    // Nothing started after fifty: a webhook try can take eight more, and the
    // whole run has sixty.
    const webhooks = await runWebhooks(webhooksBy);
    return Response.json({ ok: true, checkouts, offers, broadcasts, announcements, ...steps, calls, reviews, webhooks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("the email job failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    await redisPipeline([["DEL", "nl:mail:lock"]]).catch(() => {});
  }
}

/**
 * The webhook pass: new Stripe events first, then the retries due, then the
 * email platforms' sends and retries. One failing never stops the others.
 */
async function runWebhooks(deadline: number) {
  let stripe = null;
  let deliveries = null;
  let emailPlatforms = null;
  try {
    stripe = await watchStripe(deadline - 3_000);
  } catch (error) {
    console.error("reading Stripe for webhooks failed", error);
  }
  try {
    deliveries = await deliverDue(deadline);
  } catch (error) {
    console.error("retrying webhooks failed", error);
  }
  try {
    emailPlatforms = await syncDue(deadline);
  } catch (error) {
    console.error("sending to email platforms failed", error);
  }
  return { stripe, deliveries, emailPlatforms };
}
