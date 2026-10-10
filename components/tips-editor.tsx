"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { tipsWords } from "@/lib/buyer-words/tips";
import { type Currency, fieldPrefix, formatMoney, moneyField } from "@/lib/money";
import { MAX_TIPS_HEADING, MAX_TIPS_LINE, MAX_TIP_AMOUNTS, type StoreTips, tipAmounts, tipBounds } from "@/lib/store-tips";

/**
 * "Support my work" on the store page (lib/store-tips.ts): on or off, the
 * amounts offered as buttons, and the creator's own heading and line, with a
 * preview of the box as visitors see it.
 */
export function TipsEditor({
  tips,
  storeName,
  language,
  currency,
  blocked,
}: {
  tips: StoreTips;
  storeName: string;
  language: string;
  currency: Currency;
  /** Why it would not show yet: "" when it would. */
  blocked: "" | "stripe";
}) {
  const router = useRouter();
  const shown = tipAmounts(tips, currency);
  const first = Array.from({ length: MAX_TIP_AMOUNTS }, (_, i) => (shown[i] ? moneyField(shown[i], currency) : ""));
  const [on, setOn] = useState(tips.on);
  const [heading, setHeading] = useState(tips.heading);
  const [line, setLine] = useState(tips.line);
  const [amounts, setAmounts] = useState<string[]>(first);
  const [bad, setBad] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const w = tipsWords(language);
  const { min, max } = tipBounds(currency);
  const changed = on !== tips.on || heading !== tips.heading || line !== tips.line || amounts.some((a, i) => a.trim() !== first[i]);
  const money = (amount: number) => formatMoney(amount, currency);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setBad([]);
    try {
      const response = await fetch("/api/store/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on, heading, line, amounts }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; bad?: number[] };
      if (data.ok) {
        toast(on ? "Support my work is on your store page." : "Support my work is off.");
        router.refresh();
        return;
      }
      if (data.error === "amount") {
        setBad(data.bad ?? []);
        setError(`Each amount has to be a plain number from ${money(min)} to ${money(max)}, like ${moneyField(min * 5, currency)}.`);
        return;
      }
      setError("Something went wrong on our side. Nothing was changed. Try again in a moment.");
    } catch {
      setError("Something went wrong on our side. Nothing was changed. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id="support" onSubmit={save} className="card mt-8 scroll-mt-32 p-6 sm:p-8" noValidate>
      <p className="text-lg font-semibold tracking-[-0.02em] text-ink">Support my work</p>
      <p className="mt-2 text-ink-soft">
        A box on your store page where a fan who has nothing to buy today can still say thank you: three amounts to press, or
        one of their own, paid on Stripe&apos;s page to your own Stripe account, with a message for you if they want. Nothing is
        delivered, so nothing can go wrong after it. Each one is listed with your sales as &ldquo;Support&rdquo;, with their
        message, and no affiliate or partner share is taken from it.
      </p>

      <label className="mt-5 flex items-start gap-3 text-ink">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1 size-5 shrink-0 accent-violet-brand" />
        <span className="font-semibold">Show Support my work on my store page</span>
      </label>
      {on && blocked ? (
        <p className="mt-3 rounded-2xl bg-sand/60 px-4 py-3 text-sm text-ink">
          It shows once your store can take payments: Stripe connected, and your subscription active.
        </p>
      ) : null}

      <fieldset className="mt-5">
        <legend className="field-label">The amounts, as buttons</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {amounts.map((value, i) => (
            <div key={i}>
              <label htmlFor={`tip-amount-${i}`} className="sr-only">{`Amount ${i + 1}`}</label>
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-sm font-semibold text-ink-soft">{fieldPrefix(currency)}</span>
                <input
                  id={`tip-amount-${i}`}
                  type="text"
                  inputMode="decimal"
                  maxLength={12}
                  value={value}
                  aria-invalid={bad.includes(i) ? true : undefined}
                  onChange={(e) => setAmounts(amounts.map((a, j) => (j === i ? e.target.value : a)))}
                  className="field min-w-0"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {`From ${money(min)} to ${money(max)} each. Leave all three empty for the usual ones. Visitors can always type an amount of their own in the same range.`}
        </p>
      </fieldset>

      <div className="mt-5 grid gap-4">
        <div>
          <label htmlFor="tips-heading-field" className="field-label">Heading (optional)</label>
          <input
            id="tips-heading-field"
            type="text"
            maxLength={MAX_TIPS_HEADING}
            value={heading}
            placeholder={w.heading}
            onChange={(e) => setHeading(e.target.value)}
            className="field mt-2"
          />
        </div>
        <div>
          <label htmlFor="tips-line-field" className="field-label">One line under it (optional)</label>
          <textarea
            id="tips-line-field"
            rows={2}
            maxLength={MAX_TIPS_LINE}
            value={line}
            placeholder={w.line(storeName)}
            onChange={(e) => setLine(e.target.value)}
            className="field mt-2"
          />
          <p className="mt-1 text-sm text-ink-soft">
            Left empty, both are written for you in your store&apos;s language. Say what the support makes possible — the next
            video, the free guide — but promise nothing in return for it: it is a thank-you, not a purchase.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-paper p-5 ring-1 ring-line" aria-label="Preview">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Preview</p>
        <p className="mt-2 text-lg font-semibold text-ink">{heading.trim() || w.heading}</p>
        <p className="mt-1 text-sm text-ink-soft">{line.trim() || w.line(storeName)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
          {tipAmounts({ ...tips, amounts: [] }, currency).map((usual, i) => {
            const typed = amounts[i]?.trim();
            const label = typed ? `${fieldPrefix(currency)} ${typed}` : money(usual);
            return (
              <span key={i} className="rounded-full bg-violet-brand px-3 py-2 text-center text-sm font-semibold text-white">
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {error ? <p role="alert" className="mt-4 text-sm font-semibold text-danger">{error}</p> : null}
      <button type="submit" disabled={saving || !changed} className="btn btn-primary mt-5">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
