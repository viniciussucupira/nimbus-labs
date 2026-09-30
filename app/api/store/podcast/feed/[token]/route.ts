import type { NextRequest } from "next/server";
import { storeForHandle } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { readPodcast } from "@/lib/podcast";
import { feedAllowed, mayListen, readFeedToken } from "@/lib/podcast-access";
import { feedXml } from "@/lib/podcast-rules";
import { imageUrl } from "@/lib/product-image";
import { photoUrl } from "@/lib/photo-limits";
import { SITE_URL } from "@/lib/site-url";

const HEADERS = { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * One buyer's private feed of a podcast (lib/podcast-rules.ts). Read by their
 * podcast app; answered only while that buyer holds the product, and emptied
 * the moment they do not.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.xml$/, "");
  const grant = await readFeedToken(token);
  if (!grant) return new Response("No such feed.", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!(await feedAllowed(token))) return new Response("Too many requests.", { status: 429, headers: { "Retry-After": "600" } });
  const store = await storeForHandle(grant.h);
  const product = store && store.statsId === grant.s ? await readListing(store, grant.p) : null;
  if (!store || !product?.podcast) return new Response("This podcast is no longer here.", { status: 410 });
  const allowed = await mayListen(store, product.id, grant.e);
  const podcast = allowed ? await readPodcast(product.podcast.id) : null;
  const base = `${SITE_URL}/api/store/podcast/play/${token}`;
  const body = feedXml({
    title: product.title,
    summary: allowed ? product.summary : `Your access to ${product.title} has ended. It opens again if you buy it again from ${store.name}.`,
    author: store.name,
    page: `${SITE_URL}/@${store.handle}/p/${product.id}`,
    image: product.image ? `${SITE_URL}${imageUrl(product.image)}` : store.photoId ? `${SITE_URL}${photoUrl(store.photoId)}` : null,
    episodes: podcast?.episodes ?? [],
    audio: (e) => `${base}/${e.id}.${e.contentType === "audio/mp4" ? "m4a" : "mp3"}`,
  });
  return new Response(body, { status: 200, headers: HEADERS });
}
