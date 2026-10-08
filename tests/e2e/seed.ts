/**
 * A store for tests/e2e/run.mjs to open in a browser: five products with a
 * link each, cut into three sections, with a line of news, able to sell, and
 * a session for its owner. Written through the same functions the studio
 * uses, into the stand-in database.
 */
import { addProduct, claimHandle, ensureStatsId, setAnnouncement, setProductExtras, setProductImage, setProductLink, setSections, setStripeAccount, setSubscription } from "@/lib/store";
import { openSession } from "@/lib/auth";
import { saveReview } from "@/lib/reviews";

const OWNER = "owner@example.com";

const PRODUCTS = [
  ["Weeknight Dinners", "Thirty dinners that take half an hour.", "19"],
  ["Sunday Baking", "Twelve loaves and cakes for a slow morning.", "24"],
  ["Meal Planner", "A week of meals and one grocery list.", "27"],
  ["Pantry Checklist", "What to keep in the cupboard, on one page.", "9"],
  // A long summary, so the card pasted into a website has to cut it at a whole line.
  ["Knife Skills", "Ten short lessons on cutting safely and fast: holding the knife, the claw grip, onions without tears, herbs, a whole chicken, and keeping the edge sharp at home.", "49"],
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
  // A picture on one product, so the card pasted into a creator's site is
  // drawn with one. Its file is not in this stand-in, so it shows as missing;
  // what is checked is the room the card gives it.
  const pictured = await setProductImage(OWNER, ids["Knife Skills"], { path: `images/${"a".repeat(24)}/${"b".repeat(32)}.jpg`, width: 1200, height: 800, alt: "A chef's knife on a board", bytes: 1, small: null });
  if (!pictured.ok) throw new Error("the picture was refused");
  // Two boxes at checkout on one product, each at a price of its own.
  for (const [slot, [title, cents, pitch]] of ([["Pantry Checklist", 500, "The list I shop with."], ["Sunday Baking", 1500, "For the weekend."]] as const).entries()) {
    const boxed = await setProductExtras(OWNER, ids["Weeknight Dinners"], { bump: { productId: ids[title], priceCents: cents, pitch }, slot });
    if (!boxed.ok) throw new Error(`the box for ${title} was refused: ${boxed.reason}`);
  }
  const sections = await setSections(OWNER, [
    { title: "Recipe books", at: ids["Weeknight Dinners"] },
    { title: "Planning", at: ids["Meal Planner"] },
    { title: "Courses", at: ids["Knife Skills"] },
  ]);
  if (!sections.ok) throw new Error("the sections were refused");
  const news = await setAnnouncement(OWNER, { text: "New: Knife Skills, ten short lessons", product: ids["Knife Skills"] });
  if (!news.ok) throw new Error("the line of news was refused");
  // Three verified reviews on one product, oldest first, for picking which show first.
  const statsId = (await ensureStatsId(OWNER))?.statsId;
  if (!statsId) throw new Error("the store has no statsId");
  const reviews: string[] = [];
  for (const [n, rating, text] of [[1, 5, "The rye loaf alone was worth it."], [2, 4, "Clear steps, though the cake took longer."], [3, 5, "My Sunday mornings smell like bread now."]] as const) {
    const saved = await saveReview(statsId, { productId: ids["Sunday Baking"], email: `reader${n}@example.com`, reference: `cs_test_seed${n}`, pi: `pi_seed${n}`, rating, text, name: `Reader ${n}` }, Date.now() - (10 - n) * 86_400_000);
    if (saved.state !== "created") throw new Error(`review ${n} was refused: ${saved.state}`);
    reviews.push(saved.review.id);
  }
  console.log(JSON.stringify({ ids, reviews, session: await openSession(OWNER) }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
