/**
 * What a sales page tells search engines (lib/page-structured-data.ts):
 * its answered questions, once each, not ones kept to computers, and where
 * it sits in the store.
 */
import { readFileSync } from "node:fs";
import { breadcrumbData, faqData } from "@/lib/page-structured-data";
import { parsePage } from "@/lib/sales-page";
import { done, is, part } from "./check";

async function main(): Promise<void> {
  part("Questions and answers");
  const page = parsePage({
    blocks: [
      { id: "faq00001", kind: "faq", heading: "Questions", items: [{ q: "How long do I keep it?", a: "For good." }, { q: "Is there a refund?", a: "Within 30 days." }] },
      { id: "faq00002", kind: "faq", heading: "More", items: [{ q: "how long do I keep it?", a: "Again." }, { q: "Do I need a knife?", a: "Any sharp one." }], screens: "phone" },
      { id: "faq00003", kind: "faq", heading: "Wide", items: [{ q: "Only on computers?", a: "Yes." }], screens: "computer" },
    ],
  });
  const faq = faqData(page.blocks) as { "@type": string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  is("an FAQ page", faq["@type"], "FAQPage");
  is("each question once, with its answer, in the page's order", faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), [["How long do I keep it?", "For good."], ["Is there a refund?", "Within 30 days."], ["Do I need a knife?", "Any sharp one."]]);
  is("none when the page has no answered question", faqData(parsePage({ blocks: [{ id: "text0001", kind: "text", heading: "A", body: "b" }] }).blocks), null);

  part("Where it sits");
  const crumbs = breadcrumbData({ name: "Harbor Kitchen", url: "https://marktmorgen.com/@harbor" }, { title: "Knife Skills", url: "https://marktmorgen.com/@harbor/p/knife-skills-5e3f350b52" }) as { itemListElement: { position: number; name: string }[] };
  is("the store, then the product", crumbs.itemListElement.map((i) => [i.position, i.name]), [[1, "Harbor Kitchen"], [2, "Knife Skills"]]);

  part("On the page");
  const source = readFileSync("app/[handle]/p/[product]/page.tsx", "utf8");
  is("both are given to search engines", [source.includes("<JsonLd data={breadcrumbData("), source.includes("{faq ? <JsonLd data={faq} /> : null}")], [true, true]);
  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
