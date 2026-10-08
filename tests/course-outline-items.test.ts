/**
 * "What's inside" filled from a course's own outline (lib/course-outline-items.ts):
 * one part per module with its lessons, or the lessons of a course of one
 * module, in the store's language and inside the block's limits.
 */
import { insideFromCourse } from "@/lib/course-outline-items";
import { MAX_INSIDE_ITEMS, MAX_ITEM_DETAIL } from "@/lib/sales-page";
import { done, is, part } from "./check";

part("Modules, each with its lessons");
const two = insideFromCourse(
  [
    { title: "Holding the knife", lessons: ["The grip", "The claw"] },
    { title: "Cutting", lessons: ["Onions", "Herbs", "A whole chicken"] },
  ],
  "en",
);
is("one part per module, its lessons counted and named", two, [
  { title: "Holding the knife", detail: "2 lessons: The grip, The claw" },
  { title: "Cutting", detail: "3 lessons: Onions, Herbs, A whole chicken" },
]);
is("in the store's language", insideFromCourse([{ title: "A", lessons: ["x"] }, { title: "B", lessons: ["y", "z"] }], "pt")[1].detail, "2 aulas: y, z");

part("A course of one module");
is("lists its lessons instead", insideFromCourse([{ title: "All", lessons: ["One", "", "Two"] }], "en"), [
  { title: "One", detail: "" },
  { title: "Two", detail: "" },
]);

part("Inside the block's limits");
const long = insideFromCourse(
  Array.from({ length: 30 }, (_, i) => ({ title: `Module ${i + 1}`, lessons: Array.from({ length: 40 }, (_, j) => `A rather long lesson title number ${j + 1}`) })),
  "en",
);
is("at most the parts a block holds, each line cut at a whole title", [long.length, long.every((p) => p.detail.length <= MAX_ITEM_DETAIL), long[0].detail.endsWith("…")], [MAX_INSIDE_ITEMS, true, true]);
is("an empty course gives nothing", insideFromCourse([], "en"), []);

done();
