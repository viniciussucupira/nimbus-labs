"use client";

import { useHydrated } from "@/components/use-hydrated";

/**
 * A day, "September 30", in the reader's own time zone. The server does not
 * know that zone, so until the page runs in the browser the day is given in
 * UTC and says so; both renders agree, and the reader's own day replaces it.
 */
export function LocalDay({ seconds }: { seconds: number }) {
  const local = useHydrated();
  const date = new Date(seconds * 1000);
  if (!local) return <>{`${date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })} (UTC)`}</>;
  return <>{date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</>;
}
