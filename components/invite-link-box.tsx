"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/** The studio's invite link, whole and selectable, with a button that copies it. */
export function InviteLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 space-y-2">
      <label htmlFor="invite-link" className="sr-only">
        Your invite link
      </label>
      <input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="field w-full text-sm" />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
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
        <span aria-live="polite">{copied ? "Copied" : "Copy the link"}</span>
      </button>
    </div>
  );
}
