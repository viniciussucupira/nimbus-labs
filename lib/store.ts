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

export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/;
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
 * address stays locked to the store for good — without a ceiling, a single
 * account could sit on every good name and leave nothing for anyone else.
 */
export const MAX_ADDRESSES = 5;

export type Store = {
  handle: string;
  name: string;
  bio: string;
  email: string;
  createdAt: string;
  /** Addresses this store used before. They still lead here, for good. */
  previousHandles: string[];
  renamedAt: string;
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
    };
  } catch {
    return null;
  }
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
