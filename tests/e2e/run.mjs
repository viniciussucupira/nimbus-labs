/**
 * The site itself, run on this computer and used in a real browser, from a
 * product's page to the email that opens what was bought.
 *
 *   npm run test:local
 *
 * Why it exists (7 October 2026). The unit tests call the code that hands a
 * purchase over; none of them goes through the door a buyer does. That is how
 * a paid gift went undelivered: every function it was made of was tested and
 * the path between them was not. And two things shipped that week — sections
 * on a store, and a purchase for several people — could only be looked at on
 * a store with products that can sell, which production does not have yet.
 *
 * What runs: the real app (`next dev`), unchanged, pointed at one local
 * stand-in for its database, for Stripe and for the email sender
 * (tests/e2e/services.mjs), through the addresses the code already accepts
 * for exactly this (STRIPE_CONNECT_API_BASE, RESEND_API_BASE, and the
 * database's own). No card is typed and no real service is reached. What it
 * cannot show is Stripe's own page: a checkout that is opened comes back
 * paid.
 *
 * What is checked, in a browser:
 *
 *   - the store page: its sections over the right products, and its line of
 *     news leading to a product;
 *   - a purchase for three people: the price times three, the link on the
 *     page after paying and in the receipt, three people each asking for a
 *     place and opening it from their own email, the product on each one's
 *     list of purchases, and a fourth person told every place is taken;
 *   - a gift: both emails, and the product on the recipient's list as a gift;
 *   - the studio: the sections as saved, a change to them showing on the
 *     store, and the sale named for what it was;
 *   - selling from the creator's own website: the code copied from the
 *     studio, pasted into a page on another address, shows the card; its
 *     button opens a paid checkout in a new tab with the place named on the
 *     sale; the plain button leads to the product's page; and the product's
 *     own page, framed the same way, is refused.
 *
 * It needs a browser driver (Playwright) on the machine; it is not part of
 * `npm test`, which runs anywhere. It takes about a minute.
 *
 * Checked against itself the day it was written: with the function that
 * finds a gift's product made to find nothing (the defect above), it stops
 * with a failure; put back, it passed four times in a row.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { startServices } from "./services.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const SERVICES = 4477;
const APP = 3100;
const LOCAL = `http://localhost:${APP}`;
const FAKE = `http://127.0.0.1:${SERVICES}`;
/** Links in emails and on pages are written for the site's real address; here they are opened on this computer. */
const local = (url) => url.replace("https://marktmorgen.com", LOCAL);

const env = {
  ...process.env,
  UPSTASH_REDIS_REST_URL: FAKE,
  UPSTASH_REDIS_REST_TOKEN: "local",
  STRIPE_SECRET_KEY: "sk_test_local_only_a_stand_in_0000",
  STRIPE_CONNECT_API_BASE: FAKE,
  RESEND_API_KEY: "re_local_only_a_stand_in",
  RESEND_API_BASE: FAKE,
  NEXT_TELEMETRY_DISABLED: "1",
};

let chromium;
try {
  const require = createRequire(join(root, "package.json"));
  ({ chromium } = require("playwright"));
} catch {
  console.error("This needs Playwright on the machine (npm i -g playwright). Nothing was run.");
  process.exit(2);
}

/** Stops the app and waits for it to go, so it never leaves its cache half written. */
async function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  const gone = new Promise((done) => child.once("exit", done));
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }
  const late = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }, 15_000);
  await gone;
  clearTimeout(late);
}

