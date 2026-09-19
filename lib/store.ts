/**
 * A creator's store: the handle, and the few facts the public page shows.
 *
 * Two records in Redis, both plain and both small:
 *
 *   nl:store:handle:<handle>  -> the owner's email, written with NX so a
 *                                handle can never be taken twice
 *   nl:store:owner:<hash>     -> the store itself, as JSON
 *
 * The handle record is the lock. It is written first and only if free, so two
 * people asking for the same name at the same moment cannot both win.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import type { ProductFile } from "@/lib/product-file";

/**
 * What an address may look like: 3 to 24 characters, starting and ending with
 * a letter or a number, with dots, hyphens and underscores allowed in between.
 *
 * Those three are there on purpose. A creator whose name everywhere else is
 * maria.souza or maria_souza should be able to keep it here instead of
 * inventing a different one for this store alone.
 */
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,22}[a-z0-9])$/;
export const MAX_NAME_LENGTH = 60;
export const MAX_BIO_LENGTH = 160;

/** Names the site itself uses, or may use, so a store can never shadow one. */
const RESERVED = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "blog",
  "contact",
  "creators",
  "demo",
  "docs",
  "for",
  "help",
  "home",
  "legal",
  "login",
  "mission",
  "new",
  "nimbus",
  "nimbuslabs",
  "platform",
  "pricing",
  "privacy",
  "proof",
  "refunds",
  "root",
  "settings",
  "signin",
  "signup",
  "store",
  "studio",
  "support",
  "terms",
  "www",
]);

/**
 * How many addresses one store may ever hold, counting the one it uses now.
 *
 * There is no waiting between changes: a creator who mistypes a name fixes it
 * a second later. The only limit is this one, and it exists because an old
 * address stays held by the store so its published links keep working —
 * without a ceiling, a single account could sit on every good name and leave
 * nothing for anyone else. It is a ceiling on what one store holds at once:
 * letting an address go frees the slot and hands the name back.
 */
export const MAX_ADDRESSES = 10;

/**
 * How long a released address stays dark before anyone may take it.
 *
 * Letting go of an address frees the slot at once, but the name does not go
 * straight back on the shelf. For a month it answers nothing at all, so a link
 * still printed somewhere leads to a dead end rather than to the store of a
 * stranger. The creator waits for nothing; only the next taker does.
 */
export const RELEASE_QUARANTINE_DAYS = 30;

/** Marks a name that was let go and is not owned by anyone yet. */
const RELEASED_PREFIX = "released:";

/** How many things one store may list. */
export const MAX_PRODUCTS = 20;
export const MAX_TITLE_LENGTH = 80;
export const MAX_SUMMARY_LENGTH = 300;

/**
 * The price, in cents, and the two ends of what may be typed.
 *
 * Prices are held as whole cents so no amount is ever a rounded float, and
 * every store here charges in US dollars. A store that needs another currency
 * cannot be served honestly yet, and the studio says so rather than pretending
 * the field is neutral.
 */
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 500_000;

/** One thing a store offers. */
export type Product = {
  id: string;
  title: string;
  summary: string;
  priceCents: number;
  createdAt: string;
  /** The file the buyer gets, once the creator has put one there. */
  file: ProductFile | null;
};

export type Store = {
  handle: string;
  name: string;
  bio: string;
  email: string;
  createdAt: string;
  /** Addresses this store used before. They lead here until it lets them go. */
  previousHandles: string[];
  renamedAt: string;
  /** What the store lists, in the order the creator put them in. */
  products: Product[];
};

export function normaliseHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export type HandleProblem = "shape" | "reserved" | null;

export function handleProblem(handle: string): HandleProblem {
  if (!HANDLE_PATTERN.test(handle)) return "shape";
  if (RESERVED.has(handle)) return "reserved";
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const ownerKey = async (email: string) =>
  `nl:store:owner:${(await sha256Hex(`nimbus-store:${email.toLowerCase()}`)).slice(0, 40)}`;

const handleKey = (handle: string) => `nl:store:handle:${handle}`;

/**
 * The folder in the file store that belongs to one account.
 *
 * Derived from the email, so it cannot be guessed from a store address, and
 * salted differently from the Redis key so that seeing one never gives the
 * other.
 */
export async function storeFolder(email: string): Promise<string> {
  return (await sha256Hex(`nimbus-files:${email.toLowerCase()}`)).slice(0, 32);
}

function parseFile(raw: unknown): ProductFile | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ProductFile>;
  if (typeof value.pathname !== "string" || !value.pathname) return null;
  if (typeof value.name !== "string" || !value.name) return null;
  if (typeof value.bytes !== "number" || !Number.isFinite(value.bytes)) {
    return null;
  }
  return {
    pathname: value.pathname,
    name: value.name,
    bytes: value.bytes,
    contentType:
      typeof value.contentType === "string" ? value.contentType : "",
    addedAt: typeof value.addedAt === "string" ? value.addedAt : "",
  };
}

