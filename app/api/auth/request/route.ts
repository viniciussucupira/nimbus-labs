import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  EMAIL_PATTERN,
  MAX_EMAIL_LENGTH,
  isAuthConfigured,
  sendSignInLink,
  withinRateLimit,
} from "@/lib/auth";

const MAX_BODY_BYTES = 2_000;

/**
 * Asks for a sign-in link.
 *
 * The answer never says whether that address has an account, because that
 * would turn this form into a way of finding out who is a Nimbus creator.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    } catch {
      return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "invalid" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Honeypot: a real creator never sees this field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ ok: true }, { status: 200 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  if (!isAuthConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    if (!(await withinRateLimit(ip))) {
      return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
    await sendSignInLink(email, originFrom(request));
  } catch (error) {
    console.error("sign-in request failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
