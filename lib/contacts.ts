/**
 * A store's list: everyone who gave the creator their address, and whether
 * they agreed to hear more.
 *
 * Three ways onto it as someone the creator may write to, and none of them is
 * a box ticked for anyone:
 *
 *   - asking for something free and ticking "also send me emails", then using
 *     the link we emailed (so the address is proved);
 *   - buying something and ticking the same box on the store page;
 *   - being imported by the creator, who confirms each time that the people
 *     on their file agreed to hear from them.
 *
 * One way off: the unsubscribe link in every email, which works in one press
 * and is kept for good. Nothing — an import, a later purchase without the box
 * — puts somebody back on who left, except that person ticking the box again.
 *
 *   nl:store:leads:<listId>          address -> Contact (JSON)
 *   nl:store:leads:<listId>:agreed   how many agreed, ever
 *   nl:store:leads:<listId>:unsub    how many of those have since left
 *   nl:mail:unsub:<token>            listId|address|handle, for the link in an email
 */
import { randomBytes } from "node:crypto";
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, normaliseEmail } from "@/lib/auth";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";

/** How many addresses one store's list may hold. */
export const MAX_LEADS = 100_000;
/** How many product names one address keeps. */
const MAX_TITLES = 20;
/** How many addresses one import may bring. */
export const MAX_IMPORT = 5_000;

export type ContactSource = "free" | "buyer" | "import";

export type Contact = {
  /** Agreed to hear from the creator. */
  agreed: boolean;
  agreedAt: string;
  firstAt: string;
  lastAt: string;
  /** What they asked for or bought, by the name it had at the time. */
  titles: string[];
  /** The same, by product id, so a list can be narrowed to one product. */
  ids: string[];
  /** How they first agreed. */
  source: ContactSource | "";
  /** Left through the unsubscribe link. Kept for good. */
  unsub: boolean;
  unsubAt: string;
  /** The token in their unsubscribe link, made the first time they are sent to. */
  t: string;
};

export const leadsKey = (listId: string) => `nl:store:leads:${listId}`;
export const agreedKey = (listId: string) => `nl:store:leads:${listId}:agreed`;
export const unsubKey = (listId: string) => `nl:store:leads:${listId}:unsub`;
const tokenKey = (token: string) => `nl:mail:unsub:${token}`;
export const UNSUB_TOKEN = /^[0-9a-f]{40}$/;

export function parseContact(raw: unknown): Contact | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Contact>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((t): t is string => typeof t === "string").slice(-MAX_TITLES) : []);
    return {
      agreed: value.agreed === true,
      agreedAt: typeof value.agreedAt === "string" ? value.agreedAt : "",
      firstAt: typeof value.firstAt === "string" ? value.firstAt : "",
      lastAt: typeof value.lastAt === "string" ? value.lastAt : "",
      titles: list(value.titles),
      ids: list(value.ids),
      source: value.source === "free" || value.source === "buyer" || value.source === "import" ? value.source : "",
      unsub: value.unsub === true,
      unsubAt: typeof value.unsubAt === "string" ? value.unsubAt : "",
      t: typeof value.t === "string" && UNSUB_TOKEN.test(value.t) ? value.t : "",
    };
  } catch {
    return null;
  }
}

/** Whether the creator may email this person now. */
export function mailable(contact: Contact): boolean {
  return contact.agreed && !contact.unsub;
}

export type AddResult = {
  /** Now on the list as someone who may be written to, and was not before. */
  joined: boolean;
  /** Newly recorded as having got or bought this product. */
  gotProduct: boolean;
  full: boolean;
};

/**
 * Puts an address on the list, or updates it.
 *
 * `agreed` is what this person said this time. An explicit yes — the box
 * ticked by them — also undoes an earlier unsubscribe; an import never does.
 */
