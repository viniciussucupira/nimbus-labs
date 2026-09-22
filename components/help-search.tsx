"use client";

import { useEffect, useId, useState } from "react";

/** Opens the answer a link points at (#can-i-sell-a-course). */
function openFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.scrollIntoView({ block: "start" });
  }
}

/** Shows only the answers that mention every word typed, opened, and says how many. */
function narrow(query: string): number | null {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const items = Array.from(document.querySelectorAll<HTMLDetailsElement>("details[data-help-item]"));
  let count = 0;
  for (const item of items) {
    const match = words.every((w) => (item.textContent ?? "").toLowerCase().includes(w));
    item.hidden = words.length > 0 && !match;
    if (words.length > 0) item.open = match;
    if (match) count += 1;
  }
  for (const section of Array.from(document.querySelectorAll<HTMLElement>("section[data-help-section]"))) {
    section.hidden = words.length > 0 && !section.querySelector("details[data-help-item]:not([hidden])");
  }
  return words.length > 0 ? count : null;
}

/**
 * Narrows the help centre to the answers that mention what was typed. Without
 * JavaScript the whole list is simply there, so nothing depends on this.
 */
export function HelpSearch() {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<number | null>(null);
  const hint = useId();

  useEffect(() => {
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <div className="mt-8 max-w-xl">
      <label htmlFor="help-search" className="sr-only">
        Search the help centre
      </label>
      <input
        id="help-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(narrow(e.target.value));
        }}
        placeholder="Search: refunds, courses, domain, Stripe…"
        aria-describedby={hint}
        autoComplete="off"
        className="field h-12 w-full bg-white text-ink"
      />
      <p id={hint} className="mt-2 text-sm text-white/65" aria-live="polite">
        {shown === null
          ? "Type a word and the answers that mention it open below."
          : shown === 0
            ? "No answer mentions that yet. Write to us at the bottom of the page and a person answers."
            : `${shown} ${shown === 1 ? "answer" : "answers"} below.`}
      </p>
    </div>
  );
}
