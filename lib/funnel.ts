/**
 * A funnel: what a buyer is offered after paying, one offer at a time.
 *
 * The one-click upsell grew into this. A product can now carry up to five
 * offers in a row, shown on its thanks page. Each offer is another product
 * of the same store, at a price the creator sets for it here, and each has
 * two ways on: the buyer takes it, or says no thanks. Either answer can lead
 * to another offer — a "no" leading to the same product for less is what is
 * usually called a downsell — or to the end.
 *
 * The rules that keep it honest are the ones the single upsell had, and they
 * are checked here so the studio and the server apply the same ones:
 *
 *   - every offer is a real product, one with one price and something to
 *     hand over, never offered for more than it costs on its own;
 *   - an answer only ever leads to an offer further down the list, so a
 *     funnel cannot loop and nobody is shown the same offer twice;
 *   - an offer that follows buying a product never offers that product again,
 *     and on the thanks page anything the buyer already has in this order is
 *     passed over, so nobody is sold the same thing twice.
 *
 * Pure, so the studio and the server apply the same rules.
 */
import type { Product } from "@/lib/store";
import { type Bump, MIN_BUMP_CENTS, canBeBumped, isOneOff } from "@/lib/product-extras";

export type FunnelStep = {
  /** Its own id, so an answer can point at it. */
  id: string;
  /** The product offered: another product of the same store. */
  productId: string;
  /** What it costs in this offer, in cents. Never more than on its own. */
  priceCents: number;
  /** The big line, in the creator's words. Empty uses "<title> for $<price>". */
  headline: string;
  /** A few sentences under it. */
  text: string;
  /** Whose picture is shown with the offer: a product of the store, or none. */
  imageFrom: string | null;
  /** Where "yes" leads: the id of a later offer, or null for the end. */
  yes: string | null;
  /** Where "no thanks" leads: the id of a later offer, or null for the end. */
  no: string | null;
};

export type Funnel = { steps: FunnelStep[] };

/** Offers in one funnel, the same number Stan allows upsells and downsells. */
export const MAX_FUNNEL_STEPS = 5;
export const MAX_HEADLINE_LENGTH = 90;
export const MAX_STEP_TEXT_LENGTH = 400;
export const STEP_ID_PATTERN = /^[a-z0-9]{4,12}$/;
const PRODUCT_ID_PATTERN = /^[a-z0-9]{6,40}$/;

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * Whatever came back from storage or from the studio, made safe to use: the
 * right shapes, at most five offers, no repeated ids, and every answer
 * pointing further down the list or nowhere. Returns null for no funnel.
 */
export function parseFunnel(raw: unknown): Funnel | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(list)) return null;
  const steps: FunnelStep[] = [];
  const seen = new Set<string>();
  for (const entry of list.slice(0, MAX_FUNNEL_STEPS)) {
    if (!entry || typeof entry !== "object") return null;
    const value = entry as Record<string, unknown>;
    if (typeof value.id !== "string" || !STEP_ID_PATTERN.test(value.id) || seen.has(value.id)) return null;
    if (typeof value.productId !== "string" || !PRODUCT_ID_PATTERN.test(value.productId)) return null;
    if (typeof value.priceCents !== "number" || !Number.isInteger(value.priceCents)) return null;
    if (value.priceCents < MIN_BUMP_CENTS || value.priceCents > 10_000_000) return null;
    seen.add(value.id);
    steps.push({
      id: value.id,
      productId: value.productId,
      priceCents: value.priceCents,
      headline: clean(value.headline, MAX_HEADLINE_LENGTH),
      text: clean(value.text, MAX_STEP_TEXT_LENGTH),
      imageFrom: typeof value.imageFrom === "string" && PRODUCT_ID_PATTERN.test(value.imageFrom) ? value.imageFrom : null,
      yes: typeof value.yes === "string" ? value.yes : null,
      no: typeof value.no === "string" ? value.no : null,
    });
  }
  if (steps.length === 0) return null;
  // An answer may only lead further down: that is what makes a loop, and an
  // offer shown twice, impossible.
  const at = new Map(steps.map((step, index) => [step.id, index]));
  for (const [index, step] of steps.entries()) {
    for (const next of [step.yes, step.no]) {
      if (next === null) continue;
      const to = at.get(next);
      if (to === undefined || to <= index) return null;
    }
  }
  return { steps };
}

/** The single upsell a product had before funnels, as a funnel of one offer. */
export function funnelFromUpsell(upsell: Bump | null): Funnel | null {
  if (!upsell) return null;
  return {
    steps: [
      {
        id: "first",
        productId: upsell.productId,
        priceCents: upsell.priceCents,
        headline: "",
        text: upsell.pitch,
        imageFrom: null,
        yes: null,
        no: null,
      },
    ],
  };
}

