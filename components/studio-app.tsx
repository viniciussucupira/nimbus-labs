"use client";

import { useEffect } from "react";

/** The studio's own service worker and the part of the site it covers. */
export const STUDIO_WORKER = "/studio-sw.js";
export const STUDIO_SCOPE = "/studio";

/**
 * Registers the studio's service worker (public/studio-sw.js) on every studio
 * page, which is what lets a phone install the studio as an app with its own
 * manifest and what shows its notifications. It draws nothing, and waits for
 * the page to load first so the studio never waits on it.
 *
 * Its scope is the studio alone. The site's other worker (public/sw.js)
 * covers the stores and the public pages; for a studio page, the narrower
 * scope wins, so nothing of the studio passes through a worker that caches.
 */
export function StudioApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register(STUDIO_WORKER, { scope: STUDIO_SCOPE }).catch(() => {});
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
