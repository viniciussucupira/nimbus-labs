/**
 * Automatic sequences: emails that go out by themselves, a set time after
 * somebody joins the list or gets one of the creator's products.
 *
 * Each person goes through a sequence once. Every step is checked again just
 * before it is sent — the person must still be on the list, the sequence
 * still switched on, the step still there — so an unsubscribe, a pause or an
 * edit takes effect on the next email, not the one after.
 *
 *   nl:mail:flows:<listId>              the store's sequences (JSON)
 *   nl:mail:flowq                       steps due, scored by when
 *   nl:mail:enr:<flowId>:<address key>  who has started a sequence
 */
import { createHash, randomBytes } from "node:crypto";
import { normaliseEmail } from "@/lib/auth";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { isMailable, leadsKey, mailable, parseContact } from "@/lib/contacts";
import { MAX_MAIL_BODY, MAX_SUBJECT, monthlyAllowance, sendTo } from "@/lib/mail";
import type { Store } from "@/lib/store";

export const MAX_FLOWS = 10;
export const MAX_STEPS = 10;
export const MAX_DELAY_HOURS = 365 * 24;
export const MAX_FLOW_NAME = 80;

export type FlowStep = { id: string; delayHours: number; subject: string; body: string };
export type Flow = {
  id: string;
  name: string;
  /** "joined": agreed to hear from the creator; "product": got or bought one product. */
  trigger: "joined" | "product";
  productId: string | null;
  steps: FlowStep[];
  active: boolean;
  createdAt: number;
};

const QUEUE = "nl:mail:flowq";
const flowsKey = (listId: string) => `nl:mail:flows:${listId}`;
const enrolledKey = (flowId: string, email: string) =>
  `nl:mail:enr:${flowId}:${createHash("sha256").update(`nimbus-flow:${normaliseEmail(email)}`).digest("hex").slice(0, 32)}`;
const statsKey = (flowId: string) => `nl:mail:flowstats:${flowId}`;
export const FLOW_ID = /^[0-9a-f]{16}$/;

const newId = () => randomBytes(8).toString("hex");

function cleanStep(raw: unknown): FlowStep | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const delay = Number(value.delayHours);
  const subject = typeof value.subject === "string" ? value.subject.replace(/\s+/g, " ").trim().slice(0, MAX_SUBJECT) : "";
  const body = typeof value.body === "string" ? value.body.replace(/\r\n?/g, "\n").trim().slice(0, MAX_MAIL_BODY) : "";
  if (!Number.isInteger(delay) || delay < 0 || delay > MAX_DELAY_HOURS || !subject || !body) return null;
  return { id: typeof value.id === "string" && FLOW_ID.test(value.id) ? value.id : newId(), delayHours: delay, subject, body };
}

