/**
 * Where a product's page of blocks is kept (lib/sales-page.ts says what it
 * is): one small record per product, under the store's statsId, like the
 * long description.
 *
 * The store's own record says only whether a product has a page (its `page`
 * flag), so the store page — read on every visit — never carries thirty
 * blocks of somebody else's product. The page is read only by the product's
 * own page, the page after a free sign-up and the studio.
 *
 *   nl:product:page:<statsId>:<productId>  -> the page, as JSON
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { EMPTY_PAGE, MAX_PAGE_BYTES, type SalesPage, parsePage } from "@/lib/sales-page";

const pageKey = (statsId: string, productId: string) => `nl:product:page:${statsId}:${productId}`;

/** A product's page, or the empty page when it has none (or it cannot be read). */
export async function readPage(statsId: string | null, productId: string): Promise<SalesPage> {
  if (!statsId || !isRedisConfigured()) return { ...EMPTY_PAGE, blocks: [] };
  const [raw] = await redisPipeline([["GET", pageKey(statsId, productId)]]);
  if (typeof raw !== "string" || !raw || raw.length > MAX_PAGE_BYTES * 2) return { ...EMPTY_PAGE, blocks: [] };
  try {
    return parsePage(JSON.parse(raw));
  } catch {
    return { ...EMPTY_PAGE, blocks: [] };
  }
}

/** Whether a page has anything the product's page should draw instead of its plain layout. */
export function hasBlocks(page: SalesPage): boolean {
  return page.blocks.length > 0;
}

/** Writes a page, or forgets it when it has no blocks and nothing else set. */
export async function writePage(statsId: string, productId: string, page: SalesPage): Promise<void> {
  const empty = page.blocks.length === 0 && !page.seoTitle && !page.seoDescription && !page.next;
  await redisPipeline([empty ? ["DEL", pageKey(statsId, productId)] : ["SET", pageKey(statsId, productId), JSON.stringify(page)]]);
}

/** Forgets the page of a product that is gone. */
export async function dropPage(statsId: string | null, productId: string): Promise<void> {
  if (!statsId || !isRedisConfigured()) return;
  await redisPipeline([["DEL", pageKey(statsId, productId)]]);
}