export async function upsertContact(
  listId: string,
  rawEmail: string,
  input: { agreed: boolean; explicit: boolean; source: ContactSource; productId?: string; title?: string; at?: string },
): Promise<AddResult> {
  const none = { joined: false, gotProduct: false, full: false };
  if (!isRedisConfigured() || !listId) return none;
  const email = normaliseEmail(rawEmail);
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return none;
  const key = leadsKey(listId);
  const [raw, size] = await redisPipeline([
    ["HGET", key, email],
    ["HLEN", key],
  ]);
  const before = parseContact(raw);
  if (!before && Number(size) >= MAX_LEADS) return { ...none, full: true };

  const now = new Date().toISOString();
  const wasMailable = before ? mailable(before) : false;
  const agreed = Boolean(before?.agreed) || input.agreed;
  const resubscribe = Boolean(before?.unsub) && input.agreed && input.explicit;
  const titles = before ? [...before.titles] : [];
  if (input.title && !titles.includes(input.title)) titles.push(input.title);
  const ids = before ? [...before.ids] : [];
  const gotProduct = Boolean(input.productId) && !ids.includes(input.productId!);
  if (input.productId && gotProduct) ids.push(input.productId);

  const next: Contact = {
    agreed,
    agreedAt: before?.agreed ? before.agreedAt : input.agreed ? input.at || now : "",
    firstAt: before?.firstAt || now,
    lastAt: now,
    titles: titles.slice(-MAX_TITLES),
    ids: ids.slice(-MAX_TITLES),
    source: before?.source || input.source,
    unsub: resubscribe ? false : Boolean(before?.unsub),
    unsubAt: resubscribe ? "" : before?.unsubAt ?? "",
    t: before?.t ?? "",
  };
  const commands: (string | number)[][] = [["HSET", key, email, JSON.stringify(next)]];
  if (input.agreed && !before?.agreed) commands.push(["INCR", agreedKey(listId)]);
  if (resubscribe) commands.push(["DECR", unsubKey(listId)]);
  await redisPipeline(commands);
  return { joined: mailable(next) && !wasMailable, gotProduct, full: false };
}

/**
 * Notes that someone already on the list got a product, without adding
 * anyone who is not. Says whether they may be written to.
 */
export async function noteProduct(listId: string, rawEmail: string, productId: string, title: string): Promise<boolean> {
  if (!isRedisConfigured() || !listId) return false;
  const email = normaliseEmail(rawEmail);
  const [raw] = await redisPipeline([["HGET", leadsKey(listId), email]]);
  const before = parseContact(raw);
  if (!before) return false;
  if (!before.ids.includes(productId)) {
    const next: Contact = {
      ...before,
      lastAt: new Date().toISOString(),
      ids: [...before.ids, productId].slice(-MAX_TITLES),
      titles: (before.titles.includes(title) ? before.titles : [...before.titles, title]).slice(-MAX_TITLES),
    };
    await redisPipeline([["HSET", leadsKey(listId), email, JSON.stringify(next)]]);
  }
  return mailable(before);
}

/** Whether this address may be written to now. */
export async function isMailable(listId: string, rawEmail: string): Promise<boolean> {
  if (!isRedisConfigured() || !listId) return false;
  const [raw] = await redisPipeline([["HGET", leadsKey(listId), normaliseEmail(rawEmail)]]);
  const contact = parseContact(raw);
  return contact !== null && mailable(contact);
}

/**
 * Brings in addresses the creator says agreed to hear from them, a few
 * hundred per round trip. Nobody who left is put back, and nobody already on
 * the list is changed except to mark that they agreed.
 */
export async function importContacts(
  listId: string,
  emails: string[],
): Promise<{ added: number; already: number; full: boolean }> {
  if (!isRedisConfigured() || !listId || !emails.length) return { added: 0, already: emails.length, full: false };
  const key = leadsKey(listId);
  const [size] = await redisPipeline([["HLEN", key]]);
  let room = MAX_LEADS - (Number(size) || 0);
  const now = new Date().toISOString();
  let added = 0;
  let full = false;
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    const [rows] = await redisPipeline([["HMGET", key, ...chunk]]);
    const found = Array.isArray(rows) ? rows : [];
    const pairs: string[] = [];
    let newlyAgreed = 0;
    chunk.forEach((email, j) => {
      const before = parseContact(found[j]);
      if (!before) {
        if (room <= 0) {
          full = true;
          return;
        }
        room -= 1;
      }
      if (before && (before.agreed || before.unsub)) return;
      const next: Contact = {
        agreed: true,
        agreedAt: now,
        firstAt: before?.firstAt || now,
        lastAt: now,
        titles: before?.titles ?? [],
        ids: before?.ids ?? [],
        source: before?.source || "import",
        unsub: false,
        unsubAt: "",
        t: before?.t ?? "",
      };
      pairs.push(email, JSON.stringify(next));
      newlyAgreed += 1;
    });
    if (pairs.length) {
      await redisPipeline([
        ["HSET", key, ...pairs],
        ["INCRBY", agreedKey(listId), newlyAgreed],
      ]);
      added += newlyAgreed;
    }
  }
  return { added, already: emails.length - added, full };
}

/**
 * The token for each address's unsubscribe link, made once and kept. Read at
 * the moment of sending, so anyone who left since the send began is not in
 * the answer and is not written to.
 */
