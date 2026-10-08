/**
 * Sections on a store page and a line of news across its top
 * (lib/store-sections.ts, added 7 October 2026).
 *
 * Measured that day: Stan lets a creator name sections on a store, and
 * Kajabi puts an announcement bar across a site. What is checked:
 *
 *   - a section is a heading and the product it starts at: one per product,
 *     twenty at most, and nothing without both;
 *   - a heading is drawn over the first published product at or after its
 *     own; of two with nothing published between them only the later one is;
 *   - a page of products is cut into its sections, and a later page that
 *     begins mid-section says so;
 *   - a store with no sections is one list, as it always was;
 *   - saved on the store: a heading on a product the store does not have is
 *     refused; removing a section's first product moves its heading to the
 *     next one, and a line of news that led to it leads nowhere;
 *   - the line of news is the creator's words on one line, or nothing.
 */
import { addProduct, claimHandle, ensureStatsId, removeProduct, setAnnouncement, setSections, storeForEmail } from "@/lib/store";
import { MAX_ANNOUNCEMENT, MAX_SECTIONS, groupBySection, parseAnnouncement, parseSections, sectionHeads, sectionOf, sectionsWithout } from "@/lib/store-sections";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

const items = (...spec: string[]) => spec.map((s) => ({ id: s.replace("*", ""), hidden: s.endsWith("*") }));

async function main(): Promise<void> {
  redis.clear();

  part("What a section is");
  is(
    "a heading and a product, tidied",
    parseSections([{ title: "  Courses \n", at: "abc123" }, { title: "", at: "def456" }, { title: "No product" }, { title: "Second on the same", at: "abc123" }, "nope"]),
    [{ title: "Courses", at: "abc123" }],
  );
  is("twenty at most", parseSections(Array.from({ length: 30 }, (_, i) => ({ title: `S${i}`, at: `p${i}` }))).length, MAX_SECTIONS);
  is("nothing from something that is not a list", parseSections({ title: "x", at: "y" }), []);

  part("Where a heading is drawn");
  const list = items("a", "b", "c*", "d", "e", "f");
  const sections = [{ title: "Guides", at: "a" }, { title: "Courses", at: "c" }, { title: "Calls", at: "f" }];
  is("over its product, or the next published one", [...sectionHeads(list, sections)], [["a", "Guides"], ["d", "Courses"], ["f", "Calls"]]);
  is("of two with nothing published between, only the later", [...sectionHeads(items("a*", "b*", "c"), [{ title: "One", at: "a" }, { title: "Two", at: "b" }])], [["c", "Two"]]);
  is("one with nothing published under it is not drawn", [...sectionHeads(items("a", "b*"), [{ title: "Empty", at: "b" }])], []);
  is("a heading on a product that is gone is ignored", [...sectionHeads(items("a", "b"), [{ title: "Lost", at: "zzz" }])], []);
  is("the section a product is in", [sectionOf(list, sections, "b"), sectionOf(list, sections, "e"), sectionOf(list, [{ title: "Later", at: "d" }], "a")], ["Guides", "Courses", null]);

  part("A page, cut into its sections");
  const page = (ids: string[]) => ids.map((id) => ({ id }));
  is(
    "each heading over its products",
    groupBySection(page(["a", "b", "d", "e", "f"]), list, sections).map((g) => [g.title, g.continued, g.products.map((p) => p.id)]),
    [["Guides", false, ["a", "b"]], ["Courses", false, ["d", "e"]], ["Calls", false, ["f"]]],
  );
  is(
    "a later page that begins mid-section says so",
    groupBySection(page(["e", "f"]), list, sections).map((g) => [g.title, g.continued, g.products.map((p) => p.id)]),
    [["Courses", true, ["e"]], ["Calls", false, ["f"]]],
  );
  is(
    "products above the first heading have none",
    groupBySection(page(["a", "b", "d"]), list, [{ title: "Courses", at: "d" }]).map((g) => [g.title, g.products.length]),
    [[null, 2], ["Courses", 1]],
  );
  is("no sections: one list, as it always was", groupBySection(page(["a", "b"]), list, []).map((g) => [g.title, g.products.length]), [[null, 2]]);
  is("an empty page has no groups", groupBySection([], list, sections), []);

  part("When a section's first product is removed");
  const order = ["a", "b", "c", "d"];
  is("its heading moves to the next product", sectionsWithout([{ title: "Guides", at: "a" }], order, "a"), [{ title: "Guides", at: "b" }]);
  is("unless that one starts a section already", sectionsWithout([{ title: "Guides", at: "a" }, { title: "Courses", at: "b" }], order, "a"), [{ title: "Courses", at: "b" }]);
  is("or there is none after it", sectionsWithout([{ title: "Last", at: "d" }], order, "d"), []);
  is("other sections are left alone", sectionsWithout([{ title: "Guides", at: "a" }, { title: "Calls", at: "d" }], order, "b"), [{ title: "Guides", at: "a" }, { title: "Calls", at: "d" }]);

  part("The line of news");
  is("the creator's words on one line", parseAnnouncement({ text: "  New:\n the spring   plan is out ", product: "abc123" }), { text: "New: the spring plan is out", product: "abc123" });
  is("bounded", parseAnnouncement({ text: "x".repeat(500) })?.text.length, MAX_ANNOUNCEMENT);
  is("nothing to say is nothing", [parseAnnouncement({ text: "   " }), parseAnnouncement(null), parseAnnouncement("hello")], [null, null, null]);
  is("a link that is not a product id leads nowhere", parseAnnouncement({ text: "Hi", product: "https://evil.example" })?.product, null);

  part("Saved on the store");
  const owner = "sections@example.com";
  await claimHandle(owner, "sectionshop", "Section Shop", "");
  await ensureStatsId(owner);
  const made: string[] = [];
  for (const title of ["Guide one", "Guide two", "Course one"]) {
    const added = await addProduct(owner, title, "", "19", null);
    if (!added.ok) throw new Error("no product");
    made.push(added.product.id);
  }
  is("a store written before sections has none", [(await storeForEmail(owner))!.sections, (await storeForEmail(owner))!.announcement], [[], null]);
  const refused = await setSections(owner, [{ title: "Ghosts", at: "nothere123" }]);
  is("a heading on a product the store does not have is refused", refused.ok ? "saved" : refused.reason, "unknown");
  const saved = await setSections(owner, [{ title: "Guides", at: made[0] }, { title: "Courses", at: made[2] }]);
  is("saved, in the order sent", saved.ok ? saved.store.sections.map((s) => s.title) : [], ["Guides", "Courses"]);
  const news = await setAnnouncement(owner, { text: "Start with Guide one", product: made[0] });
  is("the line of news leads to a product of the store", news.ok ? news.store.announcement : null, { text: "Start with Guide one", product: made[0] });
  const lost = await setAnnouncement(owner, { text: "Hi", product: "nothere123" });
  is("and never to one it does not have", lost.ok ? "saved" : lost.reason, "unknown");

  await removeProduct(owner, made[0]);
  const after = (await storeForEmail(owner))!;
  is("removing a section's first product moves its heading down", after.sections, [{ title: "Guides", at: made[1] }, { title: "Courses", at: made[2] }]);
  is("and the line of news keeps its words and leads nowhere", after.announcement, { text: "Start with Guide one", product: null });
  const cleared = await setAnnouncement(owner, { text: "" });
  is("an empty line takes it away", cleared.ok ? cleared.store.announcement : "x", null);
  const none = await setSections(owner, []);
  is("and an empty list takes the sections away", none.ok ? none.store.sections : null, []);

  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
