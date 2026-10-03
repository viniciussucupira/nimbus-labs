"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import type { Product } from "@/lib/store";
import { MAX_STAMP_BYTES, isPdf, readableSize } from "@/lib/product-file";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  signed_out: "Your session ended. Log in again.",
  unknown: "This product was not found. It may have been deleted; reload the page.",
  none: "This account has no store yet.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Nothing was changed; try again in a moment.",
};

type Problem = { name: string; bytes: number; reason: "too_big" | "unreadable" };

/**
 * Stamping the buyer's email on every page of a product's PDFs. Shown on a
 * product that delivers at least one PDF, or that has it switched on.
 */
export function PdfStampToggle({ product }: { product: Product }) {
  const router = useRouter();
  const files = [product.file, ...product.options.map((o) => o.file)].filter((f): f is NonNullable<typeof f> => f !== null);
  const pdfs = files.filter(isPdf);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const on = product.stamp;

  useEffect(() => {
    if (!on) return;
    let live = true;
    (async () => {
      try {
        const response = await fetch(`/api/store/stamp?id=${encodeURIComponent(product.id)}`, { cache: "no-store" });
        const data = (await response.json()) as { ok?: boolean; problems?: Problem[] };
        if (live && data.ok) setProblems(data.problems ?? []);
      } catch {
        // The notes are extra; the setting itself is shown either way.
      }
    })();
    return () => {
      live = false;
    };
  }, [on, product.id, product.file, product.options]);

  if (pdfs.length === 0 && !on) return null;

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, on: next }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
        return;
      }
      toast(next ? "Buyers' PDFs will be stamped." : "PDFs go out unstamped.");
      router.refresh();
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  const id = `stamp-${product.id}`;
  return (
    <div className="mt-3 rounded-[var(--r-sm)] border border-line bg-white p-4">
      <label htmlFor={id} className="flex min-h-6 cursor-pointer items-start gap-3 text-sm font-semibold text-ink">
        <input
          id={id}
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(event) => change(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-violet-brand"
          aria-describedby={`${id}-hint`}
        />
        Stamp each buyer&apos;s email on every page of the PDF
      </label>
      <p id={`${id}-hint`} className="mt-2 text-sm text-ink-soft">
        When a buyer downloads it, each page carries one small line along the bottom, like{" "}
        <span className="break-words font-mono text-xs text-ink">Sold to maya@example.com on Sep 26, 2026 · order …E54F2A · for personal use</span>
        . It makes a shared copy traceable to its buyer; it cannot stop anyone from sharing. PDFs up to{" "}
        {readableSize(MAX_STAMP_BYTES)}; a bigger one, or one locked with a password, is handed over as you uploaded it.
      </p>
      {on && pdfs.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">There is no PDF on this product right now, so nothing is stamped.</p>
      ) : null}
      {on && problems.length ? (
        <ul className="notice notice-warn mt-3 space-y-1 text-sm" role="status">
          {problems.map((problem) => (
            <li key={`${problem.name}-${problem.bytes}`}>
              <strong>{problem.name}</strong>
              {problem.reason === "too_big"
                ? ` is ${readableSize(problem.bytes)}, over the ${readableSize(MAX_STAMP_BYTES)} that can be stamped, so buyers get it unstamped.`
                : " could not be stamped — it is locked with a password or damaged — so buyers get it unstamped. Save it again without a password to stamp it."}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="notice notice-error mt-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
