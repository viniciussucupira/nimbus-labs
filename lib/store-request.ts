import type { NextRequest } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { isRedisConfigured } from "@/lib/redis";

/**
 * The four checks every write to a store has to pass, in one place.
 *
 * They run in this order on purpose. The origin check comes first because it
 * costs nothing and stops another site from spending a signed-in creator's
 * session. The size cap comes before the body is read, so a large payload is
 * refused rather than parsed. The session comes before the body is trusted.
 * Redis is checked last, because a store that cannot be written is a fact
 * about us and should not be reported as a fault in what was sent.
 *
 * Returns a Response to send back, or the email and the parsed body.
 */
export async function guardStoreWrite(
  request: NextRequest,
  maxBodyBytes = 4_000,
): Promise<
  { ok: true; email: string; body: Record<string, unknown> } | { ok: false; response: Response }
> {
  const refuse = (error: string, status: number) => ({
    ok: false as const,
    response: Response.json({ ok: false, error }, { status }),
  });

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return refuse("forbidden", 403);
    } catch {
      return refuse("forbidden", 403);
    }
  }

  if (Number(request.headers.get("content-length") ?? "0") > maxBodyBytes) {
    return refuse("invalid", 413);
  }

  const email = await emailForSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!email) return refuse("signed_out", 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return refuse("invalid", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return refuse("invalid", 400);
  }

  if (!isRedisConfigured()) return refuse("unavailable", 503);

  return { ok: true, email, body };
}

/** A field read as text, or an empty string when it is anything else. */
export function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
