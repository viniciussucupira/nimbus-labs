import type { NextRequest } from "next/server";
import { AFFILIATE_CODE_PATTERN, VIA_COOKIE_SECONDS, viaCookieName, viaCookieValue } from "@/lib/affiliate-setting";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { fromAnotherSite, limited } from "@/lib/request-guard";

const MAX_BODY_BYTES = 500;

/**
 * Remembers which affiliate's link brought a visitor, after they said yes.
 *
 * Where the law asks for consent before such a cookie (proxy.ts, lib/pixels.ts
 * needsConsent), the proxy does not set it on arrival; the store page asks,
 * and this sets the very cookie the proxy sets everywhere else, with the time
 * of the yes as the time of the click. Whether the code is real, and still
 * inside the window, is decided at the checkout, as for any click.
 */
export async function POST(request: NextRequest) {
  const done = (status = 204) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (fromAnotherSite(request)) return done(403);
  let body: Record<string, unknown> = {};
  try {
    const raw = await (await limited(request, MAX_BODY_BYTES)).text();
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return done(400);
  }
  const handle = normaliseHandle(typeof body.h === "string" ? body.h.slice(0, 40) : "");
  const code = typeof body.c === "string" ? body.c.slice(0, 20).toLowerCase() : "";
  if (!handle || !AFFILIATE_CODE_PATTERN.test(code)) return done(400);
  const store = await storeForHandle(handle).catch(() => null);
  if (!store?.affiliates.enabled) return done();
  const response = done();
  const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const name = viaCookieName(store.handle);
  // The same value the proxy writes, first click and all, so a visitor who
  // consented here is not treated differently from one who never had to.
  const value = viaCookieValue(request.cookies.get(name)?.value, code, Date.now() / 1000);
  response.headers.append(
    "Set-Cookie",
    `${name}=${value}; Path=/; Max-Age=${VIA_COOKIE_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return response;
}
