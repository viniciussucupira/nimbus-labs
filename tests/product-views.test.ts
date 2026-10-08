/**
 * The times each product's own page is opened (lib/stats.ts, kind "product"),
 * added 8 October 2026 so every product's sales can be read against the
 * views of its page, as Stan's and Kajabi's numbers can. What is checked:
 *
 *   - each opening counts, for its own product, and a crawler's does not;
 *   - the counts reach the studio's numbers, per product and per window,
 *     beside its checkouts, with no all-time figure rather than a wrong one.
 */
import { claimHandle, ensureStatsId, storeForEmail } from "@/lib/store";
import { readStats, recordHit, studioStats } from "@/lib/stats";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

async function main(): Promise<void> {
  redis.clear();
  await claimHandle("owner@example.com", "harbor", "Harbor Kitchen", "");
  await ensureStatsId("owner@example.com");
  const store = (await storeForEmail("owner@example.com"))!;
  const now = Date.UTC(2026, 9, 8, 12);
  const ana = { ip: "203.0.113.4", userAgent: "Mozilla/5.0 (Macintosh) Safari/605" };
  const bia = { ip: "198.51.100.9", userAgent: "Mozilla/5.0 (iPhone) Safari/605" };

  part("Each opening, for its own product");
  for (let i = 0; i < 5; i += 1) await recordHit(store, { kind: "product", id: "p1", ...ana }, now + i * 60_000);
  await recordHit(store, { kind: "product", id: "p1", ...bia }, now);
  await recordHit(store, { kind: "product", id: "p2", ...ana }, now);
  await recordHit(store, { kind: "product", id: "p1", ...ana }, now + 86_400_000);
  await recordHit(store, { kind: "product", id: "p1", ip: "192.0.2.1", userAgent: "Googlebot/2.1" }, now);
  await recordHit(store, { kind: "checkout", id: "p1", ...ana }, now);
  const stats = await readStats(store, now + 86_400_000);
  is("every opening, over two days, and not the crawler's", stats?.windows.d7.viewsByProduct.p1, 7);
  is("another product counts for itself", stats?.windows.d7.viewsByProduct.p2, 1);
  is("and a page visit is not a front-page view", stats?.windows.d7.views, 0);

  part("In the studio's numbers");
  const data = studioStats(store, stats!, null, "none", [
    { id: "p1", title: "Knife Skills" },
    { id: "p2", title: "Pantry Checklist" },
  ] as never);
  const row = data.products.find((p) => p.id === "p1");
  is("beside its checkouts, for each window", [row?.d7.views, row?.d7.checkouts, row?.d30.views], [7, 1, 7]);
  is("and no all-time figure, rather than a wrong one", row?.all.views, -1);
  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
