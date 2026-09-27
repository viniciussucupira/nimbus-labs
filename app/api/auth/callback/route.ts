import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  endSession,
  spendSignInLink,
} from "@/lib/auth";
import { fromAnotherSite, limited } from "@/lib/request-guard";

/**
 * Finishing the emailed link.
 *
 * A GET spends nothing. Mail filters fetch every link in a message to inspect
 * it, and a one-time link that a GET could spend would be used up before the
 * creator ever tapped it. So a GET only carries the token to the page that
 * asks for a tap, and the POST that tap makes is what opens the session.
 */

function redirectTo(origin: string, path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: `${origin}${path}` },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const origin = originFrom(request);
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return redirectTo(origin, "/signin?status=expired");
  }
  return redirectTo(origin, `/signin/confirm?token=${token}`);
}

export async function POST(request: NextRequest) {
  const origin = originFrom(request);

  // A form on another site must not be able to sign this browser into an
  // account of the attacker's choosing.
  // Refused before anything else is read: another site, by Origin or by
  // Sec-Fetch-Site (lib/request-guard.ts).
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });

  let token = "";
  try {
    const form = await (await limited(request, 8_000)).formData();
    const value = form.get("token");
    token = typeof value === "string" ? value : "";
  } catch {
    return redirectTo(origin, "/signin?status=expired");
  }

  let sessionId: string | null = null;
  try {
    sessionId = await spendSignInLink(token);
  } catch (error) {
    console.error("sign-in callback failed", error);
  }

  if (!sessionId) {
    return redirectTo(origin, "/signin?status=expired");
  }

  // A session this browser already held is closed, not kept alongside: the
  // new one is always freshly made here, and nothing set before signing in —
  // by another tab, another person on this computer, or a planted cookie —
  // outlives the sign-in.
  const previous = request.cookies.get(SESSION_COOKIE)?.value;
  if (previous && previous !== sessionId) await endSession(previous);

  const response = redirectTo(origin, "/studio");
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
