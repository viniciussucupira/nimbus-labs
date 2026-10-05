/**
 * Arriving for Zoom: the words in an address, and the cookie that remembers
 * them (lib/meet-providers.ts says who is offered Zoom, and why). Nothing
 * here imports anything, so the proxy can read it on every page view.
 */

/** The word that opens Zoom on one visit to the Video calls page: `?zoom=review`. */
export const ZOOM_REVIEW_QUERY = "zoom=review";

/** Whether an address asks for the review link's view: `?zoom=review`, given as the value of `zoom`. */
export function isZoomReview(value: string | string[] | null | undefined): boolean {
  return value === "review";
}

/**
 * Whether a visit to the Video calls page is for Zoom: by the review link, or
 * by `?from=zoom`, the address the app's listing in Zoom's Marketplace sends
 * people to. Someone who arrives from that listing came to connect Zoom, so
 * the page offers it; which accounts may add the app is still Zoom's to say.
 */
export function arrivedForZoom(query: { zoom?: string | string[]; from?: string | string[] }): boolean {
  return isZoomReview(query.zoom) || query.from === "zoom";
}

/**
 * Remembers, in the browser, that somebody arrived for Zoom. The listing's
 * link is usually opened by somebody who is not logged in yet: they are sent
 * to log in, make a store, and land in the studio, and the word in the
 * address is long gone by the time they open Video calls. This cookie is set
 * when the link is opened (proxy.ts) and read where the word is read, so the
 * Zoom card is there when they get to it. It says nothing about who they are.
 */
export const ZOOM_ARRIVAL_COOKIE = "nl_zoom";
export const ZOOM_ARRIVAL_SECONDS = 30 * 86_400;

/** Whether this browser arrived for Zoom on an earlier visit. */
export function cameForZoom(cookies: { get(name: string): { value: string } | undefined }): boolean {
  return cookies.get(ZOOM_ARRIVAL_COOKIE)?.value === "1";
}
