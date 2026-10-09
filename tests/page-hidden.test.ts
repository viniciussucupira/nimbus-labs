/**
 * A sales page kept from visitors while it is worked on (lib/sales-page.ts,
 * hidden, livePage). Checked: it is kept only when asked for in so many
 * words; visitors get no blocks, title or description from it; and the
 * product page, the answer box, the headline test's counting and the page
 * after a free sign-up all go by it.
 */
import { readFileSync } from "node:fs";
import { livePage, parsePage } from "@/lib/sales-page";
import { done, is, part } from "./check";

async function main(): Promise<void> {
  part("What a page keeps");
  const page = (hidden: unknown) => parsePage({ blocks: [{ id: "text0001", kind: "text", heading: "Why", body: "Because." }], seoTitle: "Draft title", hidden });
  is("hidden only when said so", [page(true).hidden, page("yes").hidden, page(undefined).hidden], [true, false, false]);
  part("What visitors are shown");
  is("a hidden page: no blocks, no title of its own", [livePage(page(true)).blocks.length, livePage(page(true)).seoTitle], [0, ""]);
  is("a shown one, as it is", livePage(page(false)).blocks.length, 1);
  part("Everything that reads the page goes by it");
  is("the product page", readFileSync("app/[handle]/p/[product]/page.tsx", "utf8").includes(".then(livePage)"), true);
  is("the answer box", readFileSync("app/api/store/ask/route.ts", "utf8").includes("page.hidden ? null : page"), true);
  is("the headline test's counting", readFileSync("app/api/store/checkout/route.ts", "utf8").includes("if (!page.test || page.hidden) return;"), true);
  is("the page after a free sign-up", readFileSync("app/[handle]/free/page.tsx", "utf8").includes("page?.next && !page.hidden"), true);
  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
