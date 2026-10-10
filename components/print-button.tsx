"use client";

/** Opens the browser's print dialog, where every browser offers "Save as PDF". */
export function PrintButton({ label, className = "btn st-btn-ghost" }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
