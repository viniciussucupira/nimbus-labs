/**
 * Sales tax, calculated by Stripe Tax on the creator's own account.
 *
 * The creator is the seller, so the tax is theirs to collect and to file, and
 * Stripe Tax is set up in their own Stripe dashboard: their head office, what
 * they sell, and where they are registered. Marktmorgen only switches it on for
 * their checkouts once Stripe says that setup is complete, because a checkout
 * that asks for tax on an account not ready for it fails or charges none.
 */
import { onAccount, StripeError } from "@/lib/stripe-account";
import type { Store } from "@/lib/store";

export type TaxSetting = {
  enabled: boolean;
  included: boolean;
  /**
   * Whether the checkout offers a business buyer the box for their VAT, GST or
   * other tax number. A business in the EU or the UK that gives a valid number
   * is charged under the reverse charge instead of being charged tax it then
   * has to claim back, and the number is kept on the creator's own customer,
   * where their accountant and their filing can find it.
   */
  ids: boolean;
  /**
   * Whether the buyer may ask for an invoice at checkout. Stripe then draws it
   * up on the creator's account, with the creator as the seller and the tax as
   * its own line, and hands the buyer the PDF itself. A business buyer who
   * needs a document to file gets it without writing to anyone.
   */
  invoices: boolean;
};

export const NO_TAX: TaxSetting = { enabled: false, included: false, ids: false, invoices: false };

export function parseTax(raw: unknown): TaxSetting {
  if (!raw || typeof raw !== "object") return { ...NO_TAX };
  const value = raw as Record<string, unknown>;
  const enabled = value.enabled === true;
  // Stores whose setting was written before these two existed read as if they
  // had always been on wherever tax itself is: a creator already collecting
  // tax is the one whose buyers were already asking for a number and a
  // document, and neither can charge anyone a penny more than tax already did.
  return {
    enabled,
    included: value.included === true,
    ids: "ids" in value ? value.ids === true : enabled,
    invoices: "invoices" in value ? value.invoices === true : enabled,
  };
}

export type TaxStatus = { state: "active" } | { state: "pending"; missing: string[] } | { state: "unknown" };

/** Whether Stripe Tax is ready on the creator's account, as Stripe says. */
export async function taxStatus(store: Store): Promise<TaxStatus> {
  if (!store.stripeAccountId) return { state: "unknown" };
  try {
    const settings = await onAccount("GET", store.stripeAccountId, "/tax/settings");
    if (settings.status === "active") return { state: "active" };
    const details = settings.status_details as { pending?: { missing_fields?: unknown } } | null;
    const missing = Array.isArray(details?.pending?.missing_fields) ? (details!.pending!.missing_fields as string[]) : [];
    return { state: "pending", missing };
  } catch (error) {
    console.error("reading tax settings failed", error);
    return { state: "unknown" };
  }
}

/** The fields a checkout needs when tax is on, for every line it charges. */
export function applyTax(store: Store, body: URLSearchParams): void {
  if (!store.tax.enabled) return;
  body.set("automatic_tax[enabled]", "true");
  for (const key of [...body.keys()]) {
    const line = /^line_items\[(\d+)\]\[price_data\]\[unit_amount\]$/.exec(key);
    if (line) body.set(`line_items[${line[1]}][price_data][tax_behavior]`, store.tax.included ? "inclusive" : "exclusive");
  }
}

/**
 * The two things a business buyer needs and a store page cannot give them: the
 * box for their tax number, and an invoice they can file.
 *
 * Both are Stripe's own, drawn on the creator's account, so the seller named on
 * the document is the creator and no money moves anywhere new. A subscription
 * is left alone: Stripe already invoices every payment of one, and asking it to
 * create a second document for the same charge is refused.
 */
export function applyTaxDocuments(store: Store, body: URLSearchParams, subscription: boolean): void {
  if (store.tax.ids) {
    body.set("tax_id_collection[enabled]", "true");
    // Offered, never demanded. A buyer with no tax number is a buyer, and a
    // checkout that stops them to ask for one they do not have is a lost sale.
    body.set("tax_id_collection[required]", "never");
  }
  if (store.tax.invoices && !subscription) {
    body.set("invoice_creation[enabled]", "true");
  }
  // Both need somewhere to write what the buyer types, and in payment mode
  // Stripe keeps no customer unless it is told to. A subscription always has
  // one. No customer of ours: the record is made on the creator's account,
  // beside the charge, and belongs to them like every other buyer record here.
  if (!subscription && (store.tax.ids || store.tax.invoices)) {
    body.set("customer_creation", "always");
  }
}

/** The same checkout without them, for an account Stripe refuses them on. */
export function withoutTaxDocuments(body: URLSearchParams): void {
  body.delete("tax_id_collection[enabled]");
  body.delete("tax_id_collection[required]");
  body.delete("invoice_creation[enabled]");
}

/** Whether Stripe's refusal is about the fields above. */
export function refusedTaxDocuments(error: unknown): boolean {
  return (
    error instanceof StripeError &&
    error.status === 400 &&
    /tax_id_collection|invoice_creation|customer_creation|customer_update/i.test(error.message)
  );
}
