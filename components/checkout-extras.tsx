"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/store";
import {
  MAX_PITCH_LENGTH,
  MAX_PLAN_PAYMENTS,
  MAX_STOCK,
  MIN_PLAN_PAYMENTS,
  canBeBumped,
  isOneOff,
  planWords,
} from "@/lib/product-extras";

const MESSAGES: Record<string, string> = {
  stock: `Type a whole number from 1 to ${MAX_STOCK.toLocaleString("en-US")}.`,
  target: "Pick another product that has one price and a file or a link on it.",
  price: "Type a price of at least $0.50, and no more than that product costs on its own.",
  kind: "This works on one-off paid products only.",
  plan: "Pick how many payments, how often, and an amount of at least $0.50 for each.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

const dollars = (cents: number) => (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));

/** A product's limited quantity and its order bump, in the studio. */
export function CheckoutExtras({ product, products }: { product: Product; products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<"stock" | "bump" | "upsell" | "plan" | null>(null);
  const [stock, setStock] = useState(product.stock ? String(product.stock) : "");
  const candidates = products.filter((p) => p.id !== product.id && canBeBumped(p));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOneOff(product)) return null;

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, ...payload }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        setOpen(null);
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

  const link = "text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep";

  return (
    <div className="mt-3 space-y-2">
      {open === "stock" ? (
        <form
          className="rounded-[var(--r-sm)] border border-line bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send({ stock: stock.trim() });
          }}
        >
          <label className="block">
            <span className="field-label">How many can be sold, in total</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_STOCK}
              step={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="field w-40"
              required
            />
          </label>
          <p className="mt-2 text-xs text-ink-soft">
            Your page shows how many are left, counted from real payments, and stops selling at zero. Someone paying right
            now holds one for up to 30 minutes.
          </p>
          {error ? <p className="notice notice-error mt-3" role="alert">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary btn-sm">
              {busy ? "Saving…" : "Save the limit"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(null); setError(null); }}>
              Cancel
            </button>
          </div>
        </form>
      ) : product.stock !== null ? (
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{`Limited to ${product.stock.toLocaleString("en-US")}`}</span>
          {" · "}
          <button type="button" className={link} onClick={() => setOpen("stock")}>Change</button>
          {" · "}
          <button type="button" className={link} aria-busy={busy} disabled={busy} onClick={() => send({ stock: null })}>No limit</button>
        </p>
      ) : (
        <button type="button" className={link} onClick={() => setOpen("stock")}>
          Limit how many can be sold
        </button>
      )}

      <OfferBlock kind="bump" product={product} products={products} candidates={candidates} busy={busy} open={open === "bump"} onOpen={() => setOpen("bump")} onClose={() => { setOpen(null); setError(null); }} onSend={send} error={open === "bump" ? error : null} />
      <OfferBlock kind="upsell" product={product} products={products} candidates={candidates} busy={busy} open={open === "upsell"} onOpen={() => setOpen("upsell")} onClose={() => { setOpen(null); setError(null); }} onSend={send} error={open === "upsell" ? error : null} />
      {product.options.length === 0 ? (
        <PlanBlock product={product} busy={busy} open={open === "plan"} onOpen={() => setOpen("plan")} onClose={() => { setOpen(null); setError(null); }} onSend={send} error={open === "plan" ? error : null} />
      ) : null}
      {error && open === null ? <p className="notice notice-error" role="alert">{error}</p> : null}
    </div>
  );
}

const OFFER_TEXT = {
  bump: {
    add: "Offer another product at checkout",
    on: (title: string, price: string) => `Offers ${title} for $${price} at checkout`,
    stop: "Stop offering it",
    save: "Save the offer",
    note: "Buyers see a box under the buy button and tick it themselves; it is never ticked for them. Both are paid in one checkout and both are delivered on the thanks page.",
  },
  upsell: {
    add: "Offer another product after they pay",
    on: (title: string, price: string) => `Offers ${title} for $${price} after paying, in one click`,
    stop: "Stop offering it",
    save: "Save the offer",
    note: "Right after paying, the buyer sees it on the thanks page, and one press charges the card they just used. Only the browser that paid can take it, only for an hour, and only once.",
  },
} as const;

