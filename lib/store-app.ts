/**
 * A creator's store as an app on the home screen: its own name, its own
 * icon, its own colour, opening on its own page.
 *
 * A browser installs a site from its web app manifest, and the site-wide one
 * (public/manifest.webmanifest) is Marktmorgen's own: installed from a store,
 * it would put our name and our logo on the buyer's phone and open our home
 * page. So every store gets a manifest of its own, made here from what the
 * store already has — the name, the photo or the first letter of the name on
 * the store's colour, the colour of the page — and served next to the store
 * (app/[handle]/manifest.webmanifest). Nothing new is asked of the creator.
 *
 * Where it opens and what it covers follow the address the buyer installed
 * it from. On marktmorgen.com that is the store's own path, /@handle, and
 * the pages under it (thanks, orders, course, manage). On the creator's own
 * domain, while it is live and on Pro, it is the whole domain, because the
 * whole domain is the store.
 *
 * Nothing in this file touches the network, so the manifest costs one read
 * of the store and nothing else. The icons are drawn by their own route
 * (app/[handle]/app-icon/[size]).
 */
import { createHash } from "node:crypto";
import { lookColours } from "@/lib/store-look";
import { canUseDomain } from "@/lib/domains";
import type { Store } from "@/lib/store";

/** The sizes an icon is drawn at: Apple's home screen, and the two a manifest needs. */
export const ICON_SIZES = [180, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export function isIconSize(value: number): value is IconSize {
  return (ICON_SIZES as readonly number[]).includes(value);
}

/** Whether the request came in on the store's own live domain. */
export function onOwnDomain(store: Store, host: string): boolean {
  return Boolean(store.domain?.liveAt) && store.domain?.name === host && canUseDomain(store);
}

/** Where the installed app opens, and which addresses count as inside it. */
export function appScope(store: Store, host: string): { start: string; scope: string } {
  if (onOwnDomain(store, host)) return { start: "/", scope: "/" };
  const path = `/@${store.handle}`;
  return { start: path, scope: path };
}

/**
 * The name under the icon, where a home screen has room for about twelve
 * letters: the whole name when it fits, else its first word when that does,
 * else the first twelve letters.
 */
export function shortName(name: string): string {
  const clean = name.trim();
  if (clean.length <= 12) return clean;
  const first = clean.split(/\s+/)[0];
  if (first && first.length <= 12) return first;
  return clean.slice(0, 12).trim();
}

/** The colour of the phone's bar around the app: the page's own. */
export function themeColour(store: Store): string {
  const colours = lookColours(store.look);
  return store.look.theme === "bold" ? colours.accent : colours.bg;
}

/** The letter on an icon drawn without a photo. */
export function monogram(store: Store): string {
  const first = Array.from(store.name.trim())[0] ?? "";
  // Only letters the bundled typeface has; anything else takes the first
  // character of the address, which is always a plain letter or digit.
  return (/^[A-Za-z0-9À-ɏ]$/.test(first) ? first : store.handle.slice(0, 1)).toUpperCase();
}

/**
 * A short fingerprint of everything an icon is drawn from, put in its address
 * so a new photo or colour is a new icon and the old one may be kept forever.
 */
export function iconVersion(store: Store): string {
  const source = `${store.photoId ?? ""}|${store.look.theme}|${store.look.accent}|${monogram(store)}`;
  return createHash("sha256").update(source).digest("hex").slice(0, 12);
}

/** Where an icon of this store is served, at this size. */
export function iconUrl(store: Store, size: IconSize): string {
  return `/@${store.handle}/app-icon/${size}.png?v=${iconVersion(store)}`;
}

export type Manifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  lang: string;
  categories: string[];
  icons: { src: string; sizes: string; type: string; purpose: "any" | "maskable" }[];
};

/** The store's web app manifest, for a request that came in on `host`. */
export function storeManifest(store: Store, host: string): Manifest {
  const { start, scope } = appScope(store, host);
  const colours = lookColours(store.look);
  return {
    // Fixed to the store, not the page it was installed from, so installing
    // twice from two of its pages is the same app.
    id: start,
    name: store.name,
    short_name: shortName(store.name),
    description: store.bio || `The store of ${store.name}.`,
    start_url: start,
    scope,
    display: "standalone",
    background_color: colours.bg,
    theme_color: themeColour(store),
    lang: "en",
    categories: ["shopping"],
    icons: [
      { src: iconUrl(store, 192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl(store, 512), sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed on purpose: a phone that crops icons to a circle or a
      // squircle crops the photo or the colour, never a margin.
      { src: iconUrl(store, 512), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
