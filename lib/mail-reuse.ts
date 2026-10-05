/**
 * An email that has gone out, used again.
 *
 * A creator writes an email, sends it, and it works. Until now that was the
 * end of it: the people who joined the list the next morning never saw it,
 * and to send it to them the creator had to find it, copy it out and build a
 * sequence by hand. Most never did, so the best thing they had written was
 * read once by whoever happened to be on the list that day.
 *
 * Two things can be done with a sent email, both from the list of what was
 * sent:
 *
 *   Write it again    its subject and text are put back in the composer, as a
 *                     new email, to change and send or schedule.
 *
 *   Keep sending it   it becomes one more email of a sequence, so everybody
 *                     who joins the list from now on gets it by themselves —
 *                     or, when it was written to the people who got one
 *                     product, everybody who gets that product from now on.
 *
 * "Keep sending" invents nothing. It is a sequence (lib/flows.ts) like any
 * other: one the creator can open, reorder, pause or delete under Sequences,
 * counted against the same month of emails, sent only to people who agreed
 * and are still on the list, once each. All this file decides is which
 * sequence the email joins and how long after the one before it.
 *
 * What it refuses, and says so: an email that left out the owners of a
 * product. A sequence cannot leave anyone out, and "you have not bought this
 * yet" sent to somebody who has is worse than not sending it.
 */
import { MAX_DELAY_HOURS, MAX_FLOW_NAME, MAX_STEPS, type Flow, type FlowResult, readFlows, saveFlow } from "@/lib/flows";
import { type Broadcast, readBroadcast } from "@/lib/broadcasts";
import type { Store } from "@/lib/store";

/** How long after joining (or getting the product) the first kept email goes. */
export const KEEP_FIRST_HOURS = 24;
/** And how long after the one before it each later one goes. */
export const KEEP_GAP_HOURS = 48;

export type KeepRefusal =
  | "unknown"
  /** Scheduled, going out, canceled or stopped: there is nothing proven to repeat. */
  | "unsent"
  /** It left out the owners of a product, which a sequence cannot do. */
  | "excludes"
  /** The same subject and text are already in that sequence. */
  | "already"
  /** That sequence has all the emails one may hold. */
  | "full";

export type KeepPlan =
  | { ok: true; raw: Record<string, unknown>; name: string; waitHours: number; position: number }
  | { ok: false; reason: KeepRefusal };

/** As a sequence stores them (lib/flows.ts, cleanStep), so the same email is recognised as the same. */
const subjectOf = (text: string) => text.replace(/\s+/g, " ").trim();
const bodyOf = (text: string) => text.replace(/\r\n?/g, "\n").trim();

/** The sequence for an email that was written to everybody who has bought something. */
export const KEEP_BUYERS_NAME = "Kept sending to everyone who buys";

/** What the sequence is called, so the creator finds it under Sequences. */
export function keepName(productTitle: string | null): string {
  const name = productTitle ? `Kept sending to everyone who gets ${productTitle}` : "Kept sending to everyone who joins";
  return name.slice(0, MAX_FLOW_NAME);
}

/**
 * Which sequence a sent email joins, and where. No reading and no writing:
 * the caller hands in what is there and saves what comes back.
 *
 * The sequence is the one this made before for the same people (`kept`), so
 * pressing the button on five emails builds one sequence of five, each two
 * days after the last, and not five sequences that all arrive on day one.
 */
export function planKeep(broadcast: Broadcast | null, listId: string | null, flows: Flow[], productTitle: string | null): KeepPlan {
  if (!broadcast || !listId || broadcast.listId !== listId) return { ok: false, reason: "unknown" };
  if (broadcast.status !== "sent") return { ok: false, reason: "unsent" };
  if (broadcast.notProductId) return { ok: false, reason: "excludes" };
  // Written only to the people who have not bought: everybody who joins
  // includes the ones who join by buying, and a sequence cannot tell them apart.
  if (broadcast.who === "leads") return { ok: false, reason: "excludes" };
  // Buyers who also hold one product is a narrowing a sequence has no trigger for.
  if (broadcast.who === "buyers" && broadcast.productId) return { ok: false, reason: "excludes" };

  const trigger: Flow["trigger"] = broadcast.who === "buyers" ? "bought" : broadcast.productId ? "product" : "joined";
  const productId = broadcast.productId;
  const subject = subjectOf(broadcast.subject);
  const body = bodyOf(broadcast.body);

  const home = flows.find((f) => f.kept === true && f.trigger === trigger && f.productId === productId) ?? null;
  if (home?.steps.some((s) => s.subject === subject && s.body === body)) return { ok: false, reason: "already" };
  if (home && home.steps.length >= MAX_STEPS) return { ok: false, reason: "full" };

  const last = home?.steps.reduce((most, s) => Math.max(most, s.delayHours), 0) ?? 0;
  const waitHours = home ? Math.min(last + KEEP_GAP_HOURS, MAX_DELAY_HOURS) : KEEP_FIRST_HOURS;
  const name = home?.name ?? (trigger === "bought" ? KEEP_BUYERS_NAME : keepName(productTitle));
  return {
    ok: true,
    name,
    waitHours,
    position: (home?.steps.length ?? 0) + 1,
    raw: {
      ...(home ? { id: home.id } : {}),
      name,
      trigger,
      productId,
      // The creator has just asked for it to be sent: a sequence they paused
      // earlier is switched on again, and the studio says so.
      active: true,
      kept: true,
      steps: [...(home?.steps ?? []), { delayHours: waitHours, subject, body }],
    },
  };
}

export type KeepResult =
  | { ok: true; flows: Flow[]; name: string; waitHours: number; position: number }
  | { ok: false; reason: KeepRefusal | Exclude<FlowResult, { ok: true }>["reason"] };

/** Makes a sent email part of a sequence that sends itself. Under the store's own list only. */
export async function keepSending(
  store: Store,
  broadcastId: string,
  productTitle: (id: string) => Promise<string | null>,
): Promise<KeepResult> {
  const broadcast = await readBroadcast(broadcastId);
  const flows = await readFlows(store.listId);
  const plan = planKeep(broadcast, store.listId, flows, broadcast?.productId ? await productTitle(broadcast.productId) : null);
  if (!plan.ok) return plan;
  // Every rule a sequence has — the plan, the setup, the product still being
  // there, ten sequences at most — is checked by the one place that saves them.
  const saved = await saveFlow(store, plan.raw);
  if (!saved.ok) return saved;
  return { ok: true, flows: saved.flows, name: plan.name, waitHours: plan.waitHours, position: plan.position };
}

/** A sent email's subject and text, to write again. Only the store's own. */
export async function copyOf(
  store: Store,
  broadcastId: string,
): Promise<{ subject: string; body: string; productId: string | null; who: Broadcast["who"] } | null> {
  const broadcast = await readBroadcast(broadcastId);
  if (!broadcast || !store.listId || broadcast.listId !== store.listId) return null;
  return { subject: broadcast.subject, body: broadcast.body, productId: broadcast.productId, who: broadcast.who };
}