export async function tokensFor(listId: string, emails: string[], handle: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!emails.length) return out;
  const key = leadsKey(listId);
  const [rows] = await redisPipeline([["HMGET", key, ...emails]]);
  const found = Array.isArray(rows) ? rows : [];
  const writes: (string | number)[][] = [];
  emails.forEach((email, i) => {
    const contact = parseContact(found[i]);
    if (!contact || !mailable(contact)) return;
    if (contact.t) {
      out.set(email, contact.t);
      return;
    }
    const t = randomBytes(20).toString("hex");
    out.set(email, t);
    writes.push(["HSET", key, email, JSON.stringify({ ...contact, t })]);
    writes.push(["SET", tokenKey(t), `${listId}|${email}|${handle}`]);
  });
  if (writes.length) await redisPipeline(writes);
  return out;
}

/** Who an unsubscribe link belongs to, without acting on it. */
export async function readUnsubToken(
  token: string,
): Promise<{ listId: string; email: string; handle: string; contact: Contact } | null> {
  if (!UNSUB_TOKEN.test(token) || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", tokenKey(token)]]);
  if (typeof raw !== "string") return null;
  // listId|address|handle — an address may itself hold a "|".
  const first = raw.indexOf("|");
  const last = raw.lastIndexOf("|");
  if (first < 1 || last <= first) return null;
  const listId = raw.slice(0, first);
  const email = raw.slice(first + 1, last);
  const handle = raw.slice(last + 1);
  if (!email) return null;
  const [row] = await redisPipeline([["HGET", leadsKey(listId), email]]);
  const contact = parseContact(row);
  return contact && contact.t === token ? { listId, email, handle, contact } : null;
}

/** Takes an address off the list for good. Safe to press twice. */
export async function unsubscribe(token: string): Promise<{ listId: string; email: string } | null> {
  const found = await readUnsubToken(token);
  if (!found) return null;
  const { listId, email, contact } = found;
  if (contact.unsub) return { listId, email };
  const next: Contact = { ...contact, unsub: true, unsubAt: new Date().toISOString() };
  const commands: (string | number)[][] = [["HSET", leadsKey(listId), email, JSON.stringify(next)]];
  if (contact.agreed) commands.push(["INCR", unsubKey(listId)]);
  await redisPipeline(commands);
  return { listId, email };
}

export type ListCounts = { total: number; agreed: number; left: number; mailable: number; full: boolean };

export async function listCounts(listId: string | null): Promise<ListCounts> {
  if (!listId || !isRedisConfigured()) return { total: 0, agreed: 0, left: 0, mailable: 0, full: false };
  const [total, agreed, left] = await redisPipeline([
    ["HLEN", leadsKey(listId)],
    ["GET", agreedKey(listId)],
    ["GET", unsubKey(listId)],
  ]);
  const t = Number(total) || 0;
  const a = Math.min(t, Number(agreed) || 0);
  const l = Math.min(a, Math.max(0, Number(left) || 0));
  return { total: t, agreed: a, left: l, mailable: a - l, full: t >= MAX_LEADS };
}

/**
 * Walks the whole list, page by page, calling `each` for every address. A
 * large list never has to fit in one answer from Redis.
 */
export async function forEachContact(
  listId: string,
  each: (email: string, contact: Contact) => void,
): Promise<void> {
  if (!isRedisConfigured()) return;
  const key = leadsKey(listId);
  let cursor = "0";
  for (let page = 0; page < MAX_LEADS / 500 + 10; page += 1) {
    const [reply] = await redisPipeline([["HSCAN", key, cursor, "COUNT", 1000]]);
    if (!Array.isArray(reply) || reply.length < 2) break;
    cursor = String(reply[0]);
    const flat = Array.isArray(reply[1]) ? (reply[1] as unknown[]) : [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const contact = parseContact(flat[i + 1]);
      if (contact) each(String(flat[i]), contact);
    }
    if (cursor === "0") break;
  }
}

/** Everyone the creator may write to, narrowed to one product when asked. */
export async function audience(listId: string, productId?: string): Promise<string[]> {
  const out: string[] = [];
  await forEachContact(listId, (email, contact) => {
    if (!mailable(contact)) return;
    if (productId && !contact.ids.includes(productId)) return;
    out.push(email);
  });
  return out;
}

/** Addresses read out of whatever the creator pasted or uploaded. */
export function readAddresses(text: string): { emails: string[]; skipped: number } {
  const found = new Set<string>();
  let skipped = 0;
  for (const piece of text.split(/[\s,;"'<>()]+/)) {
    const candidate = piece.trim();
    if (!candidate.includes("@")) continue;
    const email = normaliseEmail(candidate);
    if (email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email)) found.add(email);
    else skipped += 1;
  }
  return { emails: [...found], skipped };
}
