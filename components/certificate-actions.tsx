"use client";

import { useState } from "react";

/** What the two buttons say, in the store's language (lib/buyer-words/courses.ts). */
export type CertificateActionWords = { print: string; copy: string; copied: string; prompt: string };

const ENGLISH: CertificateActionWords = {
  print: "Print or save as PDF",
  copy: "Copy the link",
  copied: "Link copied",
  prompt: "Copy this link",
};

/**
 * The two things a student does with a certificate: print it (or save it as a
 * PDF from the print dialog, which every browser offers) and share its link.
 */
export function CertificateActions({ url, words = ENGLISH }: { url: string; words?: CertificateActionWords }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button type="button" className="btn st-btn" onClick={() => window.print()}>
        {words.print}
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
            window.prompt(words.prompt, url);
          }
        }}
      >
        <span aria-live="polite">{copied ? words.copied : words.copy}</span>
      </button>
    </div>
  );
}