export async function readFlows(listId: string | null): Promise<Flow[]> {
  if (!listId || !isRedisConfigured()) return [];
  const [raw] = await redisPipeline([["GET", flowsKey(listId)]]);
  if (typeof raw !== "string") return [];
  try {
    const list = JSON.parse(raw) as Flow[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeFlows(listId: string, flows: Flow[]): Promise<void> {
  await redisPipeline([["SET", flowsKey(listId), JSON.stringify(flows)]]);
}

export type FlowResult =
  | { ok: true; flows: Flow[] }
  | { ok: false; reason: "name" | "trigger" | "product" | "steps" | "step" | "too_many" | "unknown" | "setup" | "plan" };

/** Adds a sequence, or replaces one with the same id. Checked whole every time. */
export async function saveFlow(store: Store, raw: Record<string, unknown>): Promise<FlowResult> {
  if (monthlyAllowance(store) === 0) return { ok: false, reason: "plan" };
  if (!store.listId || !store.mail) return { ok: false, reason: "setup" };
  const name = typeof raw.name === "string" ? raw.name.replace(/\s+/g, " ").trim().slice(0, MAX_FLOW_NAME) : "";
  if (!name) return { ok: false, reason: "name" };
  const trigger = raw.trigger === "joined" || raw.trigger === "product" ? raw.trigger : null;
  if (!trigger) return { ok: false, reason: "trigger" };
  const productId = trigger === "product" && typeof raw.productId === "string" ? raw.productId : null;
  if (trigger === "product" && !store.products.some((p) => p.id === productId)) return { ok: false, reason: "product" };
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (rawSteps.length === 0 || rawSteps.length > MAX_STEPS) return { ok: false, reason: "steps" };
  const steps: FlowStep[] = [];
  for (const s of rawSteps) {
    const step = cleanStep(s);
    if (!step) return { ok: false, reason: "step" };
    steps.push(step);
  }
  const flows = await readFlows(store.listId);
  const id = typeof raw.id === "string" && FLOW_ID.test(raw.id) ? raw.id : null;
  const at = id ? flows.findIndex((f) => f.id === id) : -1;
  if (id && at < 0) return { ok: false, reason: "unknown" };
  if (!id && flows.length >= MAX_FLOWS) return { ok: false, reason: "too_many" };
  const flow: Flow = {
    id: id ?? newId(),
    name,
    trigger,
    productId,
    steps,
    active: raw.active === true,
    createdAt: at >= 0 ? flows[at].createdAt : Math.floor(Date.now() / 1000),
  };
  const next = [...flows];
  if (at >= 0) next[at] = flow;
  else next.push(flow);
  await writeFlows(store.listId, next);
  return { ok: true, flows: next };
}

export async function removeFlow(store: Store, id: string): Promise<FlowResult> {
  if (!store.listId) return { ok: false, reason: "unknown" };
  const flows = await readFlows(store.listId);
  if (!flows.some((f) => f.id === id)) return { ok: false, reason: "unknown" };
  const next = flows.filter((f) => f.id !== id);
  await writeFlows(store.listId, next);
  return { ok: true, flows: next };
}

/** How many have started each sequence and how many of its emails went out. */
export async function flowStats(flows: Flow[]): Promise<Map<string, { started: number; sent: number }>> {
  const out = new Map<string, { started: number; sent: number }>();
  if (!flows.length || !isRedisConfigured()) return out;
  const rows = await redisPipeline(flows.map((f) => ["HGETALL", statsKey(f.id)]));
  flows.forEach((f, i) => {
    const raw = rows[i];
    const map = new Map<string, number>();
    if (Array.isArray(raw)) for (let j = 0; j + 1 < raw.length; j += 2) map.set(String(raw[j]), Number(raw[j + 1]) || 0);
    out.set(f.id, { started: map.get("started") ?? 0, sent: map.get("sent") ?? 0 });
  });
  return out;
}

/**
 * Starts whichever sequences this event begins, for this person. Never
 * throws: the list must never cost anyone what they asked for.
 */
export async function enroll(store: Store, email: string, event: { joined: boolean; productId?: string }): Promise<void> {
  try {
    if (!store.listId || monthlyAllowance(store) === 0) return;
    const flows = (await readFlows(store.listId)).filter(
      (f) =>
        f.active &&
        f.steps.length > 0 &&
        ((f.trigger === "joined" && event.joined) || (f.trigger === "product" && event.productId && f.productId === event.productId)),
    );
    if (!flows.length) return;
    const address = normaliseEmail(email);
    // Only someone who may be written to starts one; their one start is not
    // spent on a moment they could not have received it.
    if (!(await isMailable(store.listId, address))) return;
    const now = Math.floor(Date.now() / 1000);
    for (const flow of flows) {
      const [claimed] = await redisPipeline([["SET", enrolledKey(flow.id, address), "1", "NX", "EX", 400 * 86_400]]);
      if (claimed === null) continue;
      await redisPipeline([
        ["ZADD", QUEUE, now + flow.steps[0].delayHours * 3600, `${store.listId}|${store.handle}|${flow.id}|0|${address}`],
        ["HINCRBY", statsKey(flow.id), "started", 1],
      ]);
    }
  } catch (error) {
    console.error("starting a sequence failed", error);
  }
}

/**
 * Sends every step that is due, and lines up the next one. For the scheduled
 * job. Everyone due for the same email of the same sequence goes in one batch.
 */
export async function sendDueSteps(
  load: (handle: string) => Promise<Store | null>,
  deadline: number,
): Promise<{ sent: number; dropped: number; later: number }> {
  const counts = { sent: 0, dropped: 0, later: 0 };
  if (!isRedisConfigured()) return counts;
  const stores = new Map<string, Store | null>();
  const flowsFor = new Map<string, Flow[]>();
  while (Date.now() < deadline) {
    const now = Math.floor(Date.now() / 1000);
    const [due] = await redisPipeline([["ZRANGEBYSCORE", QUEUE, 0, now, "LIMIT", 0, 300]]);
    const members = Array.isArray(due) ? (due as string[]) : [];
    if (!members.length) break;
    // Whoever removes a member from the queue is the one who sends it.
    const taken = await redisPipeline(members.map((m) => ["ZREM", QUEUE, m]));
    const groups = new Map<string, string[]>();
    members.forEach((member, i) => {
      if (Number(taken[i]) !== 1) return;
      // listId|handle|flowId|step|address — an address may itself hold a "|".
      const parts = member.split("|");
      const group = parts.slice(0, 4).join("|");
      groups.set(group, [...(groups.get(group) ?? []), parts.slice(4).join("|")]);
    });

    for (const [group, emails] of groups) {
      if (Date.now() > deadline) {
        // Out of time: back in the queue for the next run, untouched.
        await redisPipeline(emails.map((email) => ["ZADD", QUEUE, now, `${group}|${email}`]));
        continue;
      }
      const [listId, handle, flowId, stepRaw] = group.split("|");
      const index = Number(stepRaw);
      if (!stores.has(handle)) stores.set(handle, await load(handle));
      const store = stores.get(handle);
      if (!store || store.listId !== listId) {
        counts.dropped += emails.length;
        continue;
      }
      if (!flowsFor.has(listId)) flowsFor.set(listId, await readFlows(listId));
      const flow = flowsFor.get(listId)!.find((f) => f.id === flowId);
      const step = flow?.steps[index];
      if (!flow || !flow.active || !step || monthlyAllowance(store) === 0) {
        counts.dropped += emails.length;
        continue;
      }
      const [rows] = await redisPipeline([["HMGET", leadsKey(listId), ...emails]]);
      const found = Array.isArray(rows) ? rows : [];
      const still = emails.filter((_, i) => {
        const contact = parseContact(found[i]);
        return contact !== null && mailable(contact);
      });
      counts.dropped += emails.length - still.length;
      if (!still.length) continue;

      const key = `fl:${flow.id}:${step.id}:${createHash("sha256").update([...still].sort().join(",")).digest("hex").slice(0, 32)}`;
      const result = await sendTo(store, still, step.subject, step.body, key);
      if (result.rest.length) {
        if (result.stopped === "refused") counts.dropped += result.rest.length;
        else {
          // Tried again later rather than lost: next month, or once the sender takes it.
          const later = result.stopped === "allowance" || result.stopped === "day" ? 6 * 3600 : 600;
          await redisPipeline(result.rest.map((email) => ["ZADD", QUEUE, now + later, `${group}|${email}`]));
          counts.later += result.rest.length;
        }
      }
      if (!result.done.length) continue;
      counts.sent += result.done.length;
      const commands: (string | number)[][] = [["HINCRBY", statsKey(flow.id), "sent", result.done.length]];
      const following = flow.steps[index + 1];
      if (following) {
        const at = now + following.delayHours * 3600;
        for (const email of result.done) commands.push(["ZADD", QUEUE, at, `${listId}|${handle}|${flowId}|${index + 1}|${email}`]);
      }
      await redisPipeline(commands);
    }
  }
  return counts;
}
