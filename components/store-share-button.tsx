"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { blockWords } from "@/lib/buyer-words/blocks";

const never = () => () => {};

/**
 * "Share" under the store's name: the phone's own share sheet where there is
 * one, the address copied where there is not. Drawn once the browser has the
 * page, because both need it. The link is the page's own address, so a store
 * on its own domain is shared on its domain.
 */
export function StoreShareButton({ name, lang }: { name: string; lang: string }) {
  const here = useSyncExternalStore(never, () => true, () => false);
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState("");
  if (!here) return null;
  const w = blockWords(lang);

  async function share() {
    const url = `${location.origin}${location.pathname}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch (error) {
        // Closed by the visitor: nothing to do.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard here: the address is shown, ready to select.
      setShown(url);
    }
  }

  return (
    <>
      <button type="button" onClick={share} className="st-social" aria-label={copied ? w.shareCopied : w.shareStoreLabel}>
        <Icon name={copied ? "check" : "arrow-up-right"} size={16} />
        <span aria-live="polite">{copied ? w.shareCopied : w.shareStore}</span>
      </button>
      {shown ? (
        <input readOnly value={shown} aria-label={w.shareStoreLabel} onFocus={(event) => event.currentTarget.select()} className="st-field mt-2 w-full text-center text-sm" />
      ) : null}
    </>
  );
}
