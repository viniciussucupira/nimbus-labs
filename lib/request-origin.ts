import type { NextRequest } from "next/server";

/**
 * The address the visitor actually used.
 *
 * Links we email and redirects we issue have to point back at the host the
 * person typed — the custom domain, not whatever name the server answers to
 * inside the platform. Reading it from the request URL is not enough: behind a
 * proxy that is the internal name, which produces links that work for nobody
 * and cookies that are set on the wrong host.
 */
export function originFrom(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return new URL(request.url).origin;

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = forwardedProto ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
