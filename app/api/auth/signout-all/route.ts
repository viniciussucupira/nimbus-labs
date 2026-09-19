import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  SESSION_COOKIE,
  emailForSession,
  endAllSessions,
} from "@/lib/auth";

/**
 * Closes every session this creator has open, on every device.
 *
 * A session lasts thirty days, which is kind on the creator and unkind the day
 * a laptop is lost or borrowed. This is the door that shuts all of them.
 */
export async function POST(request: NextRequest) {
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

  const id = request.cookies.get(SESSION_COOKIE)?.value;
  const email = await emailForSession(id);
  if (email) await endAllSessions(email);

  const response = new Response(null, {
    status: 303,
    headers: { Location: `${originFrom(request)}/signin?status=out-everywhere` },
  });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return response;
}
