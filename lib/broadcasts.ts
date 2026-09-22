/**
 * One-off emails to a creator's list: sent now or at a time they choose.
 *
 * Who receives it is decided the moment it starts, from the people who agreed
 * and have not left, and written down, so a list that changes during a long
 * send neither skips anyone nor sends anyone two. It goes out a hundred at a
 * time, each batch with its own key so a retry never sends it twice, and a
 * send that outlives one run is picked up by the next.
 *
 *   nl:mail:bc:<id>        the broadcast (JSON)
 *   nl:mail:bc:<id>:to     who it goes to, in order (a list)
 *   nl:mail:bcs:<listId>   the store's broadcasts, newest first
 *   nl:mail:queue          broadcasts waiting or under way
 */
import { randomBytes } from "node:crypto";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { audience } from "@/lib/contacts";
import { BATCH_SIZE, MAX_MAIL_BODY, MAX_SUBJECT, monthlyAllowance, sendTo, usedThisMonth } from "@/lib/mail";
import type { Store } from "@/lib/store";

export type BroadcastStatus = "scheduled" | "sending" | "sent" | "waiting" | "cancelled" | "failed";

export type Broadcast = {
  id: string;
  listId: string;
  handle: string;
  subject: string;
  body: string;
  /** Everyone who may be written to, or only those who got one product. */
  productId: string | null;
  status: BroadcastStatus;
  createdAt: number;
  sendAt: number;
  finishedAt: number;
  total: number;
  sent: number;
  /** Why it is waiting or failed, in words for the studio. */
  note: string;
  failures: number;
  /** Whether who it goes to has been written down yet. */
  listed: boolean;
};

export const MAX_SCHEDULE_DAYS = 365;
const QUEUE = "nl:mail:queue";
const bcKey = (id: string) => `nl:mail:bc:${id}`;
const toKey = (id: string) => `nl:mail:bc:${id}:to`;
const listKey = (listId: string) => `nl:mail:bcs:${listId}`;
const lockKey = (id: string) => `nl:mail:bc:${id}:lock`;
export const BROADCAST_ID = /^[0-9a-f]{24}$/;

function parse(raw: unknown): Broadcast | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw) as Broadcast;
    return BROADCAST_ID.test(value.id) ? value : null;
  } catch {
    return null;
  }
}

