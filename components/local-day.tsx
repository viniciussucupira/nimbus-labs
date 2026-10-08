"use client";

import { useHydrated } from "@/components/use-hydrated";

/**
 * A day, "September 30", in the reader's own time zone. The server does not
 * know that zone, so until the page runs in the browser the day is given in
 * UTC and says so; both renders agree, and the reader's own day replaces it.
 * Written the store's way when given its `locale` ("30 de septiembre").
 */
export function LocalDay({ seconds, locale = "en-US" }: { seconds: number; locale?: string }) {
  const local = useHydrated();
  const date = new Date(seconds * 1000);
  if (!local) return <>{`${date.toLocaleDateString(locale, { month: "long", day: "numeric", timeZone: "UTC" })} (UTC)`}</>;
  return <>{date.toLocaleDateString(locale, { month: "long", day: "numeric" })}</>;
}
