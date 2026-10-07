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
 * came from — the referring site, or the utm_source, utm_medium and
 * utm_campaign tags on the creator's own link — and the server does the rest.
 *
 * On a page of the store other than its front one (`front` false), it says
 * only that the page was opened, so that somebody who arrives by a link
 * straight to a product is a visit too.
 */
export function StoreBeacon({ handle, front = true }: { handle: string; front?: boolean }) {
  useEffect(() => {
    const key = `${handle}|${location.href}`;
    if (!sent.has(key)) {
      sent.add(key);
      if (front) {
        const query = new URLSearchParams(location.search);
        const tag = (name: string) => (query.get(name) ?? "").slice(0, 60);
        beacon({ h: handle, k: "v", r: document.referrer.slice(0, 500), u: tag("utm_source"), m: tag("utm_medium"), g: tag("utm_campaign") });
      } else {
        // Any other page of the store: only that somebody came (lib/traffic.ts).
        beacon({ h: handle, k: "p" });
      }
    }
    // Which links are followed is counted on the front page, where they are.
    if (!front) return;
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
  }, [handle, front]);
  return null;
}
