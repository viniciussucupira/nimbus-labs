/**
 * The rules of a bundle: one product that hands over several of the store's
 * own products at a price of its own.
 *
 * A bundle holds no file, link or lessons of its own. It holds a list of the
 * store's products — two to twenty — and a buyer who pays for it gets every
 * one of them exactly as if each had been bought on its own: its download or
 * its link, its course, its licence key, its stamped PDF, its place on the
 * buyer's list of purchases, the right to review it.
 *
 * What may go in one is what can be handed over whole, once, for good: a
 * one-off paid product with a file, a link or a course with lessons. Not a
 * membership (it ends), not a call (it is a time, booked), not a product with
 * several prices (which one?), not one whose buyer chooses the price, and not
 * another bundle.
 *
 * What a buyer gets is decided when they pay. The list is written onto the
 * checkout itself (bundleMeta), so a creator who changes the bundle later
 * changes it for the next buyer, and everyone who already bought keeps what
 * they paid for.
 *
 * The line a store shows — "$120 of products for $49" — is worked out from
 * the included products' prices as they are now, in the store's currency,
 * and it is shown only when it is true: when the products on their own add
 * up to more than the bundle costs.
 *
 * Pure, so the studio, the store and the server apply the same rules.
 */
import type { Listing } from "@/lib/store";
import { formatMoney } from "@/lib/money";

/** The fewest products a bundle may hold: one would just be the product. */
export const MIN_BUNDLE_ITEMS = 2;
/** The most. Enough for a creator's whole shelf of guides; short enough to read on a phone. */
export const MAX_BUNDLE_ITEMS = 20;

/** What a product id may look like: every id this site has ever made fits. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A bundle's list as it was stored, or null for an ordinary product. Ids are
 * kept once each, in order; a list that is not a list of ids reads as none.
 */
export function parseBundleItems(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string" || !SAFE_ID.test(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_BUNDLE_ITEMS) break;
  }
  return out.length ? out : null;
}

/** Whether this product is a bundle. */
export function isBundle(product: Pick<Listing, "bundle">): boolean {
  return Array.isArray(product.bundle) && product.bundle.length > 0;
}

/**
 * Whether a product can go into a bundle: a one-off paid product with one
 * price that hands over something whole — a file, a link, or a course with
 * at least one lesson. A draft can: selling something only as part of a
 * bundle is a reason to keep it off the store.
 */
export function canBeInBundle(product: Listing): boolean {
  if (product.priceCents <= 0) return false;
  if (product.recurring !== null || product.call !== null || isBundle(product)) return false;
  if (product.options.length > 0 || product.pwyw !== null) return false;
  if (product.course) return product.course.lessons > 0;
  return product.file !== null || product.link !== null;
}

/** Why an included product cannot be in a bundle, in words for the studio. */
export function whyNotInBundle(product: Listing): string | null {
  // Only a checkout of its own counts a sale against a limited number.
  if (canBeInBundle(product)) return product.stock !== null ? "It has a limited number for sale" : null;
  if (product.priceCents <= 0) return "It is free";
  if (product.recurring) return "It is a membership";
  if (product.call) return "It is a call";
  if (isBundle(product)) return "It is a bundle";
  if (product.options.length > 0) return "It has several prices";
  if (product.pwyw) return "Its buyers choose the price";
  if (product.course) return "The course has no lessons yet";
  return "It has nothing to hand over yet";
}

/**
 * Whether a product can itself be made a bundle: a one-off paid product with
 * one price and nothing of its own to hand over. A file, a link or lessons
 * of its own would be one more thing the buyer is promised; take them off
 * first, as for a call or a course.
 */
export type OwnerProblem = "free" | "recurring" | "call" | "course" | "delivery" | "options" | "pwyw";

export function bundleOwnerProblem(product: Listing): OwnerProblem | null {
  if (product.priceCents <= 0) return "free";
  if (product.recurring) return "recurring";
  if (product.call) return "call";
  if (product.course) return "course";
  if (product.file || product.link) return "delivery";
  if (product.options.length > 0) return "options";
  if (product.pwyw) return "pwyw";
  return null;
}

export type BundleProblem = OwnerProblem | "count" | "self" | "unknown" | "kind";

/**
 * Why this list cannot be saved on this product, or null when it can.
 * `listings` holds the listed products as the store has them now.
 */
export function bundleProblem(items: string[], listings: Listing[], owner: Listing): BundleProblem | null {
  return bundleOwnerProblem(owner) ?? itemsProblem(items, listings, owner.id);
}

/** Why a list cannot be what a bundle holds, whatever the bundle; `ownerId` is left out of it. */
export function itemsProblem(items: string[], listings: Listing[], ownerId = ""): "count" | "self" | "unknown" | "kind" | null {
  if (new Set(items).size !== items.length) return "count";
  if (items.length < MIN_BUNDLE_ITEMS || items.length > MAX_BUNDLE_ITEMS) return "count";
  for (const id of items) {
    if (id === ownerId) return "self";
    const found = listings.find((p) => p.id === id);
    if (!found) return "unknown";
    if (!canBeInBundle(found)) return "kind";
    // A sale inside a bundle is not counted against a limited number.
    if (found.stock !== null) return "kind";
  }
  return null;
}

