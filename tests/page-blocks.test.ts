/**
 * The five blocks added on 8 October 2026 (lib/sales-page.ts): who it is for,
 * how it works, a comparison, bonuses and numbers counted by the store
 * (lib/page-facts.ts). Each is read back safely, holds to its limits, and the
 * counted numbers appear only when they are true.
 */
import { CELL_NO, CELL_YES, MAX_COMPARE_ROWS, MAX_FIT_ITEMS, emptyBlock, parsePage, picturePaths, blocksFromTemplate } from "@/lib/sales-page";
import { pageFacts } from "@/lib/page-facts";
import { done, is, part } from "./check";

part("Who it is for");
{
  const page = parsePage({ blocks: [{ id: "abcd1234", kind: "fit", heading: " Is it for you? ", yes: ["You sell online", "", ...Array(20).fill("x")], no: ["You want a shortcut"], yesLabel: "", noLabel: "Skip it if" }] });
  const block = page.blocks[0];
  is("kept, with empty points left out and at most eight a side", block?.kind === "fit" ? [block.heading, block.yes.length, block.yes[0], block.no, block.noLabel] : null, ["Is it for you?", MAX_FIT_ITEMS, "You sell online", ["You want a shortcut"], "Skip it if"]);
}

part("How it works, and bonuses");
{
  const page = parsePage({ blocks: [
    { id: "step1234", kind: "steps", heading: "How it works", items: [{ title: "Pay", detail: "On Stripe" }, { title: "" }, ...Array(10).fill({ title: "More" })] },
    { id: "bonu1234", kind: "bonuses", heading: "Also included", items: [{ title: "A checklist", detail: "", worth: "$497" }] },
  ] });
  const [steps, bonuses] = page.blocks;
  is("steps keep their titles, eight at most", steps?.kind === "steps" ? [steps.items.length, steps.items[0]] : null, [8, { title: "Pay", detail: "On Stripe" }]);
  is("a bonus carries no value of its own, whatever is sent", bonuses?.kind === "bonuses" ? JSON.stringify(bonuses.items[0]) : null, JSON.stringify({ title: "A checklist", detail: "" }));
}

part("A comparison");
{
  const rows = [{ label: "Feedback", a: CELL_YES, b: CELL_NO }, { label: "", a: "x", b: "y" }, { label: "Nothing in it", a: "", b: "" }, ...Array(20).fill({ label: "Row", a: "A", b: "B" })];
  const page = parsePage({ blocks: [{ id: "comp1234", kind: "compare", heading: "", columnA: "This course", columnB: "", rows }] });
  const block = page.blocks[0];
  is("rows with no label or no cell are left out, twelve at most", block?.kind === "compare" ? [block.rows.length, block.rows[0]] : null, [MAX_COMPARE_ROWS, { label: "Feedback", a: CELL_YES, b: CELL_NO }]);
}

part("By the numbers");
{
  const page = parsePage({ blocks: [{ id: "fact1234", kind: "facts", heading: "", show: ["rating", "lessons", "made-up", "buyers"] }] });
  const block = page.blocks[0];
  is("only numbers the store can count may be chosen, in a fixed order", block?.kind === "facts" ? block.show : null, ["lessons", "buyers", "rating"]);
  const fresh = emptyBlock("facts");
  is("a new block offers all six", fresh.kind === "facts" ? fresh.show.length : 0, 6);

  const facts = pageFacts({
    language: "en",
    locale: "en-US",
    product: { course: { lessons: 12 }, call: null, podcast: null },
    bundleItems: null,
    sold: 1240,
    reviews: { count: 8, stars: 37, visible: 8 },
  });
  is("a course's lessons", facts.lessons, { key: "lessons", value: "12", label: "lessons" });
  is("times bought, written the language's way", facts.buyers, { key: "buyers", value: "1,240", label: "times bought" });
  is("the average, to one decimal, with how many reviews", facts.rating, { key: "rating", value: "4.6", label: "average from 8 reviews" });
  is("nothing that is not true is there", [facts.episodes, facts.products, facts.length], [undefined, undefined, undefined]);

  const none = pageFacts({ language: "de", locale: "de-DE", product: { course: { lessons: 0 } }, bundleItems: 0, sold: null, reviews: { count: 0, stars: 0, visible: 0 } });
  is("a course with no lesson yet, no sales said and no review: no number at all", Object.keys(none), []);
  const german = pageFacts({ language: "de", locale: "de-DE", product: { call: { kind: "weekly", minutes: 45 } }, bundleItems: null, sold: null, reviews: { count: 3, stars: 14, visible: 3 } });
  is("in German, with its own decimal comma", [german.length?.label, german.rating?.value], ["Minuten pro Gespräch", "4,7"]);
  const dated = pageFacts({ language: "en", locale: "en-US", product: { call: { kind: "live", minutes: 60 } }, bundleItems: null, sold: null, reviews: null });
  is("dated sessions, each with its own length, give no single length", dated.length, undefined);
}

part("A picture beside words");
{
  const pic = (n: string) => ({ path: `images/${"a".repeat(24)}/${n.repeat(32)}.webp`, width: 1200, height: 800, alt: "A screen", caption: "" });
  const page = parsePage({ blocks: [
    { id: "feat0001", kind: "feature", heading: "Lessons you can follow", body: "Short and clear.", picture: pic("b"), side: "right" },
    { id: "pics0001", kind: "pictures", heading: "", items: [pic("b"), pic("c")] },
    { id: "feat0002", kind: "feature", heading: "", body: "", picture: { path: "https://evil.example/x.png", width: 1, height: 1 }, side: "middle" },
  ] });
  const [one, pictures, two] = page.blocks;
  is("kept, on the side chosen", one?.kind === "feature" ? [one.side, one.picture?.path.endsWith("b".repeat(32) + ".webp")] : null, ["right", true]);
  is("a picture already beside words is not shown twice", pictures?.kind === "pictures" ? pictures.items.length : -1, 1);
  is("anything that is not one of the store's own pictures is not a picture, and a side is left or right", two?.kind === "feature" ? [two.picture, two.side] : null, [null, "left"]);
  is("its picture is one of the page's files, kept when the page is saved", picturePaths(page).length, 2);
}

part("Templates use them");
{
  const course = blocksFromTemplate("course", { title: "T", summary: "S", picture: false }).map((b) => b.kind);
  is("a course page starts with numbers, who it is for and bonuses", ["facts", "fit", "bonuses"].every((k) => course.includes(k as never)), true);
  const coaching = blocksFromTemplate("coaching", { title: "T", summary: "S", picture: false }).map((b) => b.kind);
  is("a coaching page with its steps", coaching.includes("steps"), true);
}

done();
