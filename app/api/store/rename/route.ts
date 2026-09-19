import type { NextRequest } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { renameHandle } from "@/lib/store";
import { isRedisConfigured } from "@/lib/redis";

const MAX_BODY_BYTES = 2_000;

/** Moves the signed-in creator's store to a new address. */
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

  const email = await emailForSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!email) {
    return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
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

  if (!isRedisConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const handle = typeof body.handle === "string" ? body.handle : "";

  try {
    const result = await renameHandle(email, handle);
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.reason, limit: result.limit },
        { status: result.reason === "too_many" ? 409 : 400 },
      );
    }
    return Response.json({ ok: true, handle: result.store.handle });
  } catch (error) {
    console.error("changing an address failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
