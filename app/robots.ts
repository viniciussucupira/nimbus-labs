import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * What a crawler may read, and where the map is.
 *
 * Everything public is open on purpose: the comparison pages and the journal
 * exist to be found, and a creator's store page is something they want indexed
 * too — that is the whole point of having an address.
 *
 * What is closed is the machinery. /api/ is not a page. /studio and /signin
 * belong to one creator and already carry noindex, but a crawler should not
 * spend requests discovering that. The demo's thanks and recover pages only
 * mean anything in the middle of a purchase, and indexing them would put a
 * half-finished checkout in someone's search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/studio", "/signin", "/demo/thanks", "/demo/recover"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
