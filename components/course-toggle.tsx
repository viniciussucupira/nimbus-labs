"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/store";

const MESSAGES: Record<string, string> = {
  free: "A course is sold. Give it a price first.",
  options: "Take the price options off first: a course has one price.",
  delivery: "Take the file or link off first: a course delivers its lessons.",
  call: "Stop selling it as a call first.",
  signed_out: "Your session ended. Sign in again.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

/** Turning a product into a course, and the way to its lessons once it is one. */
export function CourseToggle({ product }: { product: Product }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible =
    product.priceCents > 0 && product.options.length === 0 && !product.file && !product.link && !product.call;

  if (product.course) {
    const n = product.course.lessons;
    return (
      <div className="mt-3 rounded-[var(--r-sm)] border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">{`Course · ${n} ${n === 1 ? "lesson" : "lessons"}`}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {n === 0 ? "Add the first lesson and it goes on sale." : "Buyers open it with their email address, on any device, with no password."}
        </p>
        <Link href={`/studio/course/${product.id}`} className="btn btn-primary btn-sm mt-3">
          {n === 0 ? "Add lessons" : "Edit the course"}
        </Link>
      </div>
    );
  }
  if (!eligible) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-busy={busy} disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch("/api/store/course", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "enable", id: product.id }),
            });
            const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (data.ok) {
              router.push(`/studio/course/${product.id}`);
              return;
            }
            setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
          } catch {
            setError(MESSAGES.server_error);
          } finally {
            setBusy(false);
          }
        }}
        className="text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
      >
        Sell this as a course with lessons
      </button>
      {error ? <p className="notice notice-error mt-2" role="alert">{error}</p> : null}
    </div>
  );
}
