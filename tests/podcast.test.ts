/**
 * Private podcasts: the episodes, the feed a buyer's app reads, and who may
 * read it.
 *
 * Measured before it was built (30 September 2026): Kajabi's private
 * podcasts play in Kajabi's own app; Stan, Skool, Circle, Mighty Networks and
 * Whop document none. What is checked:
 *
 *   - what can become a podcast, and that it goes on sale with its first episode;
 *   - episodes: only audio, a title, and deleting one says which audio to delete;
 *   - the feed: newest first, escaped, kept out of directories;
 *   - each address keeps one feed; the creator may always listen, a stranger
 *     never, somebody given it may.
 */
import { addProduct, claimHandle, ensureStatsId, setProductLink, setProductPodcast, setPodcastEpisodes, setStripeAccount, setSubscription, storeForEmail } from "@/lib/store";
import { readListing } from "@/lib/catalog";
import { canSellProduct } from "@/lib/store-checkout";
import { editPodcast } from "@/lib/podcast";
import { appLinks, feedXml, type Podcast } from "@/lib/podcast-rules";
import { feedToken, mayListen, readFeedToken } from "@/lib/podcast-access";
import { grantImported } from "@/lib/imported-purchases";
import { setPastBuyers } from "@/lib/store";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

globalThis.fetch = (async () => new Response(JSON.stringify({ object: "list", data: [], has_more: false }))) as typeof fetch;

async function main(): Promise<void> {
  redis.clear();
  process.env.STRIPE_SECRET_KEY = "sk_test_podcast_only_a_stand_in";
  await claimHandle("owner@example.com", "harbor", "Harbor Kitchen", "");
  await ensureStatsId("owner@example.com");
  await setStripeAccount("owner@example.com", "acct_1TestHarbor0001", true);
  await setSubscription("owner@example.com", { customerId: "cus_Owner00001", subscriptionId: "sub_Owner00001", active: true });
  const show = await addProduct("owner@example.com", "Sourdough Radio", "", "19", null);
  const free = await addProduct("owner@example.com", "Free Guide", "", "0", null);
  const linked = await addProduct("owner@example.com", "Linked", "", "9", null);
  if (!show.ok || !free.ok || !linked.ok) throw new Error("no products");
  await setProductLink("owner@example.com", linked.product.id, "https://example.com");

  part("What can become a podcast");
  const podcastId = "a".repeat(32);
  const refusedFree = await setProductPodcast("owner@example.com", free.product.id, { id: podcastId, episodes: 0 });
  is("not something free", refusedFree.ok ? "made" : refusedFree.reason, "free");
  const refusedLink = await setProductPodcast("owner@example.com", linked.product.id, { id: podcastId, episodes: 0 });
  is("not something that hands over a link", refusedLink.ok ? "made" : refusedLink.reason, "delivery");
  is("a paid product with nothing attached", (await setProductPodcast("owner@example.com", show.product.id, { id: podcastId, episodes: 0 })).ok, true);
  let store = (await storeForEmail("owner@example.com"))!;
  is("not on sale without an episode", canSellProduct(store, (await readListing(store, show.product.id))!), false);
  await setPodcastEpisodes("owner@example.com", show.product.id, 1);
  store = (await storeForEmail("owner@example.com"))!;
  is("on sale with its first", canSellProduct(store, (await readListing(store, show.product.id))!), true);
  const notEmpty = await setProductPodcast("owner@example.com", show.product.id, null);
  is("one with episodes is not turned back", notEmpty.ok ? "undone" : notEmpty.reason, "not_empty");

  part("Episodes");
  let podcast: Podcast = { id: podcastId, episodes: [] };
  const wrong = editPodcast(podcast, { op: "add", pathname: "x", bytes: 1, contentType: "video/mp4", title: "One", notes: "", at: 1 });
  is("only audio", wrong.ok ? "added" : wrong.reason, "type");
  const untitled = editPodcast(podcast, { op: "add", pathname: "x", bytes: 1, contentType: "audio/mpeg", title: "  ", notes: "", at: 1 });
  is("with a title", untitled.ok ? "added" : untitled.reason, "title");
  for (const [title, at] of [["Starter <basics> & more", 100], ["Shaping", 200]] as const) {
    const added = editPodcast(podcast, { op: "add", pathname: `stores/f/p/${at}.mp3`, bytes: 1000, contentType: "audio/mpeg", title, notes: "Notes", at });
    if (!added.ok) throw new Error("no episode");
    podcast = added.podcast;
  }
  is("two out", podcast.episodes.length, 2);
  const removed = editPodcast(podcast, { op: "remove", id: podcast.episodes[1].id });
  is("deleting one says which audio goes", removed.ok && removed.removed?.pathname, "stores/f/p/200.mp3");

  part("The feed");
  const xml = feedXml({ title: "Sourdough Radio", summary: "", author: "Harbor Kitchen", page: "https://x/p", image: null, episodes: podcast.episodes, audio: (e) => `https://x/play/${e.id}.mp3` });
  is("kept out of directories", xml.includes("<itunes:block>Yes</itunes:block>"), true);
  is("newest first", xml.indexOf("Shaping") < xml.indexOf("Starter"), true);
  is("titles escaped", xml.includes("Starter &lt;basics&gt; &amp; more"), true);
  is("each episode through its own address", xml.includes(`url="https://x/play/${podcast.episodes[0].id}.mp3" length="1000" type="audio/mpeg"`), true);
  is("an app button for each", appLinks("https://nimbuslabsai.com/f.xml").map((a) => a.href), [
    "podcast://nimbuslabsai.com/f.xml",
    "overcast://x-callback-url/add?url=https%3A%2F%2Fnimbuslabsai.com%2Ff.xml",
    "pktc://subscribe/nimbuslabsai.com/f.xml",
  ]);

  part("Who may listen");
  const token = await feedToken(store, show.product.id, "Dana@Example.com");
  is("one feed per address", await feedToken(store, show.product.id, "dana@example.com"), token);
  is("the token names the address", (await readFeedToken(token!))?.e, "dana@example.com");
  is("the creator always", await mayListen(store, show.product.id, "owner@example.com"), true);
  is("a stranger never", await mayListen(store, show.product.id, "dana@example.com"), false);
  await grantImported(store.statsId!, "gift:gft_x", [{ email: "hal@example.com", productId: show.product.id, items: null }]);
  await setPastBuyers("owner@example.com");
  store = (await storeForEmail("owner@example.com"))!;
  is("somebody given it", await mayListen(store, show.product.id, "hal@example.com"), true);

  done();
}

void main();