function parseProducts(raw: unknown): Product[] {
  if (!Array.isArray(raw)) return [];
  const products: Product[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Partial<Product>;
    if (typeof value.id !== "string" || !value.id) continue;
    if (typeof value.title !== "string" || !value.title) continue;
    if (typeof value.priceCents !== "number") continue;
    if (!Number.isInteger(value.priceCents) || value.priceCents < 0) continue;
    products.push({
      id: value.id,
      title: value.title.slice(0, MAX_TITLE_LENGTH),
      summary:
        typeof value.summary === "string"
          ? value.summary.slice(0, MAX_SUMMARY_LENGTH)
          : "",
      priceCents: value.priceCents,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
      file: parseFile(value.file),
    });
    if (products.length >= MAX_PRODUCTS) break;
  }
  return products;
}

function parseStore(raw: unknown): Store | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Store>;
    if (!value.handle || !value.name || !value.email) return null;
    return {
      handle: value.handle,
      name: value.name,
      bio: value.bio ?? "",
      email: value.email,
      createdAt: value.createdAt ?? "",
      previousHandles: Array.isArray(value.previousHandles)
        ? value.previousHandles.filter((h) => typeof h === "string")
        : [],
      renamedAt: value.renamedAt ?? "",
      products: parseProducts(value.products),
    };
  } catch {
    return null;
  }
}

/**
 * Reads a typed price into whole cents.
 *
 * Only a plain amount is accepted — 27, 27.5, 27.50 — with no currency sign,
 * no thousands separator and no more than two decimals, because every one of
 * those is a way for what the creator meant and what the page charges to drift
 * apart. Returns null when the text is not one unambiguous amount.
 */
export function priceToCents(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * The price as a person reads it: 2700 becomes "27" and 2750 becomes "27.50".
 *
 * The round amount loses its two zeros because that is how a price is written
 * on a page, and feeding this back into priceToCents gives the same cents, so
 * the editor can show it in the field the creator typed it into.
 */
export function centsToPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

/** The store belonging to a signed-in creator, or null if they have none. */
export async function storeForEmail(
  email: string | null,
): Promise<Store | null> {
  if (!email || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", await ownerKey(email)]]);
  return parseStore(raw);
}

/** The store behind a public address, or null if that handle is free. */
export async function storeForHandle(handle: string): Promise<Store | null> {
  if (!isRedisConfigured()) return null;
  if (handleProblem(handle)) return null;
  const [email] = await redisPipeline([["GET", handleKey(handle)]]);
  if (typeof email !== "string" || !email) return null;
  // A name that was let go is held, not owned: it leads nowhere on purpose.
  if (email.startsWith(RELEASED_PREFIX)) return null;
  const [raw] = await redisPipeline([["GET", await ownerKey(email)]]);
  return parseStore(raw);
}

export type ClaimResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "taken" | "reserved" | "shape" | "already" };

/**
 * Reserves a handle for a creator and creates their store.
 *
 * One store per account, and the handle is the address other people will
 * bookmark, so neither is handed out twice.
 */
export async function claimHandle(
  email: string,
  rawHandle: string,
  rawName: string,
  rawBio: string,
): Promise<ClaimResult> {
  const handle = normaliseHandle(rawHandle);
  const problem = handleProblem(handle);
  if (problem) return { ok: false, reason: problem };

  const existing = await storeForEmail(email);
  if (existing) return { ok: false, reason: "already" };

  const [taken] = await redisPipeline([
    ["SET", handleKey(handle), email.toLowerCase(), "NX"],
  ]);
  if (taken === null) return { ok: false, reason: "taken" };

  const store: Store = {
    handle,
    name: rawName.trim().slice(0, MAX_NAME_LENGTH) || handle,
    bio: rawBio.trim().slice(0, MAX_BIO_LENGTH),
    email: email.toLowerCase(),
    createdAt: new Date().toISOString(),
    previousHandles: [],
    renamedAt: "",
    products: [],
  };

  try {
    await redisPipeline([
      ["SET", await ownerKey(email), JSON.stringify(store)],
    ]);
  } catch (error) {
    // Give the name back rather than leaving it locked to a store that does
    // not exist.
    await redisPipeline([["DEL", handleKey(handle)]]).catch(() => {});
    throw error;
  }

  return { ok: true, store };
}

export type RenameResult =
  | { ok: true; store: Store }
  | {
      ok: false;
      reason: "taken" | "reserved" | "shape" | "none" | "same" | "too_many";
      limit?: number;
    };

/**
 * Moves a store to a new address without breaking the old one.
 *
 * The first address a creator picks is usually picked in a hurry, and by then
 * it is already in their bio, in old posts and in messages other people sent.
 * So the old address is never handed to anyone else and never stops working:
 * it keeps pointing at this store, and the page sends visitors on to the new
 * address by itself. Nothing published has to be redone.
 *
 * Nobody has to be asked, and nothing has to be waited for. The creator does
 * it alone, and it takes effect on the spot.
 */
export async function renameHandle(
  email: string,
  rawHandle: string,
): Promise<RenameResult> {
  const handle = normaliseHandle(rawHandle);
  const problem = handleProblem(handle);
  if (problem) return { ok: false, reason: problem };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (store.handle === handle) return { ok: false, reason: "same" };

  // Going back to an address this store already owns costs nothing: no new
  // lock, and no room on the shelf, because it never stopped being theirs.
  if (!store.previousHandles.includes(handle)) {
    if (store.previousHandles.length + 2 > MAX_ADDRESSES) {
      return { ok: false, reason: "too_many", limit: MAX_ADDRESSES };
    }
    const [taken] = await redisPipeline([
      ["SET", handleKey(handle), email.toLowerCase(), "NX"],
    ]);
    if (taken === null) return { ok: false, reason: "taken" };
  }

  const next: Store = {
    ...store,
    handle,
    previousHandles: [
      ...store.previousHandles.filter((old) => old !== handle),
      store.handle,
    ].slice(-20),
    renamedAt: new Date().toISOString(),
  };

  await redisPipeline([["SET", await ownerKey(email), JSON.stringify(next)]]);
  return { ok: true, store: next };
}

export type ReleaseResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "current" | "unknown" };

