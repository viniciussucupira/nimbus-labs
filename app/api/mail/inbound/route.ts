import type { NextRequest } from "next/server";
import { forwardInbound, inboundSigned, isInboundConfigured } from "@/lib/inbound-mail";
import { redisPipeline } from "@/lib/redis";
import { clientAddress, limited, withinLimit } from "@/lib/request-guard";

/** An announcement names a message; it does not carry it. Anything bigger is not one. */
const MAX_BODY_BYTES = 256_000;
/** Announcements one address may make in a minute. */
const PER_MINUTE = 600;

// Reading a message, fetching its files and sending it on.
export const maxDuration = 60;

/**
 * Resend's announcement that a message arrived at one of the site's own
 * addresses (lib/inbound-mail.ts): the message is fetched and sent on to the
 * inbox that reads it.
 *
 * Not found until the three settings are there. Every announcement must
 * carry Resend's signature from the last five minutes, and each is acted on
 * once: its id is kept for a day, and the same one again is acknowledged and
 * ignored. One we failed to act on is let go of again and answered with a
 * failure, so Resend's retry of it is heard.
 *
 * Anything that is not "email.received" is acknowledged and ignored.
 */
export async function POST(request: NextRequest) {
  if (!isInboundConfigured()) return new Response("Not found.", { status: 404 });
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

  let notice: { type?: unknown; data?: { email_id?: unknown } };
  try {
    notice = JSON.parse(body) as typeof notice;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (notice.type !== "email.received") return Response.json({ ok: true });
  const emailId = typeof notice.data?.email_id === "string" ? notice.data.email_id : "";

  const seenKey = `nl:inbound:seen:${id}`;
  try {
    const [fresh] = await redisPipeline([["SET", seenKey, "1", "NX", "EX", 86_400]]);
    if (fresh === null) return Response.json({ ok: true });
  } catch {
    // Without Redis the sender's idempotency key still keeps a repeat from
    // being delivered twice; carry on.
  }

  const result = await forwardInbound(emailId);
  if (result === "retry") {
    await redisPipeline([["DEL", seenKey]]).catch(() => {});
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, result });
}
