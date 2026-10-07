/**
 * Who is opening a page of a community, and the day's visit that opening it
 * is (lib/day-visit.ts).
 *
 * Every page of a community asks this instead of communityViewer itself, so
 * that a member's day there counts toward the store's visits once, like a
 * day on any other page of the store. The routes those pages ask things of
 * keep to communityViewer: they are part of a visit and not another.
 */
import { type Viewer, communityViewer } from "@/lib/community-access";
import { countDay } from "@/lib/day-visit";
import type { Store } from "@/lib/store";

type CookieJar = Parameters<typeof communityViewer>[1];

export async function communityVisitor(store: Store, cookies: CookieJar): Promise<Viewer> {
  const viewer = await communityViewer(store, cookies);
  // Somebody who is in, and is not the creator, whose own days are never counted.
  if (viewer.state === "in" && !viewer.owner) await countDay(store);
  return viewer;
}
