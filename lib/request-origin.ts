import type { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site-url";

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

/** The host a request was made to, lower case, without a port. */
export function requestHost(request: { headers: Headers }): string {
  return (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

/** Whether a host is this site itself rather than a creator's own domain. */
export function isPlatformHost(host: string): boolean {
  const platform = new URL(SITE_URL).hostname;
  return (
    host === "" ||
    host === platform ||
    host === `www.${platform}` ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/**
 * The address to put in a link we email, or hand to Stripe to send a buyer
 * back to.
 *
 * The host a request names is chosen by whoever sends it. Every domain a
 * creator connects is served by this same app, so a request sent to one
 * store's domain can name a different store; if the link in the email that
 * follows used that host, the one-time token in it would land on a domain
 * the sender controls the moment they point it somewhere else. So the
 * request's own address is used only when it is this site, or the domain
 * of the very store the link is for; anything else gets this site's own
 * address, where the link works just the same.
 */
export function linkOrigin(
  request: NextRequest,
  store?: { domain: { name: string } | null } | null,
): string {
  const host = requestHost(request);
  if (isPlatformHost(host)) return originFrom(request);
  if (store?.domain && store.domain.name.toLowerCase() === host) return originFrom(request);
  return SITE_URL;
}
