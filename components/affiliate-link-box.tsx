"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/** What the box says, in the store's language (lib/buyer-words/affiliates.ts). */
export type LinkBoxWords = { label: string; copy: string; copied: string };

const ENGLISH: LinkBoxWords = { label: "Your link", copy: "Copy", copied: "Copied" };

/** An affiliate's own link, in a box that selects it all, with a copy button. */
export function AffiliateLinkBox({ link, words = ENGLISH }: { link: string; words?: LinkBoxWords }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="affiliate-link" className="sr-only">
        {words.label}
      </label>
      <input
        id="affiliate-link"
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className="st-field min-w-0 flex-1 font-mono text-sm"
      />
      <button
        type="button"
        className="btn st-btn shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2200);
          } catch {
            // The box is selectable: copying by hand still works.
          }
        }}
      >
        <Icon name={copied ? "check" : "link"} size={16} />
        <span aria-live="polite">{copied ? words.copied : words.copy}</span>
      </button>
    </div>
  );
}
