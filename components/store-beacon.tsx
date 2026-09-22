"use client";

import { useEffect } from "react";

// One count per page load, however many times React runs the effect.
const sent = new Set<string>();

function beacon(payload: Record<string, string>) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/store/hit", new Blob([body], { type: "text/plain" }))) return;
  } catch {
    // Fall through to fetch.
  }
  fetch("/api/store/hit", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

/**
 * Tells the store it was opened, and which of its links are followed.
 *
 * No cookie and nothing kept in the browser: the page sends where the visitor
 * came from — the referring site, or the campaign tag on the creator's own
 * link — and the server does the rest.
 */
export function StoreBeacon({ handle }: { handle: string }) {
  useEffect(() => {
    const key = `${handle}|${location.href}`;
    if (!sent.has(key)) {
      sent.add(key);
      const utm = new URLSearchParams(location.search).get("utm_source") ?? "";
      beacon({ h: handle, k: "v", r: document.referrer.slice(0, 500), u: utm.slice(0, 60) });
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[data-link]") : null;
      const id = target?.getAttribute("data-link");
      if (id) beacon({ h: handle, k: "l", id });
    };
    // Middle clicks open links too.
    document.addEventListener("click", onClick);
    document.addEventListener("auxclick", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("auxclick", onClick);
    };
  }, [handle]);
  return null;
}
