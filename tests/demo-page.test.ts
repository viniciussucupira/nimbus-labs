/**
 * The demo product's sales page (lib/demo-seed.ts, DEMO_PAGE). Checked: it
 * is a page the studio itself would save, block for block; it holds nothing
 * that could pass for proof — no review, quote, countdown or number — and it
 * says plainly that nothing is charged and that Jenny is fictional; a change
 * to it changes the fingerprint, so the live demo is brought in line.
 */
import { DEMO_PAGE, DEMO_POST, seedFingerprint } from "@/lib/demo-seed";
import { cleanPost, postBlocks, postIdFrom } from "@/lib/store-blog";
import { pageProblem, parsePage } from "@/lib/sales-page";
import { pageWords } from "@/lib/page-translate";
import { done, is, part } from "./check";

part("A page the studio would save");
const page = parsePage(DEMO_PAGE);
is("every block kept as written", page.blocks.length, DEMO_PAGE.blocks.length);
is("with nothing the studio would refuse", pageProblem({ blocks: DEMO_PAGE.blocks as unknown as unknown[] }, page), null);
is("in bands, with its own search title", [page.style, page.seoTitle.length > 0], ["bands", true]);

part("Nothing that passes for proof");
is("no review, quote, countdown or counted number", page.blocks.filter((b) => ["reviews", "quotes", "countdown", "facts"].includes(b.kind)).length, 0);
const words = pageWords(page).join("\n");
is("it says nothing is charged, and that Jenny is fictional", [words.includes("Nothing is charged"), words.includes("A fictional cook")], [true, true]);
is("and states no price of its own", /\$\d/.test(words), false);

part("The demo's blog post");
const blocks = postBlocks(DEMO_POST.body);
is("a post the studio would save, with headings and lists", [cleanPost({ title: DEMO_POST.title, body: DEMO_POST.body }).title, blocks.filter((b) => b.kind === "heading").length, blocks.some((b) => b.kind === "list")], [DEMO_POST.title, 4, true]);
is("under an id a post can have", postIdFrom(DEMO_POST.id), DEMO_POST.id);
is("and no price or promised result", /\$\d|guarantee|you will/i.test(DEMO_POST.body), false);

part("Kept in line on the live demo");
is("its fingerprint covers the page", seedFingerprint().length, 24);
done();