let failed = 0;
function is(name, got, want) {
  const same = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${same ? "ok  " : "FAIL"}  ${name}`);
  if (!same) {
    failed += 1;
    console.log(`        expected ${JSON.stringify(want)}\n        got      ${JSON.stringify(got)}`);
  }
}
const part = (name) => console.log(`\n${name}`);
const words = async (locator) => (await locator.innerText()).replace(/\s+/g, " ").trim();

const services = await startServices(SERVICES);
let app = null;
let browser = null;
try {
  // The store, written through the studio's own functions.
  const out = mkdtempSync(join(tmpdir(), "nimbus-e2e-seed-"));
  const seedFile = join(out, "seed.cjs");
  await build({ entryPoints: [join(here, "seed.ts")], bundle: true, platform: "node", format: "cjs", outfile: seedFile, logLevel: "error", alias: { "@": root } });
  // Not spawnSync: the stand-in database it writes to is served by this very process.
  const seeded = await new Promise((done) => {
    const child = spawn(process.execPath, [seedFile], { env, stdio: ["ignore", "pipe", "pipe"] });
    const said = { out: "", err: "" };
    child.stdout.on("data", (chunk) => (said.out += chunk));
    child.stderr.on("data", (chunk) => (said.err += chunk));
    child.on("close", (status) => done({ status, ...said }));
  });
  if (seeded.status !== 0) throw new Error(`the store could not be made:\n${seeded.err}`);
  const { ids, session } = JSON.parse(seeded.out.trim().split("\n").at(-1));

  // The app. A dev server stopped while writing can leave Turbopack's cache
  // unreadable, and the next one panics on it; it is only a cache, so it is
  // put aside once and the app started again.
  let log = "";
  const start = () => {
    log = "";
    app = spawn("npx", ["next", "dev", "-p", String(APP)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    app.stdout.on("data", (chunk) => (log += chunk));
    app.stderr.on("data", (chunk) => (log += chunk));
  };
  start();
  let started = Date.now();
  let retried = false;
  for (;;) {
    if (/panicked/.test(log) && !retried) {
      retried = true;
      await stop(app);
      rmSync(join(root, ".next", "dev", "cache"), { recursive: true, force: true });
      start();
      started = Date.now();
    }
    if (Date.now() - started > 180_000 || /panicked/.test(log)) throw new Error(`the app did not start:\n${log.slice(-2000)}`);
    const up = await fetch(`${LOCAL}/@localshop`).then((r) => r.status === 200).catch(() => false);
    if (up) break;
    await new Promise((wait) => setTimeout(wait, 1500));
  }

  browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium") } : {}).catch(() => chromium.launch());
  const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const open = (target, url) => target.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  const sectionsOn = (target) =>
    target.$$eval("main section[aria-label]", (all) => all.map((s) => [s.querySelector("h2")?.textContent ?? "", s.querySelectorAll("ul > li").length]));

  part("The store page");
  await open(page, `${LOCAL}/@localshop`);
  is("its sections, each over its own products", await sectionsOn(page), [["Recipe books", 2], ["Planning", 2], ["Courses", 1]]);
  is("its line of news, leading to the product it names", [await words(page.locator(".st-announce")), await page.locator(".st-announce a").getAttribute("href")], ["New: Knife Skills, ten short lessons →", `/@localshop/p/${ids["Knife Skills"]}`]);
  is("every product can be bought", await page.locator('form[action="/api/store/checkout"]').count(), 5);

  part("A purchase for three people");
  await open(page, `${LOCAL}/@localshop/p/${ids["Meal Planner"]}`);
  await page.locator("#group summary").click();
  is("offered under the buy box, at the price for each", await words(page.locator("#group button[type=submit]")), "Buy for your team — $27 per person");
  await page.fill('#group input[name="people"]', "3");
  await Promise.all([page.waitForURL(/\/thanks\?session_id=/, { timeout: 120_000 }), page.locator("#group button[type=submit]").click()]);
  await page.waitForLoadState("networkidle");
  is("paid: the price, three times", [await words(page.locator("h1")), (await words(page.locator("main"))).includes("for 3 people, for $81.")], ["Your 3 places are ready", true]);
  const link = await page.locator("#group-link").inputValue();
  is("the link to pass on is on the page", /\/@localshop\/group\/grp_[0-9a-f]{24}$/.test(link), true);
  const receipt = services.emails().at(-1);
  is("and in the buyer's receipt", [[].concat(receipt.to)[0], receipt.subject, receipt.text.includes(link)], ["buyer@example.com", "Your 3 places: Meal Planner", true]);

  const takes = async (address) => {
    const person = await context.newPage();
    await open(person, local(link));
    const left = (await words(person.locator("main"))).match(/(\d of \d places? (?:is|are) still open|All \d places have been taken)/)?.[1] ?? "";
    if ((await person.locator('input[name="email"]').count()) === 0) {
      await person.close();
      return { left, form: false };
    }
    await person.fill('input[name="email"]', address);
    await Promise.all([person.waitForURL(/status=sent/, { timeout: 60_000 }), person.locator("button[type=submit]").click()]);
    const mail = services.emails().filter((email) => [].concat(email.to).includes(address)).at(-1);
    const emailed = mail?.text.match(/https:\/\/\S+\?take=[0-9a-f]{64}/)?.[0] ?? "";
    await open(person, local(emailed));
    const said = await words(person.locator("h1"));
    await open(person, local((await person.locator('a:has-text("Open it")').getAttribute("href")) ?? ""));
    const list = await words(person.locator("main"));
    await person.close();
    return { left, form: true, mail: mail?.subject, said, owns: list.includes("Meal Planner") && list.includes("A place somebody bought for you") };
  };
  const took = { left: "", form: true, mail: "Take your place in Meal Planner", said: "The place is yours", owns: true };
  is("the first person: asks, opens their email, has it", await takes("ana@example.com"), { ...took, left: "3 of 3 places are still open" });
  is("the second", await takes("ben@example.com"), { ...took, left: "2 of 3 places are still open" });
  is("the third", await takes("cy@example.com"), { ...took, left: "1 of 3 places is still open" });
  is("a fourth is told every place is taken, and offered no form", await takes("dee@example.com"), { left: "All 3 places have been taken", form: false });

  part("Two boxes at checkout");
  await open(page, `${LOCAL}/@localshop/p/${ids["Weeknight Dinners"]}`);
  const boxes = page.locator('#buy input[name="bump"]');
  const buy = page.locator('#buy form:has(input[name="bump"]) button[type=submit]');
  is("each its own box, never checked for the buyer", [await boxes.count(), await boxes.evaluateAll((all) => all.some((box) => box.checked))], [2, false]);
  is("each says what it adds and for how much", await page.locator("#buy label:has(input[name=bump])").evaluateAll((all) => all.map((l) => l.innerText.split("\n")[0])), ["Add Pantry Checklist for $5", "Add Sunday Baking for $15"]);
  const says = [await words(buy)];
  await boxes.nth(1).check();
  says.push(await words(buy));
  await boxes.nth(0).check();
  says.push(await words(buy));
  await boxes.nth(1).uncheck();
  says.push(await words(buy));
  if (process.env.E2E_SHOTS) await page.locator("#buy").screenshot({ path: join(process.env.E2E_SHOTS, "two-boxes.png") });
  is("the button says the total of what is checked, whichever it is", says, ["Buy for $19", "Buy both for $34", "Buy all three for $39", "Buy both for $24"]);
  await boxes.nth(1).check();
  await Promise.all([page.waitForURL(/\/thanks\?session_id=/, { timeout: 120_000 }), buy.click()]);
  await page.waitForLoadState("networkidle");
  const both = services.checkouts().at(-1);
  is("one payment of all three, each named on the order", [both.amount_total, both.metadata.bump, both.metadata.bump2], [3900, ids["Pantry Checklist"], ids["Sunday Baking"]]);
  const thanks = await words(page.locator("main"));
  is("and the page after paying hands each one over", [thanks.includes("You bought Weeknight Dinners, Pantry Checklist, and Sunday Baking"), await page.locator('p.st-label:text-is("Also yours")').count()], [true, 2]);

  part("A gift");
  const before = services.emails().length;
  await open(page, `${LOCAL}/@localshop/p/${ids["Sunday Baking"]}`);
  await page.locator("#gift summary").click();
  await page.fill('#gift input[name="gift_to"]', "friend@example.com");
  await page.fill('#gift input[name="gift_from"]', "Ana");
  await page.fill('#gift textarea[name="gift_message"]', "Happy birthday!");
  await Promise.all([page.waitForURL(/\/thanks\?session_id=/, { timeout: 120_000 }), page.locator("#gift button[type=submit]").click()]);
  is("paid, and the page says where it went", await words(page.locator("h1")), "Your gift is on its way");
  // The gift is handed over once the page has been sent: its emails follow by a moment.
  let sent = [];
  for (let i = 0; i < 40 && sent.length < 2; i += 1) {
    await new Promise((wait) => setTimeout(wait, 500));
    sent = services.emails().slice(before);
  }
  is("one email each: the recipient and the buyer", sent.map((email) => [[].concat(email.to)[0], email.subject]), [["friend@example.com", "Ana sent you a gift: Sunday Baking"], ["buyer@example.com", "Your gift is on its way: Sunday Baking"]]);
  const gift = sent.find((email) => [].concat(email.to)[0] === "friend@example.com");
  is("with the buyer's message", gift?.text.includes("Happy birthday!"), true);
  await open(page, local(gift?.text.match(/https:\/\/\S+\/orders\?token=[0-9a-f]+/)?.[0] ?? ""));
  const given = await words(page.locator("main"));
  is("the recipient opens it from their email, as a gift", [given.includes("Sunday Baking"), given.includes("A gift from Ana")], [true, true]);

  part("The studio");
  const wide = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await wide.addCookies([{ name: "nl_session", value: session, url: LOCAL }]);
  const studio = await wide.newPage();
  studio.on("pageerror", (error) => errors.push(String(error)));
  await open(studio, `${LOCAL}/studio`);
  const card = studio.locator(".card", { has: studio.locator('p:text-is("Sections and news on your store")') });
  const headings = card.locator('input[placeholder="For example: Courses"]');
  is("the sections as they were saved", await headings.evaluateAll((all) => all.map((input) => input.value)), ["Recipe books", "Planning", "Courses"]);
  is("the sale is named for what it was", (await studio.locator("body").innerText()).includes("Meal Planner (for 3 people)"), true);
  await headings.first().fill("Cookbooks");
  await card.locator('button:has-text("Add a section")').click();
  await headings.last().fill("Quick lists");
  await card.locator("ul select").last().selectOption({ label: "Pantry Checklist" });
  await card.locator('button:has-text("Save sections")').click();
  await studio.waitForTimeout(2500);
  await open(page, `${LOCAL}/@localshop`);
  is("a change there shows on the store", await sectionsOn(page), [["Cookbooks", 2], ["Planning", 1], ["Quick lists", 1], ["Courses", 1]]);

  part("Boxes at checkout, set up in the studio");
  await studio.locator("button[aria-expanded]", { hasText: "Weeknight Dinners" }).first().click();
  is("the two boxes, each on its own line", [await studio.getByText("Offers Pantry Checklist for $5 at checkout").isVisible(), await studio.getByText("Offers Sunday Baking for $15 at checkout").isVisible()], [true, true]);
  await studio.getByRole("button", { name: "Offer one more at checkout (3 of 3)" }).click();
  const third = studio.locator("form", { has: studio.getByRole("button", { name: "Save the offer" }) });
  is("a product already in a box is not offered again", await third.locator("select option").evaluateAll((all) => all.map((o) => o.textContent)).then((names) => names.some((n) => n.startsWith("Pantry Checklist") || n.startsWith("Sunday Baking"))), false);
  await third.locator("select").selectOption({ label: "Meal Planner ($27)" });
  await third.locator('input[inputmode="decimal"]').fill("10");
  await third.getByRole("button", { name: "Save the offer" }).click();
  await studio.getByText("Offers Meal Planner for $10 at checkout").waitFor({ timeout: 30_000 });
  is("a third saved, and no room for a fourth", await studio.getByRole("button", { name: /Offer one more at checkout/ }).count(), 0);
  await open(page, `${LOCAL}/@localshop/p/${ids["Weeknight Dinners"]}`);
  const three = page.locator('#buy input[name="bump"]');
  for (let i = 0; i < 3; i += 1) await three.nth(i).check();
  is("on the product's page, three boxes, and the total of all four", [await three.count(), await words(page.locator('#buy form:has(input[name="bump"]) button[type=submit]'))], [3, "Buy all four for $49"]);

  part("Selling from the creator's own website");
  const tool = studio.locator("#buy-button");
  await tool.locator("select").first().selectOption({ label: "Pantry Checklist" });
  await tool.locator('input[maxlength="30"]').fill("blog");
  const cardCode = await tool.locator("textarea").inputValue();
  is("the studio gives the code for a card, tagged with the place", /^<iframe src="https:\/\/marktmorgen\.com\/embed\/localshop\/[^"?]+\?utm_source=blog&amp;utm_medium=buy-button"/.test(cardCode), true);
  is("and shows the card as it will look", await words(tool.frameLocator("iframe").locator("h1")), "Pantry Checklist");
  const asked = async (title) => {
    await tool.locator("select").first().selectOption({ label: title });
    await tool.frameLocator("iframe").locator("h1", { hasText: title }).waitFor();
    await studio.waitForTimeout(300);
    return (await tool.locator("textarea").inputValue()).match(/ height="(\d+)"/)?.[1];
  };
  const withPicture = await asked("Knife Skills");
  if (process.env.E2E_SHOTS) await tool.locator("iframe").screenshot({ path: join(process.env.E2E_SHOTS, "card-picture.png") });
  is("at the height the card asks for: taller with a picture across the top", [withPicture, await asked("Pantry Checklist")], ["420", "260"]);
  const cardAddress = `${LOCAL}/embed/localshop/${ids["Pantry Checklist"]}`;
  const framing = async (url) => {
    const response = await fetch(url);
    return [response.headers.get("x-frame-options"), (response.headers.get("content-security-policy") ?? "").match(/frame-ancestors [^;]+/)?.[0] ?? ""];
  };
  is("the card may be framed by any site", await framing(cardAddress), [null, "frame-ancestors *"]);
  is("the product's own page still only by this one", await framing(`${LOCAL}/@localshop/p/${ids["Pantry Checklist"]}`), ["SAMEORIGIN", "frame-ancestors 'self'"]);

  // The creator's blog: another address, holding the code exactly as copied.
  const site = await context.newPage();
  site.on("pageerror", (error) => errors.push(String(error)));
  await open(site, `${FAKE}/site?code=${encodeURIComponent(local(cardCode))}`);
  const framed = site.frameLocator("iframe");
  is("there, the card shows the product, its price and its button", [await words(framed.locator("h1")), await words(framed.locator(".st-price")), await words(framed.locator("button[type=submit]"))], ["Pantry Checklist", "$9", "Buy for $9"]);
  // Read the same way as the refused frame below, so that check can fail.
  const readsCard = (frame) => frame?.evaluate(() => document.body?.innerText.includes("Pantry Checklist")).catch(() => false);
  is("the browser drew it inside the blog's page", await readsCard(site.frames().find((frame) => frame !== site.mainFrame())), true);
  if (process.env.E2E_SHOTS) {
    await site.screenshot({ path: join(process.env.E2E_SHOTS, "site-card.png"), fullPage: true });
    await tool.screenshot({ path: join(process.env.E2E_SHOTS, "studio-card.png") });
  }
  const [tab] = await Promise.all([context.waitForEvent("page"), framed.locator("button[type=submit]").click()]);
  // Whatever the frame's height, the summary shows whole lines only and the
  // button is inside the frame.
  const knife = ids["Knife Skills"];
  const frames = [260, 420, 300, 520].map((height) => `<iframe src="${LOCAL}/embed/localshop/${knife}" style="width:400px;height:${height}px;border:0"></iframe>`);
  const fits = await context.newPage();
  await open(fits, `${FAKE}/site?code=${encodeURIComponent(frames.join(""))}`);
  const shapes = [];
  for (const frame of fits.frames().filter((one) => one !== fits.mainFrame())) {
    await frame.locator(".em-sum").waitFor();
    shapes.push(
      await frame.evaluate(() => {
        const summary = document.querySelector(".em-sum");
        const button = document.querySelector("button[type=submit]");
        const line = parseFloat(getComputedStyle(summary).lineHeight);
        const shown = summary.getBoundingClientRect().height;
        return {
          wholeLines: Math.abs(shown / line - Math.round(shown / line)) < 0.05 && Math.round(shown / line) >= 1,
          notCut: summary.getBoundingClientRect().bottom <= summary.parentElement.getBoundingClientRect().bottom + 0.5,
          buttonInside: button.getBoundingClientRect().bottom <= window.innerHeight,
        };
      }),
    );
  }
  if (process.env.E2E_SHOTS) await fits.screenshot({ path: join(process.env.E2E_SHOTS, "card-heights.png"), fullPage: true });
  await fits.close();
  is("in a frame of any height, the summary keeps whole lines and the button stays in view", shapes, Array(4).fill({ wholeLines: true, notCut: true, buttonInside: true }));
  tab.on("pageerror", (error) => errors.push(String(error)));
  await tab.waitForURL(/\/thanks\?session_id=/, { timeout: 120_000 });
  is("the button opens the checkout in a new tab, and the blog stays as it was", [site.url().startsWith(FAKE), /\/@localshop\/thanks\?session_id=/.test(tab.url())], [true, true]);
  const sale = services.checkouts().at(-1);
  is("for that product at its price, and the sale names the place", [sale.metadata.product, sale.amount_total, sale.metadata.utm_source, sale.metadata.utm_medium], [ids["Pantry Checklist"], 900, "blog", "buy-button"]);
  await tab.close();

  await open(site, `${FAKE}/site?code=${encodeURIComponent(`<iframe src="${LOCAL}/@localshop/p/${ids["Pantry Checklist"]}" width="400" height="300"></iframe>`)}`);
  const refused = site.frames().find((frame) => frame !== site.mainFrame());
  is("while the product's own page, framed there, is refused by the browser", [Boolean(refused), await readsCard(refused)], [true, false]);

  await tool.locator('input[value="button"]').check();
  await tool.locator('input[maxlength="60"]').fill("Get the checklist");
  const button = await tool.locator("textarea").inputValue();
  await open(site, `${FAKE}/site?code=${encodeURIComponent(local(button))}`);
  is("the plain button says what was typed", await words(site.locator("body a")), "Get the checklist");
  if (process.env.E2E_SHOTS) await site.screenshot({ path: join(process.env.E2E_SHOTS, "site-button.png") });
  await Promise.all([site.waitForURL(/\/@localshop\/p\//, { timeout: 120_000 }), site.locator("body a").click()]);
  is("and leads to the product's page, tagged with the place", [new URL(site.url()).searchParams.get("utm_source"), await words(site.locator("main h1").first())], ["blog", "Pantry Checklist"]);
  await site.close();

  part("Fair prices by country, switched on by the creator");
  const fairCard = studio.locator("#fair-prices");
  const asBuyerFrom = async (country) => {
    const visit = await browser.newContext({ viewport: { width: 430, height: 900 }, extraHTTPHeaders: { "x-vercel-ip-country": country } });
    const there = await visit.newPage();
    there.on("pageerror", (error) => errors.push(String(error)));
    await open(there, `${LOCAL}/@localshop/p/${ids["Pantry Checklist"]}`);
    return { visit, there };
  };
  {
    const { visit, there } = await asBuyerFrom("IN");
    is("off until switched on: a buyer in India sees the normal price", await words(there.locator("main .st-price").first()), "$9");
    await visit.close();
  }
  await fairCard.getByLabel("Show fair prices on my store").check();
  await fairCard.getByLabel("Add a country").selectOption({ label: "Brazil" });
  await fairCard.getByLabel("Level for Brazil").selectOption({ label: "20% off" });
  await fairCard.getByRole("button", { name: "Save" }).click();
  await studio.getByRole("status").getByText("Saved. Fair prices are on.").waitFor({ timeout: 30_000 });
  for (const [country, price, note] of [["IN", "Was $9 now $4.50", "A fair price for India: 50% off"], ["BR", "Was $9 now $7.20", "A fair price for Brazil: 20% off"], ["US", "$9", ""]]) {
    const { visit, there } = await asBuyerFrom(country);
    const shown = [await words(there.locator("main .st-price").first()), (await words(there.locator("#buy"))).includes(note || "A fair price")];
    is(`a buyer in ${country} sees ${note ? "the fair price, and why" : "the normal price"}`, shown, [price, Boolean(note)]);
    if (country === "IN") {
      if (process.env.E2E_SHOTS) {
        await there.locator("main").screenshot({ path: join(process.env.E2E_SHOTS, "fair-india.png") });
        await fairCard.screenshot({ path: join(process.env.E2E_SHOTS, "fair-studio.png") });
      }
      await Promise.all([there.waitForURL(/\/thanks\?session_id=/, { timeout: 120_000 }), there.locator('#buy form[action="/api/store/checkout"] button[type=submit]').first().click()]);
      const paid = services.checkouts().at(-1);
      is("and pays it: the creator's own coupon at the same percentage, written on the order", [paid.discount_coupon, paid.metadata.fair], ["mm_fair_50", "IN:50"]);
      is("made on their account once", services.coupons().map((c) => [c.id, c.percent_off]), [["mm_fair_50", "50"]]);
    }
    await visit.close();
  }

  part("Fair prices only on the products the creator picks");
  const products = fairCard.getByRole("group", { name: "Which products" });
  await products.getByLabel("Only the ones I pick").check();
  await products.getByLabel("Meal Planner").check();
  await fairCard.getByRole("button", { name: "Save" }).click();
  await studio.getByRole("status").getByText("Saved. Fair prices are on.").last().waitFor({ timeout: 30_000 });
  {
    const { visit, there } = await asBuyerFrom("IN");
    is("a product not picked: a buyer in India sees the normal price", await words(there.locator("main .st-price").first()), "$9");
    await visit.close();
  }
  await studio.reload();
  is("the choice is kept", [await products.getByLabel("Only the ones I pick").isChecked(), await products.getByLabel("Meal Planner").isChecked(), await products.getByLabel("Pantry Checklist").isChecked()], [true, true, false]);
  await products.getByLabel("Pantry Checklist").check();
  await fairCard.getByRole("button", { name: "Save" }).click();
  await studio.getByRole("status").getByText("Saved. Fair prices are on.").last().waitFor({ timeout: 30_000 });
  {
    const { visit, there } = await asBuyerFrom("IN");
    is("picked: the fair price again", await words(there.locator("main .st-price").first()), "Was $9 now $4.50");
    if (process.env.E2E_SHOTS) await fairCard.screenshot({ path: join(process.env.E2E_SHOTS, "fair-products.png") });
    await visit.close();
  }

  part("Nothing went wrong on the way");
  is("no page threw an error", errors, []);
  is("nothing was asked of a service with no stand-in", services.unknown(), []);
} catch (error) {
  failed += 1;
  console.error(`\nStopped: ${error?.stack ?? error}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  await stop(app);
  await services.close().catch(() => {});
}

console.log(failed ? `\n${failed} failing.` : "\nEverything passing.");
process.exit(failed ? 1 : 0);
