/**
 * The links on a store page that are not for sale.
 *
 * This is the "in bio" half of link in bio. A creator's page is where they
 * send everyone, so it has to be able to point at the rest of their life —
 * the YouTube channel, the Instagram, the newsletter, the booking page they
 * already pay someone else for. A page that can only take money and can never
 * send anyone anywhere is a checkout, not a bio.
 *
 * A link is not a product. It has no price, it never reaches Stripe, and
 * nothing is delivered for it. That is why it lives here instead of as a
 * product with an empty price: a free thing and a thing that is not for sale
 * are different, and the page says which is which.
 *
 * The address itself is checked by readLink in lib/product-link.ts, the same
 * check a paid delivery link gets. Somebody is about to be sent wherever this
 * points and the person who typed it is not us, so it is https only, with no
 * credentials in it and no address that only resolves on the visitor's own
 * machine.
 */

import { readVideo } from "@/lib/sales-page";

/**
 * How many a store may list: a hundred, which is more places than anybody is
 * found in. Each one is small — a title and an address — so a full list is a
 * fraction of what the store's record is allowed to weigh (MAX_STORE_BYTES in
 * lib/store.ts), and the page still reads as a page rather than a directory.
 */
export const MAX_STORE_LINKS = 100;

/** Long enough for "Book a call with me", short enough to read as a button. */
export const MAX_LINK_TITLE_LENGTH = 60;

export type StoreLink = {
  id: string;
  /** What the button says. The creator's words, not the site's name. */
  title: string;
  /** Where it goes, normalised by readLink before it is ever stored. */
  url: string;
  addedAt: string;
  /**
   * Drawn larger, in the store's accent, so the one thing the creator most
   * wants followed is seen first. Optional; stores written before have none.
   */
  spotlight?: boolean;
  /** Shown only from this moment (ISO), and/or only until that one: a launch, a live, a limited offer. */
  from?: string;
  until?: string;
  /** A YouTube, Vimeo or Loom address played on the store page itself instead of opened elsewhere. */
  play?: boolean;
};

/** A moment the creator chose, kept only when it is one; "" when it is not. */
export function linkMoment(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return "";
  const year = new Date(time).getUTCFullYear();
  return year >= 2020 && year <= 2100 ? new Date(time).toISOString() : "";
}

/** Whether a link is on the page at this moment: inside its window, when it has one. */
export function linkShowing(link: StoreLink, now = Date.now()): boolean {
  if (link.from && Date.parse(link.from) > now) return false;
  if (link.until && Date.parse(link.until) <= now) return false;
  return true;
}

/** The links a visitor sees right now, in the creator's order. */
export function showingLinks(links: StoreLink[], now = Date.now()): StoreLink[] {
  return links.filter((link) => linkShowing(link, now));
}

/** Where a link stands in time, for the studio: "live", "soon" (not yet) or "ended". */
export function linkWhen(link: StoreLink, now = Date.now()): "live" | "soon" | "ended" {
  if (link.until && Date.parse(link.until) <= now) return "ended";
  if (link.from && Date.parse(link.from) > now) return "soon";
  return "live";
}

/** The extras a link may carry, from a form or from storage, made consistent. */
export function linkExtras(raw: Record<string, unknown>, playable: boolean): Pick<StoreLink, "spotlight" | "from" | "until" | "play"> {
  const from = linkMoment(raw.from);
  let until = linkMoment(raw.until);
  // An end before the start would hide the link for ever; the end is dropped.
  if (from && until && Date.parse(until) <= Date.parse(from)) until = "";
  return {
    ...(raw.spotlight === true ? { spotlight: true } : {}),
    ...(from ? { from } : {}),
    ...(until ? { until } : {}),
    ...(raw.play === true && playable ? { play: true } : {}),
  };
}

/** Whatever came back from storage, made safe to render. */
export function parseStoreLinks(raw: unknown): StoreLink[] {
  if (!Array.isArray(raw)) return [];
  const links: StoreLink[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Partial<StoreLink>;
    if (typeof value.id !== "string" || !value.id) continue;
    if (typeof value.title !== "string" || !value.title) continue;
    if (typeof value.url !== "string" || !value.url) continue;
    links.push({
      id: value.id,
      title: value.title.slice(0, MAX_LINK_TITLE_LENGTH),
      url: value.url,
      addedAt: typeof value.addedAt === "string" ? value.addedAt : "",
      ...linkExtras(value as Record<string, unknown>, readVideo(value.url) !== null),
    });
    if (links.length >= MAX_STORE_LINKS) break;
  }
  return links;
}
