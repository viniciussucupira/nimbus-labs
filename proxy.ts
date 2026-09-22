import { NextResponse, type NextRequest } from "next/server";
import { handleForDomain } from "@/lib/domains";
import { SITE_URL } from "@/lib/site-url";

/**
 * A creator's own domain, served as their store.
 *
 * On nimbuslabsai.com (and the deployment's own addresses) nothing happens
 * here. On a creator's domain, the root is their store page, the store's own
 * pages keep their short paths (/thanks, /course/…), and anything that belongs
 * to the site itself — signing in, the studio, the help pages — is sent to
 * nimbuslabsai.com, where the session lives.
 *
 * The store page is told which domain it was reached on, so it can send a
 * visitor back to nimbuslabsai.com if the store is no longer on Pro.
 */
const PLATFORM = new URL(SITE_URL).hostname;
const DOMAIN_HEADER = "x-nimbus-domain";
const STORE_PATHS = /^\/(thanks|free|manage|course|book)(\/|$)/;

function isPlatformHost(host: string): boolean {
  return (
    host === "" ||
    host === PLATFORM ||
    host === `www.${PLATFORM}` ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

  if (isPlatformHost(host)) {
    // The header is ours to set; one sent by a visitor is dropped.
    if (!request.headers.has(DOMAIN_HEADER)) return NextResponse.next();
    const headers = new Headers(request.headers);
    headers.delete(DOMAIN_HEADER);
    return NextResponse.next({ request: { headers } });
  }

  const { pathname, search } = request.nextUrl;
  const handle = await handleForDomain(host).catch(() => null);
  if (!handle) return NextResponse.redirect(`${SITE_URL}${pathname}${search}`, 307);

  const headers = new Headers(request.headers);
  headers.set(DOMAIN_HEADER, host);
  const rewrite = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.rewrite(url, { request: { headers } });
  };

  if (pathname === "/") return rewrite(`/@${handle}`);
  if (STORE_PATHS.test(pathname)) return rewrite(`/@${handle}${pathname}`);
  if (pathname === "/unsubscribe") return NextResponse.next({ request: { headers } });
  // The store's own long address works here too; another store's does not.
  const own = pathname.match(/^\/@([^/]+)(\/.*)?$/);
  if (own && decodeURIComponent(own[1]).toLowerCase() === handle) {
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.redirect(`${SITE_URL}${pathname}${search}`, 308);
}

export const config = {
  // Pages only: not the API, not Next's own files, not files with an extension.
  matcher: ["/((?!api/|_next/|.*\\.[a-z0-9]+$).*)"],
};