/** Every offer that can come after this one, by either answer, in any number of steps. */
function after(funnel: Funnel, from: string | null, into = new Set<string>()): Set<string> {
  if (from === null || into.has(from)) return into;
  const step = funnel.steps.find((s) => s.id === from);
  if (!step) return into;
  into.add(step.id);
  after(funnel, step.yes, into);
  after(funnel, step.no, into);
  return into;
}

export type FunnelProblem = "kind" | "target" | "price" | "repeat" | "shape";

/**
 * Why this funnel cannot be saved on this product, or null when it can.
 *
 * The same checks the thanks page makes before showing an offer, made once
 * more when it is saved, so the creator hears about a problem in the studio
 * and not from a buyer.
 */
export function funnelProblem(funnel: Funnel, products: Product[], owner: Product): FunnelProblem | null {
  if (!isOneOff(owner)) return "kind";
  if (funnel.steps.length === 0 || funnel.steps.length > MAX_FUNNEL_STEPS) return "shape";
  for (const step of funnel.steps) {
    const target = products.find((p) => p.id === step.productId);
    if (!target || target.id === owner.id || !canBeBumped(target)) return "target";
    if (step.priceCents < MIN_BUMP_CENTS || step.priceCents > target.priceCents) return "price";
    // Having just bought it, the buyer is never offered it again.
    for (const id of after(funnel, step.yes)) {
      if (funnel.steps.find((s) => s.id === id)?.productId === step.productId) return "repeat";
    }
  }
  return null;
}

/** Whether an offer can be shown right now, as the store stands. */
export function stepOffered(products: Product[], step: FunnelStep): Product | null {
  const target = products.find((p) => p.id === step.productId);
  if (!target || !canBeBumped(target)) return null;
  if (step.priceCents < MIN_BUMP_CENTS || step.priceCents > target.priceCents) return null;
  return target;
}

/** The funnel that follows paying for this product, or null. */
export function activeFunnel(products: Product[], product: Product): Funnel | null {
  if (!product.funnel || !isOneOff(product)) return null;
  // At least one offer has to be showable, or nothing follows at all.
  const any = product.funnel.steps.some((step) => step.productId !== product.id && stepOffered(products, step));
  return any ? product.funnel : null;
}

/** Offers nothing leads to: kept, but never shown until something does. */
export function unreachedSteps(funnel: Funnel): Set<string> {
  const reached = after(funnel, funnel.steps[0]?.id ?? null);
  return new Set(funnel.steps.filter((s) => !reached.has(s.id)).map((s) => s.id));
}

/**
 * Where one order's answers are kept: the first offer under the name the
 * single upsell always used, so an upsell taken before funnels existed is
 * still found, and every other offer under its own id.
 */
export function stepSlot(funnel: Funnel, step: FunnelStep): string {
  return funnel.steps[0]?.id === step.id ? "" : step.id;
}

export type StepAnswer = "paid" | "declined" | "failed" | "pending";

export type FunnelPosition =
  /** This offer is the one to show. */
  | { kind: "offer"; step: FunnelStep; target: Product; index: number }
  /** An answer is still waiting on Stripe or the bank: nothing more is shown yet. */
  | { kind: "waiting"; step: FunnelStep }
  /** The card turned an offer down: nothing more is offered. */
  | { kind: "stopped"; step: FunnelStep }
  /** Every path has been walked. */
  | { kind: "done" };

/**
 * Walks one order's answers from the first offer to where the buyer is now.
 *
 * `answers` is keyed by slot (stepSlot). `owned` is what this order already
 * holds — the product bought and anything ticked at checkout — and grows with
 * each offer taken, so an offer of something the buyer has is passed over as
 * if they had said no to it.
 */
export function funnelPosition(
  funnel: Funnel,
  products: Product[],
  answers: Map<string, StepAnswer>,
  owned: Set<string>,
): FunnelPosition {
  const have = new Set(owned);
  let id: string | null = funnel.steps[0]?.id ?? null;
  // Each answer leads further down the list, so this ends within five turns.
  for (let turn = 0; turn <= MAX_FUNNEL_STEPS && id !== null; turn += 1) {
    const index = funnel.steps.findIndex((s) => s.id === id);
    if (index < 0) break;
    const step = funnel.steps[index];
    const answer = answers.get(stepSlot(funnel, step));
    if (answer === "paid") {
      have.add(step.productId);
      id = step.yes;
      continue;
    }
    if (answer === "declined") {
      id = step.no;
      continue;
    }
    if (answer === "failed") return { kind: "stopped", step };
    if (answer === "pending") return { kind: "waiting", step };
    const target = stepOffered(products, step);
    if (!target || have.has(target.id)) {
      id = step.no;
      continue;
    }
    return { kind: "offer", step, target, index };
  }
  return { kind: "done" };
}

/** "Yes" leads to, "No thanks" leads to — as a person reads it in the studio. */
export function stepLabel(funnel: Funnel, id: string | null): string {
  if (id === null) return "The end";
  const index = funnel.steps.findIndex((s) => s.id === id);
  return index < 0 ? "The end" : `Offer ${index + 1}`;
}
