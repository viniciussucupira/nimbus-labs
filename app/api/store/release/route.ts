import type { NextRequest } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { releaseHandle } from "@/lib/store";
import { isRedisConfigured } from "@/lib/redis";
import { fromAnotherSite, limited } from "@/lib/request-guard";

const MAX_BODY_BYTES = 2_000;

/** Lets go of an address the signed-in creator's store used before. */
export async function POST(request: NextRequest) {
  // Refused before anything else is read: another site, by Origin or by
  // Sec-Fetch-Site (lib/request-guard.ts).
  if (fromAnotherSite(request)) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

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
    const parsed: unknown = await (await limited(request, MAX_BODY_BYTES)).json();
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
    const result = await releaseHandle(email, handle);
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.reason },
        { status: result.reason === "current" ? 409 : 400 },
      );
    }
    return Response.json({ ok: true, handle });
  } catch (error) {
    console.error("releasing an address failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
