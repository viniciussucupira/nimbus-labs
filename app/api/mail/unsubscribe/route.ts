import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { UNSUB_TOKEN, unsubscribe } from "@/lib/contacts";
import { STOP_TOKEN, stopReminders } from "@/lib/checkout-recovery";
import { COMMUNITY_UNSUB, stopAnnouncements } from "@/lib/community-mail";
import { limited } from "@/lib/request-guard";

/**
 * Leaving a creator's list. A mail app's own unsubscribe button posts here
 * with no page at all (RFC 8058); the link in the email reaches the same
 * thing through a page with one button. Either way it takes one press, it is
 * kept for good, and nobody is asked why.
 *
 * The same door stops a store's abandoned-checkout reminders (an `r` link
 * rather than a `t` one, lib/checkout-recovery.ts), which are sent to people
 * who may never have joined the list, and a community member's announcement
 * emails (a `c` link, lib/community-mail.ts), which leaves them in the
 * community and on or off the list exactly as they were.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  const token = (request.nextUrl.searchParams.get("t") ?? "").slice(0, 60);
  const reminder = (request.nextUrl.searchParams.get("r") ?? "").slice(0, 60);
  const community = (request.nextUrl.searchParams.get("c") ?? "").slice(0, 60);
  let fromPage = false;
  if (!UNSUB_TOKEN.test(token) && !STOP_TOKEN.test(reminder) && !COMMUNITY_UNSUB.test(community)) {
    return new Response("Not found.", { status: 404 });
  }
  try {
    const form = await (await limited(request, 8_000)).formData();
    fromPage = form.get("from") === "page";
  } catch {
    fromPage = false;
  }
  const done = COMMUNITY_UNSUB.test(community)
    ? await stopAnnouncements(community)
    : STOP_TOKEN.test(reminder)
      ? await stopReminders(reminder)
      : await unsubscribe(token);
  const which = COMMUNITY_UNSUB.test(community) ? `c=${community}` : STOP_TOKEN.test(reminder) ? `r=${reminder}` : `t=${token}`;
  if (fromPage) {
    return new Response(null, {
      status: 303,
      headers: { Location: `${origin}/unsubscribe?${which}&done=${done ? "1" : "0"}`, "Cache-Control": "no-store" },
    });
  }
  return new Response(done ? "Unsubscribed." : "Not found.", {
    status: done ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** A link opened by hand goes to the page with the button, never straight through. */
export async function GET(request: NextRequest) {
  const origin = originFrom(request);
  const token = (request.nextUrl.searchParams.get("t") ?? "").slice(0, 60);
  const reminder = (request.nextUrl.searchParams.get("r") ?? "").slice(0, 60);
  const community = (request.nextUrl.searchParams.get("c") ?? "").slice(0, 60);
  const which = community
    ? `c=${encodeURIComponent(community)}`
    : reminder
      ? `r=${encodeURIComponent(reminder)}`
      : `t=${encodeURIComponent(token)}`;
  return new Response(null, { status: 303, headers: { Location: `${origin}/unsubscribe?${which}` } });
}
