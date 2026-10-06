import type { NextRequest } from "next/server";
import { canHearResend, forwardInbound, inboundSigned, isInboundConfigured } from "@/lib/inbound-mail";
import { LIST_TAG, STORE_TAG, heardFromSender } from "@/lib/mail-health";
import { redisPipeline } from "@/lib/redis";
import { clientAddress, limited, withinLimit } from "@/lib/request-guard";

/** An announcement names a message; it does not carry it. Anything bigger is not one. */
const MAX_BODY_BYTES = 256_000;
/** Announcements one address may make in a minute. */
const PER_MINUTE = 600;

// Reading a message, fetching its files and sending it on.
export const maxDuration = 60;

/** A tag's value, from the two shapes a sender writes tags in: { name: value } or [{ name, value }]. */
function tagOf(tags: unknown, name: string): string {
  if (Array.isArray(tags)) {
    const found = tags.find((t) => t && typeof t === "object" && (t as { name?: unknown }).name === name) as { value?: unknown } | undefined;
    return typeof found?.value === "string" ? found.value : "";
  }
  const value = tags && typeof tags === "object" ? (tags as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : "";
}

/**
 * Resend's announcements, of two kinds:
 *
 *   - a message arrived at one of the site's own addresses
 *     (lib/inbound-mail.ts): it is fetched and sent on to the inbox that
 *     reads it;
 *   - an email we sent bounced, or was marked as spam (lib/mail-health.ts):
 *     the address is taken off that store's list, and the store is paused
 *     if it has had too many.
 *
 * Not found until the setting that signs them is there. Every announcement
 * must carry Resend's signature from the last five minutes, and each is
 * acted on once: its id is kept for a day, and the same one again is
 * acknowledged and ignored. One we failed to act on is let go of again and
 * answered with a failure, so Resend's retry of it is heard.
 *
 * Anything else is acknowledged and ignored.
 */
export async function POST(request: NextRequest) {
  if (!canHearResend()) return new Response("Not found.", { status: 404 });
  if (!(await withinLimit("mail-inbound", clientAddress(request), PER_MINUTE, 60))) {
    return Response.json({ ok: false }, { status: 429 });
  }
  let body: string;
  try {
    body = await (await limited(request, MAX_BODY_BYTES)).text();
  } catch {
    return Response.json({ ok: false }, { status: 413 });
  }
  const id = request.headers.get("svix-id");
  if (!inboundSigned(body, id, request.headers.get("svix-timestamp"), request.headers.get("svix-signature"))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let notice: { type?: unknown; data?: { email_id?: unknown; to?: unknown; tags?: unknown; bounce?: { type?: unknown } } };
  try {
    notice = JSON.parse(body) as typeof notice;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const bad = notice.type === "email.bounced" || notice.type === "email.complained";
  if (!bad && notice.type !== "email.received") return Response.json({ ok: true });
  // Mail to the site's own addresses needs the other two settings as well,
  // and is not found without them, as it always was: an announcement not
  // acknowledged is one Resend offers again.
  if (!bad && !isInboundConfigured()) return new Response("Not found.", { status: 404 });

  const seenKey = `nl:inbound:seen:${id}`;
  try {
    const [fresh] = await redisPipeline([["SET", seenKey, "1", "NX", "EX", 86_400]]);
    if (fresh === null) return Response.json({ ok: true });
  } catch {
    // Without Redis the sender's idempotency key still keeps a repeat from
    // being delivered twice; carry on.
  }

  if (bad) {
    const to = Array.isArray(notice.data?.to) ? notice.data.to[0] : notice.data?.to;
    try {
      const result = await heardFromSender({
        kind: notice.type === "email.complained" ? "complained" : "bounced",
        permanent: notice.data?.bounce?.type === "Permanent",
        to: typeof to === "string" ? to : "",
        store: tagOf(notice.data?.tags, STORE_TAG),
        list: tagOf(notice.data?.tags, LIST_TAG),
      });
      return Response.json({ ok: true, result });
    } catch (error) {
      // Not acted on: let go of, so the retry is heard.
      console.error("a bounce or complaint could not be recorded", error);
      await redisPipeline([["DEL", seenKey]]).catch(() => {});
      return Response.json({ ok: false }, { status: 500 });
    }
  }

  const emailId = typeof notice.data?.email_id === "string" ? notice.data.email_id : "";

  const result = await forwardInbound(emailId);
  if (result === "retry") {
    await redisPipeline([["DEL", seenKey]]).catch(() => {});
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, result });
}