/**
 * Lets go of an address the store used before.
 *
 * This is the one destructive thing a creator can do to their own audience,
 * so it is never automatic and never implied: a link still printed under that
 * name stops working the moment it is released, and a month later the name
 * may belong to somebody else. It exists because the opposite is worse. An
 * address mistyped and abandoned a minute later, never published anywhere,
 * would otherwise sit on a slot for good.
 *
 * Freeing the slot costs the name: it goes back on the shelf rather than
 * staying quietly in this account. That is what keeps the ceiling honest —
 * nobody can pile up names by releasing them.
 */
export async function releaseHandle(
  email: string,
  rawHandle: string,
): Promise<ReleaseResult> {
  const handle = normaliseHandle(rawHandle);

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (store.handle === handle) return { ok: false, reason: "current" };
  if (!store.previousHandles.includes(handle)) {
    return { ok: false, reason: "unknown" };
  }

  await redisPipeline([
    [
      "SET",
      handleKey(handle),
      `${RELEASED_PREFIX}${new Date().toISOString()}`,
      "EX",
      RELEASE_QUARANTINE_DAYS * 24 * 60 * 60,
    ],
  ]);

  const next: Store = {
    ...store,
    previousHandles: store.previousHandles.filter((old) => old !== handle),
  };
  await redisPipeline([["SET", await ownerKey(email), JSON.stringify(next)]]);

  return { ok: true, store: next };
}

/**
 * Writes a store back under its owner.
 *
 * Everything below reads the store, changes one thing and writes the whole
 * record back. Two edits fired at the very same instant from two open tabs
 * would leave only the second one, which is the honest cost of keeping the
 * store in a single small record. One person editing their own store does not
 * meet that case; if stores ever gain collaborators, this is the line that has
 * to change first.
 */
async function saveStore(store: Store): Promise<void> {
  await redisPipeline([
    ["SET", await ownerKey(store.email), JSON.stringify(store)],
  ]);
}

export type DetailsResult =
  | { ok: true; store: Store }
  | { ok: false; reason: "none" | "name" };

/**
 * Changes the name and the description the public page shows.
 *
 * The address is deliberately not touched here: it is the part other people
 * have written down, so it has a door of its own with its own warnings.
 */
export async function updateDetails(
  email: string,
  rawName: string,
  rawBio: string,
): Promise<DetailsResult> {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) return { ok: false, reason: "name" };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };

  const next: Store = {
    ...store,
    name,
    bio: rawBio.trim().slice(0, MAX_BIO_LENGTH),
  };
  await saveStore(next);
  return { ok: true, store: next };
}

