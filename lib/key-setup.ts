/**
 * How a product hands out licence keys: the setting itself, read and checked
 * without touching anything else. Kept apart from lib/licence-keys.ts, which
 * issues and revokes the keys, so the store's product records
 * (lib/catalog.ts) can read the setting without pulling in the machinery.
 */
import type { Listing } from "@/lib/store";

export const MAX_PREFIX_LENGTH = 12;
export const MIN_GROUPS = 3;
export const MAX_GROUPS = 8;
export const MIN_GROUP_LENGTH = 4;
export const MAX_GROUP_LENGTH = 8;
/** The pool size under which the creator is warned, by default and at most. */
export const DEFAULT_LOW_AT = 20;
export const MAX_LOW_AT = 1_000;

export type KeySource = "pool" | "generated";

/** How a product hands out keys. Kept on the product in the store record. */
export type KeySetup = {
  source: KeySource;
  /** For made keys: what each starts with, and its shape. */
  prefix: string;
  groups: number;
  groupLength: number;
  /** For a pool: the count at or under which the creator is warned. */
  lowAt: number;
};

export const DEFAULT_KEYS: KeySetup = { source: "generated", prefix: "", groups: 4, groupLength: 4, lowAt: DEFAULT_LOW_AT };

function wholeIn(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === "string" && raw.trim() ? Number(raw.trim()) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function cleanPrefix(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim().toUpperCase().replace(/-+$/, "") : "";
  if (text.length > MAX_PREFIX_LENGTH || !/^[A-Z0-9-]*$/.test(text)) return null;
  return text;
}

export function parseKeySetup(raw: unknown): KeySetup | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const source: KeySource | null = value.source === "pool" ? "pool" : value.source === "generated" ? "generated" : null;
  if (!source) return null;
  return {
    source,
    prefix: cleanPrefix(value.prefix) ?? "",
    groups: wholeIn(value.groups, MIN_GROUPS, MAX_GROUPS) ?? DEFAULT_KEYS.groups,
    groupLength: wholeIn(value.groupLength, MIN_GROUP_LENGTH, MAX_GROUP_LENGTH) ?? DEFAULT_KEYS.groupLength,
    lowAt: wholeIn(value.lowAt, 0, MAX_LOW_AT) ?? DEFAULT_LOW_AT,
  };
}

export type SetupProblem = "source" | "prefix" | "groups" | "length" | "low";

/** Reads the studio's form, and says which field is wrong when one is. */
export function readKeySetup(raw: Record<string, unknown>): KeySetup | SetupProblem {
  const source = raw.source === "pool" ? "pool" : raw.source === "generated" ? "generated" : null;
  if (!source) return "source";
  const prefix = cleanPrefix(raw.prefix);
  if (prefix === null) return "prefix";
  const groups = wholeIn(raw.groups, MIN_GROUPS, MAX_GROUPS);
  if (groups === null) return "groups";
  const groupLength = wholeIn(raw.groupLength, MIN_GROUP_LENGTH, MAX_GROUP_LENGTH);
  if (groupLength === null) return "length";
  const lowAt = wholeIn(raw.lowAt === "" ? DEFAULT_LOW_AT : raw.lowAt, 0, MAX_LOW_AT);
  if (lowAt === null) return "low";
  return { source, prefix, groups, groupLength, lowAt };
}

/** Which products may hand out keys: paid, sold once, and delivering a file or a link. */
export function canHaveKeys(product: Listing): boolean {
  // A bundle hands out the keys of the products in it, each its own.
  return product.priceCents > 0 && product.recurring === null && product.call === null && product.course === null && !product.bundle;
}

/**
 * The key set-up that applies right now. A product made a membership or a
 * course after keys were switched on keeps the setting but hands out none.
 */
export function activeKeys(product: Listing): KeySetup | null {
  return product.keys && canHaveKeys(product) ? product.keys : null;
}