export async function readBroadcast(id: string): Promise<Broadcast | null> {
  if (!BROADCAST_ID.test(id) || !isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", bcKey(id)]]);
  return parse(raw);
}

async function save(b: Broadcast): Promise<void> {
  await redisPipeline([["SET", bcKey(b.id), JSON.stringify(b), "EX", 400 * 86_400]]);
}

/** The store's broadcasts, newest first. */
export async function listBroadcasts(listId: string | null, limit = 30): Promise<Broadcast[]> {
  if (!listId || !isRedisConfigured()) return [];
  const [ids] = await redisPipeline([["LRANGE", listKey(listId), 0, limit - 1]]);
  const list = Array.isArray(ids) ? (ids as string[]) : [];
  if (!list.length) return [];
  const rows = await redisPipeline(list.map((id) => ["GET", bcKey(id)]));
  return rows.map(parse).filter((b): b is Broadcast => b !== null);
}

export type CreateResult =
  | { ok: true; broadcast: Broadcast }
  | { ok: false; reason: "subject" | "body" | "when" | "product" | "empty" | "allowance" | "setup" | "plan" };

/** Writes a broadcast down to go now or later. What it may contain is checked here. */
export async function createBroadcast(
  store: Store,
  input: { subject: unknown; body: unknown; productId: unknown; sendAt: unknown },
): Promise<CreateResult> {
  if (monthlyAllowance(store) === 0) return { ok: false, reason: "plan" };
  if (!store.mail || !store.listId) return { ok: false, reason: "setup" };
  const subject = typeof input.subject === "string" ? input.subject.replace(/\s+/g, " ").trim().slice(0, MAX_SUBJECT) : "";
  const body = typeof input.body === "string" ? input.body.replace(/\r\n?/g, "\n").trim().slice(0, MAX_MAIL_BODY) : "";
  if (!subject) return { ok: false, reason: "subject" };
  if (!body) return { ok: false, reason: "body" };
  const productId = typeof input.productId === "string" && input.productId ? input.productId : null;
  if (productId && !store.products.some((p) => p.id === productId)) return { ok: false, reason: "product" };
  const now = Math.floor(Date.now() / 1000);
  let sendAt = now;
  if (input.sendAt !== undefined && input.sendAt !== null && input.sendAt !== "") {
    const at = Math.floor(Number(input.sendAt) / 1000);
    if (!Number.isFinite(at) || at < now - 60 || at > now + MAX_SCHEDULE_DAYS * 86_400) return { ok: false, reason: "when" };
    sendAt = Math.max(at, now);
  }
  // Checked now for a send that starts now; a scheduled one is checked again when it starts.
  const reach = (await audience(store.listId, productId ?? undefined)).length;
  if (reach === 0) return { ok: false, reason: "empty" };
  if (sendAt <= now + 60) {
    const left = monthlyAllowance(store) - (await usedThisMonth(store.listId));
    if (reach > left) return { ok: false, reason: "allowance" };
  }
  const broadcast: Broadcast = {
    id: randomBytes(12).toString("hex"),
    listId: store.listId,
    handle: store.handle,
    subject,
    body,
    productId,
    status: "scheduled",
    createdAt: now,
    sendAt,
    finishedAt: 0,
    total: reach,
    sent: 0,
    note: "",
    failures: 0,
    listed: false,
  };
  await save(broadcast);
  await redisPipeline([
    ["LPUSH", listKey(store.listId), broadcast.id],
    ["SADD", QUEUE, broadcast.id],
  ]);
  return { ok: true, broadcast };
}

/** Stops a broadcast that has not started. One under way is not stopped halfway. */
export async function cancelBroadcast(store: Store, id: string): Promise<boolean> {
  const b = await readBroadcast(id);
  if (!b || b.listId !== store.listId || b.status !== "scheduled") return false;
  await save({ ...b, status: "cancelled", finishedAt: Math.floor(Date.now() / 1000) });
  await redisPipeline([["SREM", QUEUE, id]]);
  return true;
}

/**
 * Moves one broadcast on for as long as `deadline` allows. Safe to call from
 * two places at once: only one holds the broadcast at a time.
 */
export async function advanceBroadcast(
  id: string,
  load: (handle: string) => Promise<Store | null>,
  deadline: number,
): Promise<Broadcast | null> {
  const [got] = await redisPipeline([["SET", lockKey(id), "1", "NX", "EX", 90]]);
  if (got === null) return null;
  try {
    let b = await readBroadcast(id);
    if (!b) {
      await redisPipeline([["SREM", QUEUE, id]]);
      return null;
    }
    if (b.status === "sent" || b.status === "cancelled" || b.status === "failed") {
      await redisPipeline([["SREM", QUEUE, id]]);
      return b;
    }
    const now = Math.floor(Date.now() / 1000);
    if (b.status === "scheduled" && b.sendAt > now) return b;
    const store = await load(b.handle);
    if (!store || store.listId !== b.listId) {
      b = { ...b, status: "failed", note: "The store is not here any more.", finishedAt: now };
      await save(b);
      await redisPipeline([["SREM", QUEUE, id]]);
      return b;
    }
    if (monthlyAllowance(store) === 0) {
      b = { ...b, status: "waiting", note: "Your plan does not include email right now. It goes out once Pro is on again." };
      await save(b);
      return b;
    }

    if (!b.listed) {
      const to = await audience(b.listId, b.productId ?? undefined);
      const commands: (string | number)[][] = [["DEL", toKey(id)]];
      for (let i = 0; i < to.length; i += 500) commands.push(["RPUSH", toKey(id), ...to.slice(i, i + 500)]);
      commands.push(["EXPIRE", toKey(id), 60 * 86_400]);
      await redisPipeline(commands);
      b = { ...b, status: "sending", total: to.length, note: "", listed: true };
      await save(b);
    }
    if (b.status === "waiting") b = { ...b, status: "sending", note: "" };

    while (b.sent < b.total && Date.now() < deadline) {
      const [chunk] = await redisPipeline([["LRANGE", toKey(id), b.sent, b.sent + BATCH_SIZE - 1]]);
      const emails = Array.isArray(chunk) ? (chunk as string[]) : [];
      if (!emails.length) break;
      const result = await sendTo(store, emails, b.subject, b.body, `bc:${id}:${b.sent}`);
      if (result.stopped === "allowance") {
        b = { ...b, status: "waiting", note: "This month's emails ran out. The rest go out when the month turns." };
        break;
      }
      if (result.stopped) {
        const failures = b.failures + 1;
        b = failures >= 5
          ? { ...b, status: "failed", failures, note: "The email service would not take it. Nothing more was sent.", finishedAt: now }
          : { ...b, status: "sending", failures, note: "Paused for a moment: the email service asked us to slow down." };
        break;
      }
      b = { ...b, sent: b.sent + emails.length, failures: 0, note: "" };
      await save(b);
    }
    if (b.status === "sending" && b.sent >= b.total) {
      b = { ...b, status: "sent", finishedAt: Math.floor(Date.now() / 1000) };
      await redisPipeline([["DEL", toKey(id)]]);
    }
    await save(b);
    if (b.status === "sent" || b.status === "failed") await redisPipeline([["SREM", QUEUE, id]]);
    return b;
  } finally {
    await redisPipeline([["DEL", lockKey(id)]]).catch(() => {});
  }
}

/** Moves every waiting or scheduled broadcast on. For the scheduled job. */
export async function advanceAll(load: (handle: string) => Promise<Store | null>, deadline: number): Promise<number> {
  if (!isRedisConfigured()) return 0;
  const [raw] = await redisPipeline([["SMEMBERS", QUEUE]]);
  const ids = Array.isArray(raw) ? (raw as string[]) : [];
  let touched = 0;
  for (const id of ids) {
    if (Date.now() > deadline) break;
    if (await advanceBroadcast(id, load, deadline)) touched += 1;
  }
  return touched;
}
