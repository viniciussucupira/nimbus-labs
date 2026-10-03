"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { MAX_RECOVERY_ADDRESS, type RecoverySetting } from "@/lib/recovery-setting";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  address: "Add the postal address your reminders carry. US law asks every email about buying something to include one.",
  address_long: `Keep the address under ${MAX_RECOVERY_ADDRESS} characters.`,
  stripe: "Connect your Stripe account first.",
  country:
    "Your Stripe account is not in the United States. Stripe asks buyers for this consent only on checkouts of US businesses, so no reminder could ever be sent, and it stays off.",
  unavailable: "Email sending is not set up on our side yet, so nothing was changed.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
  invalid: "That could not be read. Nothing was changed.",
  server_error: "Something went wrong on our side, or Stripe did not answer. Nothing was changed; try again in a moment.",
};

/** One reminder after an abandoned checkout, to buyers who agreed to it. */
export function RecoveryEditor({
  recovery,
  suggestedAddress,
  connected,
}: {
  recovery: RecoverySetting;
  /** The address already given for list email, offered when none is saved here. */
  suggestedAddress: string;
  connected: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(recovery.enabled);
  const [address, setAddress] = useState(recovery.address || suggestedAddress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, address }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        toast(enabled ? "Checkout reminders are on." : "Checkout reminders are off.");
        router.refresh();
        return;
      }
      if (data.error === "country") setEnabled(false);
      setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="recovery-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="recovery-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
          Abandoned checkout reminder
        </h2>
        <span className={`tag ${recovery.enabled ? "tag-live" : ""}`}>{recovery.enabled ? "On" : "Off"}</span>
      </div>
      <p className="mt-2 text-ink-soft">
        When a buyer leaves your checkout without paying, and checked Stripe&apos;s box on that page to hear from you, they
        get one email about an hour later with a link back to the product. Nobody who did not check it is ever written to.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-brand" />
          <span>One email per checkout, at most one per buyer and product in a week, and none to anyone who has paid for it since.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-brand" />
          <span>It comes from your store&apos;s name, replies reach you, and a stop link works in one press, for good.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-brand" />
          <span>
            While it is on, a checkout left open closes after 1 hour instead of Stripe&apos;s usual 24, so the reminder
            arrives while it still matters.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-brand" />
          <span>Stripe shows that box only on checkouts of US businesses, so this needs a Stripe account in the United States.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-brand" />
          <span>Not sent for calls and live sessions: their checkout holds a time, which goes back on sale when it closes.</span>
        </li>
      </ul>

      {!connected ? (
        <p className="mt-5 text-sm text-ink-soft">Connect your Stripe account first, and this can be switched on.</p>
      ) : (
        <form onSubmit={save} className="mt-5 space-y-4">
          <label className="flex min-h-6 cursor-pointer items-start gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-violet-brand"
            />
            Send one reminder after an abandoned checkout
          </label>

          <div>
            <label htmlFor="recovery-address" className="field-label">
              Your postal address
            </label>
            <input
              id="recovery-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={MAX_RECOVERY_ADDRESS}
              autoComplete="street-address"
              placeholder="Street, city, state and ZIP"
              aria-describedby="recovery-address-hint"
              required={enabled}
              className="field mt-2"
            />
            <p id="recovery-address-hint" className="mt-2 text-xs text-ink-soft">
              Printed at the bottom of every reminder, as US law asks. A PO box or a mailbox service is fine.
            </p>
          </div>

          {error ? (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </section>
  );
}
