"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";
import { formatMoney } from "@/lib/money";
import { type CartDeal, DEAL_MAX_PERCENT, DEAL_MIN_CHOICES, DEAL_MIN_PERCENT } from "@/lib/cart-rules";

/**
 * "Buy more, save more" for the store's cart (lib/cart-rules.ts): on or off,
 * from how many products, and how much off each. Off until switched on;
 * buyers are told under every "Add to cart" while it is.
 */
export function CartDealEditor({ initial, currency, offered }: { initial: CartDeal; currency: string; offered: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial.on);
  const [min, setMin] = useState(initial.min);
  const [percent, setPercent] = useState(initial.percent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Number.isInteger(percent) && percent >= DEAL_MIN_PERCENT && percent <= DEAL_MAX_PERCENT;
  const example = 2700;
  const each = example - Math.round((example * (valid ? percent : 0)) / 100);

  async function save() {
    if (!valid) {
      setError(`Choose ${DEAL_MIN_PERCENT}% to ${DEAL_MAX_PERCENT}% off.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/cart-deal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on, min, percent }) });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(STUDIO_MESSAGES[data.error ?? ""] ?? "Something went wrong on our side. Try again in a moment.");
        return;
      }
      toast(on ? "Saved. The cart takes it off from now on." : "Saved. The cart charges full prices.");
      router.refresh();
    } catch {
      setError("Something went wrong on our side. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="cart-deal" aria-labelledby="cart-deal-title" className="card mt-8 scroll-mt-32 p-6 sm:p-8">
      <h2 id="cart-deal-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">Buy more, save more</h2>
      <p className="mt-2 text-ink-soft">
        Every product in a cart a percentage cheaper once it holds a few. Buyers see it under every &quot;Add to cart&quot;, the cart
        tells them how many more it takes, and Stripe charges the lower prices.
        {offered ? "" : " Your store shows a cart once two or more of your products can go in one."}
      </p>
      <label className="mt-5 flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span className="font-semibold text-ink">Take a percentage off when they buy several</span>
      </label>
      {on ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block" htmlFor="deal-min">
            <span className="field-label">From how many products</span>
            <select id="deal-min" className="field mt-1" value={min} onChange={(e) => setMin(Number(e.target.value))}>
              {DEAL_MIN_CHOICES.map((n) => (
                <option key={n} value={n}>{`${n} or more`}</option>
              ))}
            </select>
          </label>
          <label className="block" htmlFor="deal-percent">
            <span className="field-label">Percentage off each</span>
            <input
              id="deal-percent"
              type="number"
              inputMode="numeric"
              min={DEAL_MIN_PERCENT}
              max={DEAL_MAX_PERCENT}
              className="field mt-1"
              value={percent}
              onChange={(e) => setPercent(Math.floor(Number(e.target.value) || 0))}
            />
          </label>
          <p className="text-sm text-ink-soft sm:col-span-2">
            {`For example, ${min} products at ${formatMoney(example, currency)} each come to ${formatMoney(each * min, currency)} instead of ${formatMoney(example * min, currency)}. A store-wide sale or a fair price is taken off first. With the deal on, the cart shows no box for a discount code.`}
          </p>
        </div>
      ) : null}
      {error ? <p className="notice notice-error mt-4 text-sm" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-primary mt-5" disabled={busy} aria-busy={busy} onClick={save}>
        {busy ? "Saving…" : "Save"}
      </button>
    </section>
  );
}
