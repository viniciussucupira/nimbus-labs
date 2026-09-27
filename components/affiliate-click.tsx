"use client";

import { useEffect } from "react";

// Once per page load, however many times React runs the effect.
const sent = new Set<string>();

/**
 * Tells the store that a visitor arrived through an affiliate's link, so the
 * click is counted for them. The cookie that credits a later purchase is set
 * by the server whether or not this runs; this is only the count.
 */
export function AffiliateClick({ handle }: { handle: string }) {
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("via")?.toLowerCase() ?? "";
    if (!/^[a-z0-9]{3,20}$/.test(code)) return;
    const key = `${handle}|${code}|${location.pathname}`;
    if (sent.has(key)) return;
    sent.add(key);
    const body = JSON.stringify({ h: handle, k: "a", c: code });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon("/api/store/hit", new Blob([body], { type: "text/plain" }))) return;
    } catch {
      // Fall through to fetch.
    }
    fetch("/api/store/hit", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  }, [handle]);
  return null;
}
