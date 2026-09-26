/**
 * Questions a creator asks at checkout: the size, the name to put on it, the
 * time zone, what they want to talk about on the call.
 *
 * They are Stripe's own custom fields, shown on Stripe's payment page under
 * the card. That matters for three reasons. The answer is typed where the
 * buyer is already typing, so nobody is sent to a form after paying and
 * forgets. It is kept on the payment itself, on the creator's own account, so
 * it is in their Stripe dashboard next to the charge and in the studio's list
 * of sales. And a required question has to be answered before the buyer can
 * pay, which a form sent afterwards can never promise.
 *
 * Stripe's limits are the limits here, checked before anything is saved so a
 * checkout is never refused over a question: three questions, labels of up to
 * 50 characters, and a list of up to 200 choices of up to 100 characters each.
 * A text answer may be up to 255 characters, as Stripe allows.
 *
 * Questions are asked wherever the buyer pays through Stripe's page: a file,
 * a link, a course, a membership, a paid call. Something free is given for an
 * email address and never reaches Stripe, so it has no questions.
 *
 * Pure apart from the types, so the studio checks with the same rules.
 */

export const MAX_CHECKOUT_FIELDS = 3;
export const MAX_FIELD_LABEL_LENGTH = 50;
export const MAX_DROPDOWN_OPTIONS = 200;
export const MAX_DROPDOWN_OPTION_LENGTH = 100;
export const MIN_DROPDOWN_OPTIONS = 2;

export const FIELD_TYPES = ["text", "numeric", "dropdown"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_NAMES: Record<FieldType, string> = {
  text: "Short answer",
  numeric: "Number",
  dropdown: "Choose from a list",
};

export type CheckoutField = {
  /** What the buyer reads above the box, in the creator's words. */
  label: string;
  type: FieldType;
  /** Whether the buyer may leave it empty. Required unless the creator says. */
  optional: boolean;
  /** The choices, for a list. Empty for the other two kinds. */
  options: string[];
};

function isFieldType(value: unknown): value is FieldType {
  return typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value);
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Whatever came back from storage, made safe to use. */
export function parseFields(raw: unknown): CheckoutField[] {
  if (!Array.isArray(raw)) return [];
  const fields: CheckoutField[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const label = clean(value.label, MAX_FIELD_LABEL_LENGTH);
    if (!label || !isFieldType(value.type)) continue;
    const options =
      value.type === "dropdown" && Array.isArray(value.options)
        ? value.options.map((option) => clean(option, MAX_DROPDOWN_OPTION_LENGTH)).filter(Boolean).slice(0, MAX_DROPDOWN_OPTIONS)
        : [];
    if (value.type === "dropdown" && options.length < MIN_DROPDOWN_OPTIONS) continue;
    fields.push({ label, type: value.type, optional: value.optional === true, options });
    if (fields.length >= MAX_CHECKOUT_FIELDS) break;
  }
  return fields;
}

export type FieldsProblem =
  | { reason: "too_many" }
  | { reason: "label" | "type" | "options_few" | "options_many" | "option_long" | "options_same" | "label_long"; at: number };

/**
 * Reads what the studio sent, strictly. Where parseFields quietly drops what
 * it cannot use, this says which question was wrong and how, because the
 * creator is there to fix it.
 */
export function readFields(raw: unknown): CheckoutField[] | FieldsProblem {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_CHECKOUT_FIELDS) return { reason: "too_many" };
  const fields: CheckoutField[] = [];
  for (let at = 0; at < raw.length; at += 1) {
    const value = (raw[at] && typeof raw[at] === "object" ? raw[at] : {}) as Record<string, unknown>;
    const typed = typeof value.label === "string" ? value.label.replace(/\s+/g, " ").trim() : "";
    if (!typed) return { reason: "label", at };
    if (typed.length > MAX_FIELD_LABEL_LENGTH) return { reason: "label_long", at };
    if (!isFieldType(value.type)) return { reason: "type", at };
    let options: string[] = [];
    if (value.type === "dropdown") {
      const lines = Array.isArray(value.options)
        ? value.options
        : typeof value.options === "string"
          ? value.options.split(/\r?\n/)
          : [];
      options = lines.map((line) => (typeof line === "string" ? line.replace(/\s+/g, " ").trim() : "")).filter(Boolean);
      if (options.length < MIN_DROPDOWN_OPTIONS) return { reason: "options_few", at };
      if (options.length > MAX_DROPDOWN_OPTIONS) return { reason: "options_many", at };
      if (options.some((option) => option.length > MAX_DROPDOWN_OPTION_LENGTH)) return { reason: "option_long", at };
      if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return { reason: "options_same", at };
    }
    fields.push({ label: typed, type: value.type, optional: value.optional === true, options });
  }
  return fields;
}

/**
 * Adds the questions to a Checkout Session being made.
 *
 * The keys and the choice values are made from positions, because Stripe
 * wants them plain and unique and the buyer never sees them. The answers are
 * read back by label, from the session itself, so a question the creator has
 * since reworded or removed still reads right on an old sale.
 */
export function applyCheckoutFields(body: URLSearchParams, fields: CheckoutField[] | undefined): void {
  (fields ?? []).slice(0, MAX_CHECKOUT_FIELDS).forEach((field, i) => {
    const at = `custom_fields[${i}]`;
    body.set(`${at}[key]`, `question${i + 1}`);
    body.set(`${at}[label][type]`, "custom");
    body.set(`${at}[label][custom]`, field.label.slice(0, MAX_FIELD_LABEL_LENGTH));
    body.set(`${at}[type]`, field.type);
    body.set(`${at}[optional]`, field.optional ? "true" : "false");
    if (field.type === "dropdown") {
      field.options.slice(0, MAX_DROPDOWN_OPTIONS).forEach((option, j) => {
        body.set(`${at}[dropdown][options][${j}][label]`, option.slice(0, MAX_DROPDOWN_OPTION_LENGTH));
        body.set(`${at}[dropdown][options][${j}][value]`, `choice${j + 1}`);
      });
    }
  });
}

/** One question and what the buyer answered, as the creator reads it. */
export type Answer = { label: string; value: string };

type SessionField = {
  label?: { custom?: unknown } | null;
  type?: unknown;
  dropdown?: { value?: unknown; options?: { label?: unknown; value?: unknown }[] | null } | null;
  numeric?: { value?: unknown } | null;
  text?: { value?: unknown } | null;
};

/** The answers a finished checkout carries, skipping questions left empty. */
export function readAnswers(session: { custom_fields?: unknown }): Answer[] {
  const list = Array.isArray(session.custom_fields) ? (session.custom_fields as SessionField[]) : [];
  const answers: Answer[] = [];
  for (const field of list) {
    const label = typeof field.label?.custom === "string" ? field.label.custom : "";
    let value = "";
    if (field.type === "dropdown") {
      const chosen = field.dropdown?.value;
      const option = (field.dropdown?.options ?? []).find((entry) => entry.value === chosen);
      value = typeof option?.label === "string" ? option.label : typeof chosen === "string" ? chosen : "";
    } else if (field.type === "numeric") {
      value = typeof field.numeric?.value === "string" ? field.numeric.value : "";
    } else if (field.type === "text") {
      value = typeof field.text?.value === "string" ? field.text.value : "";
    }
    if (label && value) answers.push({ label, value });
  }
  return answers;
}
