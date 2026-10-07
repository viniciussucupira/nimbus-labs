"use client";

import { useEffect } from "react";

/**
 * Sends, once, the id of the furthest block of a sales page this visitor saw
 * (lib/page-depth.ts), when they leave the page or switch away from it.
 * Nothing else: no cookie, no time on page, nothing about the visitor.
 */
export function PageDepth({ handle, product }: { handle: string; product: string }) {
  useEffect(() => {
    const blocks = [...document.querySelectorAll<HTMLElement>("[data-block]")];
    if (blocks.length === 0 || typeof IntersectionObserver === "undefined") return;
    let furthest = -1;
    let sent = false;
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const at = blocks.indexOf(entry.target as HTMLElement);
          if (at > furthest) furthest = at;
        }
      },
      { threshold: 0.4 },
    );
    blocks.forEach((block) => watch.observe(block));
    const send = () => {
      if (sent || furthest < 0) return;
      sent = true;
      const body = JSON.stringify({ h: handle, k: "d", p: product, b: blocks[furthest].dataset.block ?? "" });
      try {
        if (navigator.sendBeacon?.("/api/store/hit", new Blob([body], { type: "text/plain" }))) return;
      } catch {}
      fetch("/api/store/hit", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") send();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", send);
    return () => {
      watch.disconnect();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", send);
    };
  }, [handle, product]);
  return null;
}
