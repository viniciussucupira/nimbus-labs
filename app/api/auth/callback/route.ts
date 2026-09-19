import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  useSignInLink,
} from "@/lib/auth";

/** Spends the emailed link and opens the session. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const origin = originFrom(request);

  let sessionId: string | null = null;
  try {
    sessionId = await useSignInLink(token);
  } catch (error) {
    console.error("sign-in callback failed", error);
  }

  if (!sessionId) {
    return Response.redirect(`${origin}/signin?status=expired`, 303);
  }

  const response = new Response(null, {
    status: 303,
    headers: { Location: `${origin}/studio` },
  });
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
