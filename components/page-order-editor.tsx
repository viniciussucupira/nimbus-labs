"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { PAGE_PARTS, type PagePart, USUAL_ORDER, isUsualOrder } from "@/lib/store-order";

const LABELS = new Map<string, { label: string; note: string }>(PAGE_PARTS.map((part) => [part.id, part]));

/**
 * The order of the parts of the store page (lib/store-order.ts): moved one
 * place at a time, seen as a list before it is saved, and put back to the
 * usual order in one press. Each part says whether it shows on the page now,
 * so a creator is never puzzled by a part that is placed but empty.
 */
export function PageOrderEditor({ order, on }: { order: PagePart[]; on: Record<PagePart, boolean> }) {
  const router = useRouter();
  const [list, setList] = useState<PagePart[]>(order);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = list.some((part, i) => part !== order[i]);

  function move(at: number, by: -1 | 1) {
    const to = at + by;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[at], next[to]] = [next[to], next[at]];
    setList(next);
  }

  async function save(next: PagePart[]) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/store/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (data.ok) {
        setList(next);
        toast(isUsualOrder(next) ? "Your page is back in the usual order." : "Saved. Your page shows its parts in this order.");
        router.refresh();
        return;
      }
      setError("It could not be saved just now. Try again in a moment.");
    } catch {
      setError("It could not be saved just now. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="order" aria-labelledby="order-title" className="card mt-8 scroll-mt-32 p-6 sm:p-8">
      <h2 id="order-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
        The order of your page
      </h2>
      <p className="mt-2 text-ink-soft">
        What comes first under your name. Put your links first if your page is mostly links, what buyers say above your
        products if their words sell best, or the sign-up box at the top while you build a list. A visitor who searches
        your store always sees the results first.
      </p>

      <ol className="mt-5 space-y-2">
        {list.map((part, i) => {
          const about = LABELS.get(part);
          return (
            <li key={part} className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
              <span aria-hidden="true" className="w-5 shrink-0 text-center text-sm font-bold text-ink-soft">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{about?.label}</span>
                <span className="block text-sm text-ink-soft">
                  {on[part] ? about?.note : `Not on your page now. ${about?.note}`}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || saving}
                  aria-label={`Move ${about?.label} up`}
                  className="btn btn-secondary btn-sm px-2.5 disabled:opacity-40"
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === list.length - 1 || saving}
                  aria-label={`Move ${about?.label} down`}
                  className="btn btn-secondary btn-sm px-2.5 disabled:opacity-40"
                >
                  <span aria-hidden="true">↓</span>
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p role="alert" className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save(list)}
          disabled={!changed || saving}
          aria-busy={saving}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Save the order"}
        </button>
        {isUsualOrder(list) ? null : (
          <button
            type="button"
            onClick={() => void save([...USUAL_ORDER])}
            disabled={saving}
            className="btn btn-secondary"
          >
            Back to the usual order
          </button>
        )}
      </div>
    </section>
  );
}
