/**
 * Sales tax, calculated by Stripe Tax on the creator's own account.
 *
 * The creator is the seller, so the tax is theirs to collect and to file, and
 * Stripe Tax is set up in their own Stripe dashboard: their head office, what
 * they sell, and where they are registered. Nimbus only switches it on for
 * their checkouts once Stripe says that setup is complete, because a checkout
 * that asks for tax on an account not ready for it fails or charges none.
 */
import { onAccount } from "@/lib/stripe-account";
import type { Store } from "@/lib/store";

export type TaxSetting = { enabled: boolean; included: boolean };

export const NO_TAX: TaxSetting = { enabled: false, included: false };

export function parseTax(raw: unknown): TaxSetting {
  if (!raw || typeof raw !== "object") return { ...NO_TAX };
  const value = raw as Record<string, unknown>;
  return { enabled: value.enabled === true, included: value.included === true };
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
