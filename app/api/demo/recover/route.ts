import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  EMAIL_PATTERN,
  MAX_EMAIL_LENGTH,
  findOrder,
  isRecoveryConfigured,
  sendRecoveryEmail,
  withinRateLimit,
} from "@/lib/demo-recover";
import { getDemoOrder } from "@/lib/demo-store";
import { fromAnotherSite, limited } from "@/lib/request-guard";

const MAX_BODY_BYTES = 2_000;

/**
 * Sends a buyer their download link again.
 *
 * The answer is deliberately the same whether or not that address ever bought
 * anything: a stranger must not be able to use this form to find out who
 * bought from the store. Only the inbox learns the truth.
 */
export async function POST(request: NextRequest) {
  // Refused before anything else is read: another site, by Origin or by
  // Sec-Fetch-Site (lib/request-guard.ts).
  if (fromAnotherSite(request)) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "invalid" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await (await limited(request, MAX_BODY_BYTES)).json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Honeypot: a real buyer never sees this field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ ok: true }, { status: 200 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  // Say so plainly rather than pretending an email is on its way.
  if (!isRecoveryConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    if (!(await withinRateLimit(ip))) {
      return Response.json(
        { ok: false, error: "rate_limited" },
        { status: 429 },
      );
    }

    const sessionId = await findOrder(email);
    if (sessionId) {
      // Ask Stripe again rather than trusting our own index: a refunded or
      // expired order must not be handed back.
      const order = await getDemoOrder(sessionId);
      if (order.state === "paid") {
        const base = originFrom(request);
        const link = `${base}/api/demo/download?session_id=${encodeURIComponent(sessionId)}`;
        await sendRecoveryEmail(email, link);
      }
    }
  } catch (error) {
    console.error("demo recovery failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
