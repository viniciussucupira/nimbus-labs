import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { SESSION_COOKIE, endSession } from "@/lib/auth";

/** Closes the session here and in the browser. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return new Response("forbidden", { status: 403 });
      }
    } catch {
      return new Response("forbidden", { status: 403 });
    }
  }

  await endSession(request.cookies.get(SESSION_COOKIE)?.value);

  const response = new Response(null, {
    status: 303,
    headers: { Location: `${originFrom(request)}/signin?status=out` },
  });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return response;
}
