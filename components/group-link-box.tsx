"use client";

import { useState } from "react";

/**
 * The link that hands out the places of a purchase for several people
 * (lib/group-buy.ts), whole and selectable, with a button that copies it.
 * Without JavaScript the box still selects and copies by hand.
 */
export function GroupLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-6 space-y-3">
      <label htmlFor="group-link" className="st-label">
        The link to pass on
      </label>
      <input id="group-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="st-field" />
      <button
        type="button"
        className="btn st-btn btn-block"
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
        <span aria-live="polite">{copied ? "Copied" : "Copy the link"}</span>
      </button>
    </div>
  );
}