function OfferBlock({
  kind,
  product,
  products,
  candidates,
  busy,
  open,
  onOpen,
  onClose,
  onSend,
  error,
}: {
  kind: "bump" | "upsell";
  product: Product;
  products: Product[];
  candidates: Product[];
  busy: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSend: (payload: Record<string, unknown>) => void;
  error: string | null;
}) {
  const current = product[kind];
  const text = OFFER_TEXT[kind];
  const [target, setTarget] = useState(current?.productId ?? candidates[0]?.id ?? "");
  const [price, setPrice] = useState(current ? dollars(current.priceCents) : "");
  const [pitch, setPitch] = useState(current?.pitch ?? "");
  const currentTarget = current ? products.find((p) => p.id === current.productId) : null;
  const link = "text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep";
  const id = `${kind}-${product.id}`;

  if (open) {
    return (
      <form
        className="rounded-[var(--r-sm)] border border-line bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSend({ [kind]: { productId: target, price: price.trim(), pitch } });
        }}
      >
        {candidates.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Add another product with one price and a file or a link on it, and it can be offered here.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block" htmlFor={`${id}-t`}>
              <span className="field-label">Offer this</span>
              <select id={`${id}-t`} value={target} onChange={(e) => setTarget(e.target.value)} className="field">
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>{`${p.title} ($${dollars(p.priceCents)})`}</option>
                ))}
              </select>
            </label>
            <label className="block" htmlFor={`${id}-p`}>
              <span className="field-label">For, in dollars</span>
              <input
                id={`${id}-p`}
                type="text"
                inputMode="decimal"
                value={price}
                placeholder="9"
                onChange={(e) => setPrice(e.target.value)}
                className="field"
                required
              />
            </label>
            <label className="block sm:col-span-2" htmlFor={`${id}-w`}>
              <span className="field-label">One line to say why (optional)</span>
              <input
                id={`${id}-w`}
                type="text"
                maxLength={MAX_PITCH_LENGTH}
                value={pitch}
                placeholder="The templates that go with it, at a third of the price."
                onChange={(e) => setPitch(e.target.value)}
                className="field"
              />
            </label>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-soft">{text.note}</p>
        {error ? <p className="notice notice-error mt-3" role="alert">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-3">
          {candidates.length ? (
            <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary btn-sm">
              {busy ? "Saving\u2026" : text.save}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    );
  }
  if (current && currentTarget) {
    return (
      <p className="text-sm text-ink-soft">
        <span className="font-semibold text-ink">{text.on(currentTarget.title, dollars(current.priceCents))}</span>
        {" \u00b7 "}
        <button type="button" className={link} onClick={onOpen}>Change</button>
        {" \u00b7 "}
        <button type="button" className={link} aria-busy={busy} disabled={busy} onClick={() => onSend({ [kind]: null })}>{text.stop}</button>
      </p>
    );
  }
  return (
    <button type="button" className={`block ${link}`} onClick={onOpen}>
      {text.add}
    </button>
  );
}

function PlanBlock({
  product,
  busy,
  open,
  onOpen,
  onClose,
  onSend,
  error,
}: {
  product: Product;
  busy: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSend: (payload: Record<string, unknown>) => void;
  error: string | null;
}) {
  const current = product.plan;
  const [payments, setPayments] = useState(current?.payments ?? 3);
  const [interval, setEvery] = useState<"week" | "month">(current?.interval ?? "month");
  const suggested = (n: number) => dollars(Math.ceil(product.priceCents / n / 100) * 100);
  const [price, setPrice] = useState(current ? dollars(current.amountCents) : suggested(3));
  const link = "text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep";
  const id = `plan-${product.id}`;

  if (open) {
    return (
      <form
        className="rounded-[var(--r-sm)] border border-line bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSend({ plan: { payments, interval, price: price.trim() } });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block" htmlFor={`${id}-n`}>
            <span className="field-label">Payments</span>
            <select
              id={`${id}-n`}
              value={payments}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPayments(n);
                if (!current) setPrice(suggested(n));
              }}
              className="field"
            >
              {Array.from({ length: MAX_PLAN_PAYMENTS - MIN_PLAN_PAYMENTS + 1 }, (_, i) => i + MIN_PLAN_PAYMENTS).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="block" htmlFor={`${id}-i`}>
            <span className="field-label">How often</span>
            <select id={`${id}-i`} value={interval} onChange={(e) => setEvery(e.target.value === "week" ? "week" : "month")} className="field">
              <option value="month">Every month</option>
              <option value="week">Every week</option>
            </select>
          </label>
          <label className="block" htmlFor={`${id}-p`}>
            <span className="field-label">Each payment, in dollars</span>
            <input
              id={`${id}-p`}
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="field"
              required
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Buyers choose between paying in full and the plan. They get the product after the first payment; the rest are
          charged to the same card on your own Stripe account, and the plan stops by itself after the last one. The
          payments add up to at least the full price.
        </p>
        {error ? <p className="notice notice-error mt-3" role="alert">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Saving\u2026" : "Save the plan"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    );
  }
  if (current) {
    return (
      <p className="text-sm text-ink-soft">
        <span className="font-semibold text-ink">{`Payment plan: ${planWords(current)}`}</span>
        {" \u00b7 "}
        <button type="button" className={link} onClick={onOpen}>Change</button>
        {" \u00b7 "}
        <button type="button" className={link} aria-busy={busy} disabled={busy} onClick={() => onSend({ plan: null })}>Stop offering it</button>
      </p>
    );
  }
  return (
    <button type="button" className={`block ${link}`} onClick={onOpen}>
      Offer a payment plan
    </button>
  );
}
