import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  spendSignInLink,
} from "@/lib/auth";

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

  let token = "";
  try {
    const form = await request.formData();
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
