"use client";

import { useState } from "react";

/**
 * The two things a student does with a certificate: print it (or save it as a
 * PDF from the print dialog, which every browser offers) and share its link.
 */
export function CertificateActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button type="button" className="btn st-btn" onClick={() => window.print()}>
        Print or save as PDF
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2200);
          } catch {
            window.prompt("Copy this link", url);
          }
        }}
      >
        <span aria-live="polite">{copied ? "Link copied" : "Copy the link"}</span>
      </button>
    </div>
  );
}
