/**
 * The checks every studio route makes before it does anything.
 *
 * They run in this order on purpose: a request from another site is turned
 * away before we look at the cookie, and the cookie is settled before any
 * network call goes out. Nothing reaches Stripe on behalf of someone who has
 * not proved they hold the session.
 */
import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { storeForEmail, type Store } from "@/lib/store";

export function away(origin: string, path: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `${origin}${path}` },
  });
}

/** True when the request came from somewhere that is not this site. */
export function fromAnotherSite(request: NextRequest): boolean {
  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!sender || !host) return false;
  try {
    return new URL(sender).host !== host;
  } catch {
    return true;
  }
}

export type Creator = { email: string; store: Store; origin: string };

/**
 * Resolves the creator behind a request, or the response to send instead.
 *
 * `needsStore` is the common case: a route that acts on a store has nothing to
 * act on until the creator has taken an address.
 */
export async function creatorFrom(
  request: NextRequest,
  options: { checkOrigin?: boolean } = {},
): Promise<Creator | Response> {
  const origin = originFrom(request);

  if (options.checkOrigin !== false && fromAnotherSite(request)) {
    return new Response("forbidden", { status: 403 });
  }

  const email = await emailForSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!email) return away(origin, "/signin?status=expired");

  const store = await storeForEmail(email);
  if (!store) return away(origin, "/studio?stripe=nostore");

  return { email, store, origin };
}
