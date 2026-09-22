import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  endAllSessions,
  openSession,
  spendMoveLink,
} from "@/lib/auth";
import { moveAccount } from "@/lib/store";

/**
 * Finishes a move of the sign-in address.
 *
 * Only a POST does this, for the same reason the sign-in link works that way:
 * mail filters open links, and a link that a filter could spend would move an
 * account on its own.
 *
 * Every session the old address had is closed afterwards. A move is exactly
 * the moment where a session left open somewhere else stops being harmless.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);

  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (sender && host) {
    try {
      if (new URL(sender).host !== host) {
        return new Response("forbidden", { status: 403 });
      }
    } catch {
      return new Response("forbidden", { status: 403 });
    }
  }

  const away = (path: string) =>
    new Response(null, { status: 303, headers: { Location: `${origin}${path}` } });

  let token = "";
  try {
    const form = await request.formData();
    const value = form.get("token");
    token = typeof value === "string" ? value : "";
  } catch {
    return away("/signin?status=expired");
  }

  let moved: { from: string; to: string } | null = null;
  try {
    moved = await spendMoveLink(token);
  } catch (error) {
    console.error("address move failed", error);
  }
  if (!moved) return away("/signin?status=expired");

  let sessionId: string;
  try {
    const result = await moveAccount(moved.from, moved.to);
    if (!result.ok) return away(`/signin?status=move-${result.reason}`);
    await endAllSessions(moved.from);
    sessionId = await openSession(moved.to);
  } catch (error) {
    console.error("address move failed", error);
    return away("/signin?status=move-error");
  }

  const response = away("/studio?address=moved");
  const options = SESSION_COOKIE_OPTIONS;
  response.headers.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${sessionId}`,
      `Path=${options.path}`,
      `Max-Age=${options.maxAge}`,
      "HttpOnly",
      "SameSite=Lax",
      options.secure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return response;
}
