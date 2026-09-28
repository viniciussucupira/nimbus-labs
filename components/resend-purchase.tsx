"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  unknown: "That sale could not be found on your Stripe account.",
  call: "A booked call has its own confirmation, sent with the calendar file.",
  refunded: "That sale was refunded in full, so there is nothing to send.",
  limited: "That is the most for now: a sale's email can be sent again 3 times a day, and a store's 30 times an hour. Try again later, or write to the buyer yourself.",
  failed: "The email service did not take it just now. Try again in a moment.",
  role: "Your role on this store does not include this.",
  signed_out: "Your session ended. Log in again.",
  server_error: "Stripe or the email service did not answer. Try again in a moment.",
};

/** "Send the purchase email again", on one sale in the studio's list of sales. */
export function ResendPurchase({ reference, email }: { reference: string; email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        className="inline-flex min-h-6 items-center text-xs font-bold text-ink-soft underline underline-offset-4 hover:text-violet-deep"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch("/api/store/resend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference }),
            });
            const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (data.ok) toast(`Purchase email sent again to ${email}.`);
            else setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
          } catch {
            setError(MESSAGES.server_error);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sending…" : "Send the purchase email again"}
      </button>
      {error ? (
        <span className="mt-1 text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
