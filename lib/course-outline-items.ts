/**
 * A course's own outline, as the parts of a sales page's "What's inside"
 * block (lib/sales-page.ts): what a creator otherwise types a second time.
 *
 * Several modules become one part each, with how many lessons it holds and
 * their titles; a course of one module lists its lessons instead. Titles are
 * the creator's own, as the course shows them; the few words added (how many
 * lessons) are in the store's language. Browser-safe.
 */
import { MAX_INSIDE_ITEMS, MAX_ITEM, MAX_ITEM_DETAIL, type InsideItem } from "@/lib/sales-page";
import { blockWords } from "@/lib/buyer-words/blocks";

export type CourseOutline = { title: string; lessons: string[] }[];

export function insideFromCourse(outline: CourseOutline, language: unknown): InsideItem[] {
  const w = blockWords(language);
  const modules = outline.filter((m) => m.title.trim() || m.lessons.length);
  if (modules.length === 0) return [];
  if (modules.length === 1) {
    return modules[0].lessons
      .filter((title) => title.trim())
      .slice(0, MAX_INSIDE_ITEMS)
      .map((title) => ({ title: title.slice(0, MAX_ITEM), detail: "" }));
  }
  return modules.slice(0, MAX_INSIDE_ITEMS).map((m, i) => {
    const titles = m.lessons.filter((t) => t.trim());
    const count = `${titles.length} ${w.lessons(titles.length)}`;
    let detail = titles.length ? `${count}: ${titles.join(", ")}` : "";
    if (detail.length > MAX_ITEM_DETAIL) detail = `${detail.slice(0, MAX_ITEM_DETAIL - 1).replace(/[,\s]+[^,]*$/, "")}…`;
    return { title: (m.title.trim() || `${i + 1}`).slice(0, MAX_ITEM), detail };
  });
}
