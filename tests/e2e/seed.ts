/**
 * A store for tests/e2e/run.mjs to open in a browser: five products with a
 * link each, cut into three sections, with a line of news, able to sell, and
 * a session for its owner. Written through the same functions the studio
 * uses, into the stand-in database.
 */
import { addProduct, claimHandle, ensureStatsId, setAnnouncement, setProductLink, setSections, setStripeAccount, setSubscription } from "@/lib/store";
import { openSession } from "@/lib/auth";

const OWNER = "owner@example.com";

const PRODUCTS = [
  ["Weeknight Dinners", "Thirty dinners that take half an hour.", "19"],
  ["Sunday Baking", "Twelve loaves and cakes for a slow morning.", "24"],
  ["Meal Planner", "A week of meals and one grocery list.", "27"],
  ["Pantry Checklist", "What to keep in the cupboard, on one page.", "9"],
  ["Knife Skills", "Ten short lessons on cutting safely and fast.", "49"],
] as const;

async function main(): Promise<void> {
  const claimed = await claimHandle(OWNER, "localshop", "Harbor Kitchen Local", "Simple family meals. A store on this computer only, for checking pages.");
  if (!claimed.ok) throw new Error(`the address was refused: ${claimed.reason}`);
  await ensureStatsId(OWNER);
  await setStripeAccount(OWNER, "acct_1LocalHarbor0001", true);
  await setSubscription(OWNER, { active: true, tier: "creator", cycle: "month", subscriptionId: null, customerId: null, trialEnds: 0 });
  const ids: Record<string, string> = {};
  for (const [title, summary, price] of PRODUCTS) {
    const made = await addProduct(OWNER, title, summary, price, null);
    if (!made.ok) throw new Error(`${title} was refused: ${made.reason}`);
    ids[title] = made.product.id;
    const linked = await setProductLink(OWNER, made.product.id, `https://example.com/${made.product.id}`);
    if (!linked.ok) throw new Error(`${title} could not be given its link`);
  }
  const sections = await setSections(OWNER, [
    { title: "Recipe books", at: ids["Weeknight Dinners"] },
    { title: "Planning", at: ids["Meal Planner"] },
    { title: "Courses", at: ids["Knife Skills"] },
  ]);
  if (!sections.ok) throw new Error("the sections were refused");
  const news = await setAnnouncement(OWNER, { text: "New: Knife Skills, ten short lessons", product: ids["Knife Skills"] });
  if (!news.ok) throw new Error("the line of news was refused");
  console.log(JSON.stringify({ ids, session: await openSession(OWNER) }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
