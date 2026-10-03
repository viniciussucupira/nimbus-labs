"use client";

import { useState } from "react";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";
import { MAX_LAUNCH_ADDRESS, MAX_LAUNCH_NOTE } from "@/lib/waitlist-rules";
import type { WaitlistView } from "@/lib/waitlist";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  free: "A free product already takes addresses. A waitlist is for something paid.",
  address: "Add a postal address for the bottom of the email: US law asks for one in any email about something for sale.",
  busy: "The launch email is still going out. Wait for it to finish.",
  unknown: "That product is no longer in your store. Reload the page.",
};

async function post(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; view?: WaitlistView }> {
  try {
    const response = await fetch("/api/store/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await response.json().catch(() => ({ ok: false, error: "server_error" }))) as { ok: boolean; error?: string; view?: WaitlistView };
  } catch {
    return { ok: false, error: "server_error" };
  }
}

/**
 * "Coming soon" for one paid product: the switch, how many are waiting, and
 * the button that puts it on sale and tells them.
 */
export function WaitlistPanel({
  productId,
  initial,
  suggestedAddress,
}: {
  productId: string;
  initial: WaitlistView | null;
  suggestedAddress: string;
}) {
  const [view, setView] = useState<WaitlistView>(initial ?? { soon: false, confirmed: 0, waiting: 0, launch: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [address, setAddress] = useState(suggestedAddress);
  const [confirming, setConfirming] = useState(false);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const answer = await post({ id: productId, ...payload });
    setBusy(false);
    if (answer.ok && answer.view) setView(answer.view);
    else setError(MESSAGES[answer.error ?? ""] ?? MESSAGES.server_error ?? "Something went wrong. Try again.");
    return answer.ok;
  }

  const launch = view.launch;
  const sending = launch !== null && !launch.finished;

  return (
    <div className="mt-3 rounded-[var(--r-sm)] border border-line bg-white p-4">
      <label className="flex min-h-[40px] items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          checked={view.soon}
          disabled={busy || sending}
          onChange={(e) => void act({ action: "soon", on: e.target.checked })}
        />
        <span>
          <span className="block font-semibold text-ink">Coming soon, with a waitlist</span>
          <span className="block text-sm text-ink-soft">
            Instead of a buy button, visitors leave their email and confirm it from their inbox. No checkout opens until you put
            it on sale.
          </span>
        </span>
      </label>

      {view.soon || view.confirmed || view.waiting ? (
        <p className="mt-2 text-sm text-ink">
          <strong>{view.confirmed.toLocaleString("en-US")}</strong>
          {` confirmed ${view.confirmed === 1 ? "address" : "addresses"}`}
          {view.waiting ? <span className="text-ink-soft">{` · ${view.waiting.toLocaleString("en-US")} not confirmed yet, and not emailed`}</span> : null}
        </p>
      ) : null}

      {view.soon ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-sm font-semibold text-ink">Put it on sale and tell the waitlist</p>
          <p className="text-sm text-ink-soft">
            {view.confirmed
              ? `It goes on sale at once, and each of the ${view.confirmed.toLocaleString("en-US")} confirmed addresses gets one email with its link and price. Then the waitlist's addresses are deleted; whoever also asked to hear from you is on your list already.`
              : "Nobody has confirmed yet, so no email goes out: it just goes on sale."}
          </p>
          {view.confirmed ? (
            <>
              <label className="block">
                <span className="field-label">A note in the email (optional)</span>
                <textarea
                  className="field mt-1"
                  rows={3}
                  maxLength={MAX_LAUNCH_NOTE}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Thank you for waiting. Reply to this email if you have any questions."
                />
              </label>
              <label className="block">
                <span className="field-label">Postal address at the bottom of the email</span>
                <input
                  className="field mt-1"
                  maxLength={MAX_LAUNCH_ADDRESS}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Austin, TX 78701"
                  autoComplete="street-address"
                />
                <span className="mt-1 block text-xs text-ink-soft">US law (CAN-SPAM) asks for one in any email about something for sale. A PO box counts.</span>
              </label>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={async () => {
              if (!confirming) return setConfirming(true);
              setConfirming(false);
              await act({ action: "launch", note, address });
            }}
          >
            {confirming
              ? view.confirmed
                ? `Press again: on sale now, ${view.confirmed.toLocaleString("en-US")} emails`
                : "Press again to put it on sale"
              : view.confirmed
                ? "Put it on sale and tell the waitlist"
                : "Put it on sale"}
          </button>
        </div>
      ) : null}

      {launch ? (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {launch.finished
            ? `Launched. ${launch.sent.toLocaleString("en-US")} of ${launch.total.toLocaleString("en-US")} waitlist emails went out.`
            : `On sale. The waitlist email is going out: ${launch.sent.toLocaleString("en-US")} of ${launch.total.toLocaleString("en-US")} so far, sent in batches every five minutes.`}
        </p>
      ) : null}

      {error ? <p className="notice notice-error mt-3 text-sm" role="alert">{error}</p> : null}
    </div>
  );
}
