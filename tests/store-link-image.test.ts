/**
 * A link's own small picture (lib/store-link.ts, LinkImage; added 9 October
 * 2026). Checked: only a picture in a store's picture folder is kept, at the
 * size the browser was asked for; an edit keeps it; a heading never has one;
 * taking a link off, or turning it into a heading, hands its picture back to
 * be deleted; replacing one hands back the one it replaced.
 */
import { addStoreLink, claimHandle, editStoreLink, removeStoreLink, setLinkImage, storeForEmail } from "@/lib/store";
import { LINK_IMAGE_SIDE, parseLinkImage, parseStoreLinks } from "@/lib/store-link";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

const folder = "a".repeat(24);
const pic = (n: string) => ({ path: `images/${folder}/${n.repeat(32)}.webp`, width: 320, height: 180, bytes: 9000 });

async function main(): Promise<void> {
  redis.clear();

  part("A kept picture, made safe");
  is("a picture in a store's folder is kept as it is, without words of its own", parseLinkImage({ ...pic("b"), alt: "x", small: { path: "y" } }), pic("b"));
  is("anything else is not a picture", [parseLinkImage({ path: "images/../secret.webp", width: 1, height: 1 }), parseLinkImage("images/x"), parseLinkImage(null)], [null, null, null]);
  is("the browser makes it small", LINK_IMAGE_SIDE, 320);
  is("read back on a link, and never on a heading", parseStoreLinks([
    { id: "l1", title: "Podcast", url: "https://example.com/pod", addedAt: "", image: pic("c") },
    { id: "h1", title: "Listen", url: "", addedAt: "", header: true, image: pic("d") },
    { id: "l2", title: "Blog", url: "https://example.com/blog", addedAt: "", image: { path: "nope" } },
  ]).map((link) => link.image ?? null), [pic("c"), null, null]);

  part("On a store");
  const owner = "linkpic@example.com";
  await claimHandle(owner, "linkpicshop", "Link Pic Shop", "");
  const added = await addStoreLink(owner, "My podcast", "https://example.com/pod");
  if (!added.ok) throw new Error("no link");
  const id = added.store.links[0].id;
  const heading = await addStoreLink(owner, "Listen", "", { header: true });
  if (!heading.ok) throw new Error("no heading");
  const headingId = heading.store.links[1].id;

  const first = await setLinkImage(owner, id, pic("e"));
  is("put on, it replaces nothing", first.ok && first.removed, null);
  const second = await setLinkImage(owner, id, pic("f"));
  is("replaced, the old one comes back to be deleted", second.ok && second.removed, pic("e"));
  is("a heading takes none", (await setLinkImage(owner, headingId, pic("9"))).ok, false);
  is("nor does a link that is not there", (await setLinkImage(owner, "nope", pic("9"))).ok, false);

  const edited = await editStoreLink(owner, id, "The podcast", "https://example.com/pod2", { spotlight: true });
  is("an edit keeps it", edited.ok && [edited.store.links[0].image, edited.store.links[0].spotlight, edited.removed], [pic("f"), true, null]);
  is("and it is there when the store is read again", (await storeForEmail(owner))?.links[0].image, pic("f"));

  const off = await setLinkImage(owner, id, null);
  is("taken off, the icon is back and the picture comes back to be deleted", off.ok && [off.store.links[0].image ?? null, off.removed], [null, pic("f")]);

  await setLinkImage(owner, id, pic("0"));
  const turned = await editStoreLink(owner, id, "Section", "", { header: true });
  is("turned into a heading, it gives its picture up", turned.ok && [turned.store.links[0].image ?? null, turned.removed], [null, pic("0")]);

  await editStoreLink(owner, id, "Back", "https://example.com/back");
  await setLinkImage(owner, id, pic("1"));
  const removed = await removeStoreLink(owner, id);
  is("taken off the page, its picture comes back to be deleted", removed.ok && removed.removed, pic("1"));

  done();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
