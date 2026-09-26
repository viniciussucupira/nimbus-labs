"use client";

import { useEffect } from "react";

/**
 * Registers the site's service worker on a store's pages, which is what lets
 * a phone offer to install the store as an app with its own manifest
 * (lib/store-app.ts). It draws nothing.
 *
 * Registered after the page has loaded, so a buyer on a slow phone never
 * waits on it before they can press buy.
 */
export function StoreApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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
