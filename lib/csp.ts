/**
 * What a page of ours may load, run and send, as a Content-Security-Policy.
 *
 * Two policies, because the site is served two ways:
 *
 *   - The pages that are rendered for each visit — every store page, on
 *     nimbuslabsai.com and on a creator's own domain, the studio, signing in
 *     and unsubscribing — get a fresh random nonce per response (proxy.ts)
 *     and run only the scripts that carry it, plus what those scripts load
 *     themselves ('strict-dynamic'). That is the strict kind: text a creator
 *     or a buyer typed can never become a script on these pages, whatever
 *     slips through the escaping, because it would not carry the nonce. The
 *     creator's own ad pixels are started by our code, so they load under the
 *     same rule, and only the addresses those four platforms send their
 *     measurements to are added to what a page may connect to. The three
 *     video players a product's page may show (lib/sales-page.ts) are the
 *     only other addresses such a page may put in a frame, and only their
 *     embed hosts — YouTube's privacy-enhanced one, Vimeo's player and
 *     Loom's embed — never the sites themselves. Both lists are given to a
 *     store's own pages only; the studio, signing in and unsubscribing get
 *     neither.
 *
 *   - The pages built once, ahead of time — the home page, the help, the
 *     blog, the comparison pages — have no request to make a nonce for, so
 *     Next's own inline scripts are allowed by 'unsafe-inline'. Nothing on
 *     those pages comes from a creator or a visitor, and everything else is
 *     held to this site alone: no script from another address, no connection
 *     to another address, no plug-ins, no <base>, forms only to this site or
 *     an https address.
 *
 * Both let a page be framed only by this site ('self'), because the home page
 * shows the demo store in a frame of its own. Files handed over by the API
 * carry their own, stricter policy (lib/request-guard.ts, fileHeaders).
 *
 * Deliberately left out: 'upgrade-insecure-requests', which would break the
 * site on a local http address and adds nothing to a site that only answers
 * on https and says so with Strict-Transport-Security.
 */

import { VIDEO_FRAME_ORIGINS } from "./sales-page";

/** Where the ad platforms' own scripts send what they measure. */
const PIXEL_CONNECT = [
  // Meta
  "https://connect.facebook.net",
  "https://www.facebook.com",
  // Google tag (Analytics and Ads)
  "https://*.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.g.doubleclick.net",
  "https://www.google.com",
  "https://pagead2.googlesyndication.com",
  // TikTok
  "https://analytics.tiktok.com",
  "https://*.tiktok.com",
  "https://*.tiktokw.us",
  // Pinterest
  "https://ct.pinterest.com",
  "https://s.pinimg.com",
];

/** Frames Google's tag opens for ad conversions. Nothing else is framed from elsewhere. */
const PIXEL_FRAMES = ["https://td.doubleclick.net", "https://www.googletagmanager.com"];

/** Where the studio uploads files to (Vercel Blob), and where lesson videos play from. */
const BLOB_API = "https://vercel.com";
const BLOB_FILES = "https://*.blob.vercel-storage.com";

const dev = () => process.env.NODE_ENV === "development";

function join(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

const shared = (): Record<string, string[]> => ({
  "default-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'", "blob:", BLOB_FILES],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  // Forms go here, and on to where our answers send them: Stripe's pages,
  // a creator's own https link after a free download.
  "form-action": ["'self'", "https:"],
  "frame-ancestors": ["'self'"],
});

/**
 * The policy for a page rendered for this one response, with its nonce.
 *
 * `store` is a store's own page. Only those may reach the ad platforms and
 * frame the three video players: the studio, signing in and unsubscribing
 * run none of that, so for them the list of other addresses stays at the
 * file storage the studio uploads to.
 */
export function dynamicPolicy(nonce: string, options: { store?: boolean } = {}): string {
  const store = options.store !== false;
  return join({
    ...shared(),
    // 'self', https: and 'unsafe-inline' are only for browsers too old to
    // know nonces; every current one ignores them when a nonce is present.
    "script-src": [`'nonce-${nonce}'`, "'strict-dynamic'", "'self'", "https:", "'unsafe-inline'", ...(dev() ? ["'unsafe-eval'"] : [])],
    "connect-src": ["'self'", BLOB_API, BLOB_FILES, ...(store ? PIXEL_CONNECT : [])],
    "frame-src": ["'self'", ...(store ? [...PIXEL_FRAMES, ...VIDEO_FRAME_ORIGINS] : [])],
  });
}

/** Whether a page rendered per visit is a store's own page (under /@, or the demo store's thanks page). */
export function isStorePage(pathname: string): boolean {
  return /^\/(?:@|%40)/i.test(pathname) || /^\/demo\/thanks(\/|$)/.test(pathname);
}

/** The policy for a page built ahead of time, which has no nonce to carry. */
export function staticPolicy(): string {
  return join({
    ...shared(),
    "script-src": ["'self'", "'unsafe-inline'", ...(dev() ? ["'unsafe-eval'"] : [])],
    "connect-src": ["'self'"],
    "frame-src": ["'self'"],
  });
}

/** A nonce: 16 random bytes, base64, new for every response. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

/**
 * Whether a page path is one rendered per visit, and so gets the nonce.
 *
 * Only those: a page built ahead of time has its scripts written without a
 * nonce, and sending it a nonce policy would switch every one of them off.
 * On a creator's own domain every page is a store page, so the proxy asks
 * this about the path it rewrites to, which always starts with /@.
 */
export function isDynamicPage(pathname: string): boolean {
  return /^\/(?:@|%40)/i.test(pathname) || /^\/(studio|signin|unsubscribe)(\/|$)/.test(pathname) || /^\/demo\/thanks(\/|$)/.test(pathname);
}
