/**
 * A product's address in words (lib/product-slug.ts). Checked:
 *
 *   - the words come from the title, plain and short, in any Latin script;
 *   - a title with no such letters keeps the bare id;
 *   - the product is found from its id alone, from its words and id, and
 *     from the words of a title since changed, so no shared link breaks;
 *   - an address naming no product of the store names none;
 *   - the pages that build links use it.
 */
import { readFileSync } from "node:fs";
import { idInSegment, productSegment, slugOf } from "@/lib/product-slug";
import { done, is, part } from "./check";

async function main(): Promise<void> {
  part("Words from the title");
  is("plain words", slugOf("Knife Skills"), "knife-skills");
  is("marks and signs dropped", slugOf("Knife Skills: 10 Lessons!"), "knife-skills-10-lessons");
  is("accents read as their letters", slugOf("Crème brûlée à la maison"), "creme-brulee-a-la-maison");
  is("German and Nordic letters", slugOf("Straße für Bäcker: Smørbrød"), "strasse-fur-backer-smorbrod");
  is("an ampersand said", slugOf("Salt & Pepper"), "salt-and-pepper");
  is("a long title cut at a whole word", slugOf("The complete guide to baking sourdough bread at home on weekends with children"), "the-complete-guide-to-baking-sourdough-bread-at-home-on");
  is("no letters it can write: nothing", slugOf("包丁の使い方"), "");

  part("The address");
  is("words, then the id", productSegment({ id: "5e3f350b52", title: "Knife Skills" }), "knife-skills-5e3f350b52");
  is("the bare id when there are no words", productSegment({ id: "5e3f350b52", title: "包丁" }), "5e3f350b52");

  part("Finding the product");
  const ids = new Set(["5e3f350b52", "aa11bb22cc", "old-style-id"]);
  const has = (id: string) => ids.has(id);
  is("from the id alone", idInSegment("5e3f350b52", has), "5e3f350b52");
  is("from words and id", idInSegment("knife-skills-5e3f350b52", has), "5e3f350b52");
  is("from the words of an older title", idInSegment("knife-basics-5e3f350b52", has), "5e3f350b52");
  is("encoded as a browser sends it", idInSegment("cr%C3%A8me-aa11bb22cc", has), "aa11bb22cc");
  is("an old id with a hyphen in it", idInSegment("my-pack-old-style-id", has), "old-style-id");
  is("words alone name nothing", idInSegment("knife-skills", has), null);
  is("another store's id names nothing", idInSegment("knife-skills-ffffffffff", has), null);
  is("a broken address names nothing", idInSegment("%E0%A4%A", has), null);

  part("Used where links are made");
  const path = readFileSync("components/store-product.tsx", "utf8");
  is("every product link the store draws", path.includes("/p/${productSegment(product)}"), true);
  const page = readFileSync("app/[handle]/p/[product]/page.tsx", "utf8");
  is("the product page finds its product from it", page.includes("productIdFromAddress(store, id)"), true);
  for (const file of ["app/[handle]/p/[product]/opengraph-image.tsx", "app/[handle]/p/[product]/reviews/page.tsx"]) {
    is(`${file.split("/").slice(-2).join("/")} too`, readFileSync(file, "utf8").includes("productIdFromAddress(store, id)"), true);
  }
  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