/**
 * What a bundle holds that can be handed over right now, in its order: the
 * products still listed and still whole. What was removed or changed since
 * is left out rather than sold.
 */
export function deliverableItems(bundle: Pick<Listing, "bundle">, listings: Listing[]): Listing[] {
  const byId = new Map(listings.map((p) => [p.id, p]));
  return (bundle.bundle ?? []).map((id) => byId.get(id)).filter((p): p is Listing => Boolean(p && canBeInBundle(p)));
}

/** What the included products cost on their own, together, in the store's smallest unit. */
export function worthOf(items: Pick<Listing, "priceCents">[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.priceCents), 0);
}

/**
 * "$120 of products for $49", in the store's currency — only when the
 * products on their own do cost more than the bundle. Otherwise null, and
 * nothing is claimed.
 */
export function worthWords(items: Pick<Listing, "priceCents">[], priceCents: number, currency: string): string | null {
  const worth = worthOf(items);
  if (worth <= priceCents || items.length < MIN_BUNDLE_ITEMS) return null;
  return `${formatMoney(worth, currency)} of products for ${formatMoney(priceCents, currency)}`;
}

// ---- On the checkout ---------------------------------------------------------

/**
 * Stripe keeps up to 500 characters in one metadata value. Twenty ids of the
 * longest kind need more, so a list is written across up to three keys:
 * "bundle", "bundle_2" and "bundle_3" (and "bump_bundle"… for the product
 * ticked at checkout, "bump2_bundle"… and "bump3_bundle"… for the second and
 * third box).
 */
const META_VALUE = 480;
const META_PARTS = 3;

/**
 * The keys a checkout names the products ticked at checkout under, one per
 * box, in the product's order (lib/product-extras.ts, MAX_BUMPS). The first
 * is the key every order made when a product had one box carries, so those
 * read the same as before. Each has its list under `<key>_bundle` when it is
 * a bundle, and its price and affiliate share under `<key>_cents` and
 * `<key>_rate`.
 */
export const BUMP_KEYS = ["bump", "bump2", "bump3"] as const;
export type BumpKey = (typeof BUMP_KEYS)[number];

export type BundleSlot = "bundle" | `${BumpKey}_bundle`;

/** The products ticked at checkout, by the key each is under, in order. */
export function bumpsFromMeta(meta: Record<string, string | undefined> | null | undefined): { key: BumpKey; id: string }[] {
  if (!meta) return [];
  const out: { key: BumpKey; id: string }[] = [];
  for (const key of BUMP_KEYS) {
    const id = meta[key];
    if (typeof id === "string" && SAFE_ID.test(id) && !out.some((b) => b.id === id)) out.push({ key, id });
  }
  return out;
}

/** The metadata entries that carry one list, by the key they go under. */
export function bundleMeta(slot: BundleSlot, ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const parts: string[] = [];
  let current = "";
  for (const id of ids.filter((x) => SAFE_ID.test(x)).slice(0, MAX_BUNDLE_ITEMS)) {
    const next = current ? `${current},${id}` : id;
    if (next.length > META_VALUE) {
      parts.push(current);
      current = id;
    } else current = next;
  }
  if (current) parts.push(current);
  parts.slice(0, META_PARTS).forEach((part, i) => {
    out[i === 0 ? slot : `${slot}_${i + 1}`] = part;
  });
  return out;
}

/** The list a checkout carries under one key, as it was written; [] for none. */
export function bundleFromMeta(meta: Record<string, string | undefined> | null | undefined, slot: BundleSlot): string[] {
  if (!meta) return [];
  const out: string[] = [];
  for (let i = 0; i < META_PARTS; i += 1) {
    const raw = meta[i === 0 ? slot : `${slot}_${i + 1}`];
    if (typeof raw !== "string" || !raw) break;
    for (const id of raw.split(",")) {
      if (SAFE_ID.test(id) && !out.includes(id)) out.push(id);
    }
  }
  return out.slice(0, MAX_BUNDLE_ITEMS);
}

/**
 * Every product a checkout hands over, by id: the product bought, the one
 * ticked at checkout, and every product of either when it is a bundle, each
 * once. What refunds, reviews, keys, the community's door and courses read.
 * None for a gift, whose buyer is not its owner, or for a purchase for several
 * people, whose places are handed out from its own link.
 */
export function deliveredIds(meta: Record<string, string | undefined> | null | undefined): string[] {
  // A gift hands over nothing to whoever paid: it is the recipient's
  // (lib/gifts.ts), written down under their own address.
  if (meta?.gift) return [];
  // Bought for several: each place is written down under the address that
  // took it (lib/group-buy.ts), the buyer's own included.
  if (meta?.group) return [];
  const added = bumpsFromMeta(meta);
  const ids = [
    meta?.product,
    ...added.map((b) => b.id),
    ...bundleFromMeta(meta, "bundle"),
    ...added.flatMap((b) => bundleFromMeta(meta, `${b.key}_bundle`)),
  ];
  const out: string[] = [];
  for (const id of ids) if (typeof id === "string" && id && !out.includes(id)) out.push(id);
  return out;
}
