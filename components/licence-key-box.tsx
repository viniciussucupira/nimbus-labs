"use client";

import { useState } from "react";

/**
 * Everything the box says, in the store's language (lib/buyer-words/orders.ts),
 * with the product's title and the store's name already in.
 */
export type KeyBoxWords = {
  /** "Your license key", or "Your license key for {title}" when a title is given. */
  label: string;
  copy: string;
  copied: string;
  revoked: string;
  yours: string;
  waiting: string;
  notShown: string;
};

/** The box's words in English, for a page that passes none. */
function englishWords(title: string | undefined, storeName: string): KeyBoxWords {
  return {
    label: title ? `Your license key for ${title}` : "Your license key",
    copy: "Copy",
    copied: "Copied",
    revoked: `${storeName} has marked this key as no longer valid. If you think that is a mistake, reply to your order confirmation email and it reaches them.`,
    yours: "It is yours alone: nobody else is given this key. It is also in your confirmation email and on your list of purchases.",
    waiting: `Your payment went through just as ${storeName}'s keys ran out, so yours is not ready yet. They have been told, and it is emailed to you the moment they add more. It also appears here and on your list of purchases.`,
    notShown: "Your key could not be shown just now. Refresh the page in a moment; it is kept for you.",
  };
}

/**
 * A buyer's licence key, shown where they will look for it: big enough to
 * read, in a type where 0 and O differ, selectable by hand, and with a button
 * that copies it. Works without scripts as plain selectable text.
 */
export function LicenceKeyBox({
  title,
  value,
  revoked = false,
  waiting = false,
  storeName,
  words: given,
}: {
  /** The product the key is for, when more than one key is on the page. */
  title?: string;
  value: string | null;
  revoked?: boolean;
  /** Paid while the creator's keys ran out: the key is emailed when they add more. */
  waiting?: boolean;
  storeName: string;
  /** Said in the store's language; English when not given. */
  words?: KeyBoxWords;
}) {
  const [copied, setCopied] = useState(false);
  const words = given ?? englishWords(title, storeName);

  return (
    <div className="mt-6 rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line-strong)", background: "var(--st-item)" }}>
      <p className="st-label">{words.label}</p>
      {value ? (
        <>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <code
              className="min-w-0 flex-1 select-all break-words rounded-xl px-3 py-2 font-mono text-base font-semibold tracking-wide sm:text-lg"
              style={{ background: "var(--st-accent-soft)", color: "var(--st-text)", textDecoration: revoked ? "line-through" : undefined }}
            >
              {/* A long key wraps between its groups rather than inside one. */}
              {value.split("-").map((part, i, all) => (
                <span key={i}>
                  {part}
                  {i < all.length - 1 ? (
                    <>
                      -<wbr />
                    </>
                  ) : null}
                </span>
              ))}
            </code>
            {revoked ? null : (
              <button
                type="button"
                className="btn st-btn btn-sm inline-flex min-h-11 items-center self-start sm:self-auto"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2200);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <span aria-live="polite">{copied ? words.copied : words.copy}</span>
              </button>
            )}
          </div>
          <p className="st-muted mt-2 text-sm">
            {revoked ? words.revoked : words.yours}
          </p>
        </>
      ) : waiting ? (
        <p className="st-muted mt-2 text-sm">
          {words.waiting}
        </p>
      ) : (
        <p className="st-muted mt-2 text-sm">{words.notShown}</p>
      )}
    </div>
  );
}
