"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/store";
import { MAX_PITCH_LENGTH, MAX_STOCK, canBeBumped, isOneOff } from "@/lib/product-extras";

const MESSAGES: Record<string, string> = {
  stock: `Type a whole number from 1 to ${MAX_STOCK.toLocaleString("en-US")}.`,
  target: "Pick another product that has one price and a file or a link on it.",
  price: "Type a price of at least $0.50, and no more than that product costs on its own.",
  kind: "This works on one-off paid products only.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

const dollars = (cents: number) => (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));

/** A product's limited quantity and its order bump, in the studio. */
export function CheckoutExtras({ product, products }: { product: Product; products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<"stock" | "bump" | null>(null);
  const [stock, setStock] = useState(product.stock ? String(product.stock) : "");
  const candidates = products.filter((p) => p.id !== product.id && canBeBumped(p));
  const [target, setTarget] = useState(product.bump?.productId ?? candidates[0]?.id ?? "");
  const [price, setPrice] = useState(product.bump ? dollars(product.bump.priceCents) : "");
  const [pitch, setPitch] = useState(product.bump?.pitch ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOneOff(product)) return null;
  const bumpTarget = product.bump ? products.find((p) => p.id === product.bump!.productId) : null;

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
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
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
          <button type="button" className={link} disabled={busy} onClick={() => send({ stock: null })}>No limit</button>
        </p>
      ) : (
        <button type="button" className={link} onClick={() => setOpen("stock")}>
          Limit how many can be sold
        </button>
      )}

      {open === "bump" ? (
        <form
          className="rounded-[var(--r-sm)] border border-line bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send({ bump: { productId: target, price: price.trim(), pitch } });
          }}
        >
          {candidates.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Add another product with one price and a file or a link on it, and it can be offered here.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Offer this with it</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="field">
                  {candidates.map((p) => (
                    <option key={p.id} value={p.id}>{`${p.title} ($${dollars(p.priceCents)})`}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">For, in dollars</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  placeholder="9"
                  onChange={(e) => setPrice(e.target.value)}
                  className="field"
                  required
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="field-label">One line to say why (optional)</span>
                <input
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
          <p className="mt-2 text-xs text-ink-soft">
            Buyers see a box under the buy button and tick it themselves; it is never ticked for them. Both are paid in
            one checkout and both are delivered on the thanks page.
          </p>
          {error ? <p className="notice notice-error mt-3" role="alert">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-3">
            {candidates.length ? (
              <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
                {busy ? "Saving…" : "Save the offer"}
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(null); setError(null); }}>
              Cancel
            </button>
          </div>
        </form>
      ) : product.bump && bumpTarget ? (
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{`Offers ${bumpTarget.title} for $${dollars(product.bump.priceCents)} at checkout`}</span>
          {" · "}
          <button type="button" className={link} onClick={() => setOpen("bump")}>Change</button>
          {" · "}
          <button type="button" className={link} disabled={busy} onClick={() => send({ bump: null })}>Stop offering it</button>
        </p>
      ) : (
        <button type="button" className={link} onClick={() => setOpen("bump")}>
          Offer another product at checkout
        </button>
      )}
      {error && open === null ? <p className="notice notice-error" role="alert">{error}</p> : null}
    </div>
  );
}
