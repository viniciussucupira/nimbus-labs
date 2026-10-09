/**
 * The store coach (lib/store-coach.ts, added 9 October 2026). Checked: an
 * empty store gets no checks; each check reads the store's own record; the
 * score is the weight done over the weight there is; what to do next is the
 * weightiest undone first; the longer checks come only for stores they fit.
 */
import { addProduct, claimHandle, ensureStatsId, setAnswers, setJoin, setSocials, storeForEmail } from "@/lib/store";
import { nextChecks, storeChecks, storeScore } from "@/lib/store-coach";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

async function main(): Promise<void> {
  redis.clear();
  const owner = "coach@example.com";
  await claimHandle(owner, "coachshop", "Coach Shop", "");
  await ensureStatsId(owner);
  const path = (page: string) => `/studio/${page}`;
  const checksFor = async () => storeChecks((await storeForEmail(owner))!, { path });

  part("Nothing to coach before the first product");
  is("no checks", await checksFor(), []);

  part("A first product");
  await addProduct(owner, "Bread Book", "", "19", null);
  let checks = await checksFor();
  is("ten checks, none of the ones for bigger stores", checks.map((c) => c.id), ["pictures", "summaries", "page", "answers", "reviews", "list", "faq", "contact", "socials", "blog"]);
  is("none done yet: a product with no picture, no line, no page", [storeScore(checks), checks.filter((c) => c.done).map((c) => c.id)], [0, []]);
  is("next: the weightiest first, in order", nextChecks(checks).map((c) => c.id), ["pictures", "page", "summaries", "answers"]);
  is("each says where it is done", checks.find((c) => c.id === "page")?.href, "/studio/pages");

  part("Done as the store does them");
  await addProduct(owner, "Cake Course", "Twelve cakes, step by step.", "49", null);
  await setAnswers(owner, { on: true, facts: "" });
  await setJoin(owner, { on: true });
  await setSocials(owner, [{ network: "instagram", url: "@coachshop" }]);
  checks = await checksFor();
  const doneIds = checks.filter((c) => c.done).map((c) => c.id);
  is("answers, a way to stay in touch and profiles count; one product without a line does not", [doneIds, checks.find((c) => c.id === "summaries")?.done], [["answers", "list", "socials"], false]);
  is("the score is the weight done over the weight there is", storeScore(checks), Math.round((5 / 18) * 100));

  part("Checks for bigger stores");
  await addProduct(owner, "Pie Guide", "Pies.", "9", null);
  is("a bundle, from three products", (await checksFor()).some((c) => c.id === "bundle"), true);
  for (const n of [4, 5, 6]) await addProduct(owner, `Extra ${n}`, "More.", "5", null);
  is("sections, from six", (await checksFor()).some((c) => c.id === "sections"), true);

  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
