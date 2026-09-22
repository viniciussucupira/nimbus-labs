/**
 * Counting from inside a request: who is asking, and whether it is the
 * creator looking at their own store, which is never counted.
 */
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { type HitKind, recordHit } from "@/lib/stats";
import type { Store } from "@/lib/store";

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function isOwner(request: NextRequest, store: Store): Promise<boolean> {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return false;
  const email = await emailForSession(session).catch(() => null);
  return Boolean(email) && email!.toLowerCase() === store.email.toLowerCase();
}

/**
 * Counts one visit, checkout or link, unless it is the owner's own. Never
 * throws: a count that fails must not stop a sale or a page.
 */
export async function countHit(
  request: NextRequest,
  store: Store,
  hit: { kind: HitKind; id?: string; source?: string },
): Promise<void> {
  try {
    if (await isOwner(request, store)) return;
    await recordHit(store, {
      ...hit,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });
  } catch (error) {
    console.error("counting a visit failed", error);
  }
}