export type ProductResult =
  | { ok: true; store: Store }
  | {
      ok: false;
      reason: "none" | "title" | "price" | "too_many" | "unknown";
      limit?: number;
    };

/** An id no other product in this store is using. */
function freshId(store: Store): string {
  const taken = new Set(store.products.map((product) => product.id));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    if (!taken.has(id)) return id;
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Checks a title and a typed price, and returns the price in cents. */
function readFields(
  rawTitle: string,
  rawPrice: string,
): { title: string; priceCents: number } | "title" | "price" {
  const title = rawTitle.trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) return "title";
  const priceCents = priceToCents(rawPrice);
  if (priceCents === null) return "price";
  if (priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS) {
    return "price";
  }
  return { title, priceCents };
}

/** Adds something to the store, at the end of the list. */
export async function addProduct(
  email: string,
  rawTitle: string,
  rawSummary: string,
  rawPrice: string,
): Promise<ProductResult> {
  const fields = readFields(rawTitle, rawPrice);
  if (typeof fields === "string") return { ok: false, reason: fields };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (store.products.length >= MAX_PRODUCTS) {
    return { ok: false, reason: "too_many", limit: MAX_PRODUCTS };
  }

  const product: Product = {
    id: freshId(store),
    title: fields.title,
    summary: rawSummary.trim().slice(0, MAX_SUMMARY_LENGTH),
    priceCents: fields.priceCents,
    createdAt: new Date().toISOString(),
    file: null,
  };

  const next: Store = { ...store, products: [...store.products, product] };
  await saveStore(next);
  return { ok: true, store: next };
}

/** Changes something already on the store, keeping its place in the list. */
export async function editProduct(
  email: string,
  id: string,
  rawTitle: string,
  rawSummary: string,
  rawPrice: string,
): Promise<ProductResult> {
  const fields = readFields(rawTitle, rawPrice);
  if (typeof fields === "string") return { ok: false, reason: fields };

  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };

  const products = [...store.products];
  products[at] = {
    ...products[at],
    title: fields.title,
    summary: rawSummary.trim().slice(0, MAX_SUMMARY_LENGTH),
    priceCents: fields.priceCents,
  };

  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next };
}

/** Takes something off the store. */
export async function removeProduct(
  email: string,
  id: string,
): Promise<ProductResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  if (!store.products.some((product) => product.id === id)) {
    return { ok: false, reason: "unknown" };
  }

  const next: Store = {
    ...store,
    products: store.products.filter((product) => product.id !== id),
  };
  await saveStore(next);
  return { ok: true, store: next };
}

/**
 * Moves something one place up or down.
 *
 * The order is the creator's, not ours: the first thing on the page is the
 * thing they want read first, so nothing here sorts by price or by date.
 */
export async function moveProduct(
  email: string,
  id: string,
  direction: "up" | "down",
): Promise<ProductResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };

  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= store.products.length) return { ok: true, store };

  const products = [...store.products];
  [products[at], products[to]] = [products[to], products[at]];

  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next };
}

export type FileResult =
  | { ok: true; store: Store; removed: ProductFile | null }
  | { ok: false; reason: "none" | "unknown" | "invalid" };

/**
 * Puts a file on a product, or takes it off.
 *
 * The blob itself is written and deleted by the route, because that talks to
 * the file store over the network and this does not. What comes back is the
 * file that was displaced, so the caller can delete it once the record that
 * pointed at it is safely written. Deleting it first would risk a product
 * pointing at nothing if the write then failed.
 */
export async function setProductFile(
  email: string,
  id: string,
  file: ProductFile | null,
): Promise<FileResult> {
  const store = await storeForEmail(email);
  if (!store) return { ok: false, reason: "none" };
  const at = store.products.findIndex((product) => product.id === id);
  if (at < 0) return { ok: false, reason: "unknown" };

  const removed = store.products[at].file;
  const products = [...store.products];
  products[at] = { ...products[at], file };

  const next: Store = { ...store, products };
  await saveStore(next);
  return { ok: true, store: next, removed };
}

/** The file on one product, or null. Used before serving a download. */
export async function productFile(
  email: string,
  id: string,
): Promise<{ product: Product; file: ProductFile } | null> {
  const store = await storeForEmail(email);
  if (!store) return null;
  const product = store.products.find((entry) => entry.id === id);
  if (!product || !product.file) return null;
  return { product, file: product.file };
}
