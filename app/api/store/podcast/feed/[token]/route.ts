import type { NextRequest } from "next/server";
import { storeForHandle } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { readPodcast } from "@/lib/podcast";
import { FEED_SHARED_SECONDS, feedReadAllowed, listenerOf, mayListen, readFeedToken } from "@/lib/podcast-access";
import { normaliseEmail } from "@/lib/auth";
import { recordListener } from "@/lib/traffic";
import { feedXml } from "@/lib/podcast-rules";
import { imageUrl } from "@/lib/product-image";
import { photoUrl } from "@/lib/photo-limits";
import { SITE_URL } from "@/lib/site-url";
import { coursesWords } from "@/lib/buyer-words/courses";
import { LANGUAGES, parseLanguage } from "@/lib/store-language";

/**
 * Kept by the CDN, under the feed's own secret address, for a few hours: a
 * podcast app asks every hour whether or not anybody listens, and this is
 * what answers it without the feed being put together each time
 * (lib/podcast-access.ts). A browser or an app keeps nothing: it asks the
 * CDN every time.
 */
const HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": `public, max-age=0, s-maxage=${FEED_SHARED_SECONDS}`,
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * One buyer's private feed of a podcast (lib/podcast-rules.ts). Read by their
 * podcast app; it lists episodes only while that buyer holds the product,
 * and each episode is asked about again when it is fetched.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.xml$/, "");
  const grant = await readFeedToken(token);
  if (!grant) return new Response("No such feed.", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!(await feedReadAllowed(token))) {
    return new Response("Too many requests.", { status: 429, headers: { "Retry-After": String(FEED_SHARED_SECONDS), "Cache-Control": "no-store" } });
  }
  const store = await storeForHandle(grant.h);
  const product = store && store.statsId === grant.s ? await readListing(store, grant.p) : null;
  if (!store || !product?.podcast) return new Response("This podcast is no longer here.", { status: 410, headers: { "Cache-Control": "no-store" } });
  const allowed = await mayListen(store, product.id, grant.e);
  // A subscriber whose app asked today is that day's visit to the store,
  // once (lib/traffic.ts). Never the creator's own feed.
  if (allowed && normaliseEmail(grant.e) !== normaliseEmail(store.email)) await recordListener(store, listenerOf(token));
  const podcast = allowed ? await readPodcast(product.podcast.id) : null;
  const base = `${SITE_URL}/api/store/podcast/play/${token}`;
  const body = feedXml({
    title: product.title,
    summary: allowed ? product.summary : coursesWords(store.language).feedEnded(product.title, store.name),
    // The store's language (lib/store-language.ts), as RSS writes one.
    language: LANGUAGES[parseLanguage(store.language)].locale.toLowerCase(),
    author: store.name,
    page: `${SITE_URL}/@${store.handle}/p/${product.id}`,
    image: product.image ? `${SITE_URL}${imageUrl(product.image)}` : store.photoId ? `${SITE_URL}${photoUrl(store.photoId)}` : null,
    episodes: podcast?.episodes ?? [],
    audio: (e) => `${base}/${e.id}.${e.contentType === "audio/mp4" ? "m4a" : "mp3"}`,
  });
  return new Response(body, { status: 200, headers: HEADERS });
}
