"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False while the server renders the page and while the browser takes it
 * over, true after: what depends on the reader's clock or time zone is shown
 * only then, so the two renders agree.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
