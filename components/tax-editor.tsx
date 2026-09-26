"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaxSetting } from "@/lib/tax";

const MESSAGES: Record<string, string> = {
  setup: "Stripe says your tax setup is not finished yet. Finish it in your Stripe dashboard, then switch this on.",
  stripe: "Connect your Stripe account first.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
  server_error: "Stripe could not be asked just now. Nothing was changed; try again in a moment.",
};

const STRIPE_TAX_SETTINGS = "https://dashboard.stripe.com/settings/tax";

/** Sales tax at checkout, worked out by Stripe Tax on the creator's account. */
export function TaxEditor({
  tax,
  status,
  connected,
}: {
  tax: TaxSetting;
  /** What Stripe said about the creator's tax setup on this page load. */
  status: "active" | "pending" | "unknown";
  connected: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(tax.enabled);
  const [included, setIncluded] = useState(tax.included);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/store/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, included }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        setSaved(true);
        router.refresh();
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="tax-title">
      <h2 id="tax-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
        Sales tax
      </h2>
      <p className="mt-2 text-ink-soft">
        Stripe Tax works out sales tax or VAT from each buyer&apos;s address and adds it at checkout, on your own Stripe
        account. You remain the seller who files and pays it, with Stripe&apos;s reports of what was collected. Stripe
        charges for Stripe Tax on your account, at the price on its own pricing page.
      </p>

      {!connected ? (
        <p className="mt-4 text-sm text-ink-soft">Connect your Stripe account first, and this can be switched on.</p>
      ) : (
        <form onSubmit={save} className="mt-5 space-y-4">
          <p className="text-sm">
            {status === "active" ? (
              <span className="font-semibold text-ink">Stripe Tax is set up on your account.</span>
            ) : status === "pending" ? (
              <>
                <span className="font-semibold text-ink">Stripe Tax is not set up on your account yet.</span>{" "}
                <span className="text-ink-soft">
                  In your Stripe dashboard, add your head office address, what you sell, and where you are registered to
                  collect tax. Then come back and switch it on.
                </span>{" "}
                <a href={STRIPE_TAX_SETTINGS} target="_blank" rel="noopener noreferrer" className="link font-semibold">
                  Open tax settings in Stripe
                </a>
              </>
            ) : (
              <span className="text-ink-soft">Stripe could not be asked about your tax setup just now.</span>
            )}
          </p>

          <label className="flex items-start gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-violet-brand"
            />
            Add sales tax at checkout
          </label>

          <fieldset className="space-y-2" disabled={!enabled}>
            <legend className="field-label">Your prices</legend>
            <label className="flex items-start gap-3 text-sm text-ink">
              <input type="radio" name="tax-included" checked={!included} onChange={() => setIncluded(false)} className="mt-0.5 h-4 w-4" />
              <span>Tax is added on top at checkout (usual in the United States)</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-ink">
              <input type="radio" name="tax-included" checked={included} onChange={() => setIncluded(true)} className="mt-0.5 h-4 w-4" />
              <span>My prices already include it (usual in Europe, the UK and Australia)</span>
            </label>
          </fieldset>

          {enabled ? (
            <p className="text-xs text-ink-soft">
              While tax is on, the one-click offer after paying is paused: tax cannot be added to a one-click charge. Offers
              at checkout, plans and memberships all get tax.
            </p>
          ) : null}

          {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
          {saved && !error ? <p className="text-sm font-semibold text-ink" role="status">Saved.</p> : null}
          <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </section>
  );
}
