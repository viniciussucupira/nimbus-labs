import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import {
  EMAIL_PATTERN,
  MAX_EMAIL_LENGTH,
  SESSION_COOKIE,
  emailForSession,
  isAuthConfigured,
  normaliseEmail,
  sendMoveLink,
  withinAddressLimit,
} from "@/lib/auth";
import { storeForEmail } from "@/lib/store";

/**
 * Asks to move the sign-in address.
 *
 * Nothing moves here. This only sends the link that can finish the move, and
 * it sends it to the address being moved to, because holding that inbox is
 * the whole proof being asked for.
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

  const back = (status: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${origin}/studio?address=${status}` },
    });

  const email = await emailForSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!email) {
    return new Response(null, {
      status: 303,
      headers: { Location: `${origin}/signin?status=expired` },
    });
  }

  let wanted = "";
  try {
    const form = await request.formData();
    const value = form.get("email");
    wanted = typeof value === "string" ? value.trim() : "";
  } catch {
    return back("invalid");
  }

  if (!wanted || wanted.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(wanted)) {
    return back("invalid");
  }
  if (normaliseEmail(wanted) === normaliseEmail(email)) return back("same");

  // Moving is moving a store. With no store there is nothing to carry, and the
  // creator simply signs in with the other address instead.
  const store = await storeForEmail(email);
  if (!store) return back("none");

  // Refused here rather than at the tap, so that a store which could never
  // land there does not put an invitation in a stranger's inbox first.
  if (await storeForEmail(wanted)) return back("taken");

  if (!isAuthConfigured()) return back("unavailable");

  try {
    if (!(await withinAddressLimit(wanted))) return back("limited");
    await sendMoveLink(email, wanted, origin);
  } catch (error) {
    console.error("address move request failed", error);
    return back("error");
  }

  return back("sent");
}
