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
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  ANTHROPIC_API_KEY: "sk-ant-local_only_a_stand_in_0000",
  ANTHROPIC_API_BASE: FAKE,
  NEXT_TELEMETRY_DISABLED: "1",
};

let chromium;
let axePath;
try {
  const require = createRequire(join(root, "package.json"));
  ({ chromium } = require("playwright"));
  // The accessibility rules most audits run (axe-core), from this project's own copy.
  axePath = require.resolve("axe-core/axe.min.js");
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
/** Everything the app said, kept for E2E_APP_LOG=<file> (written there at the end). */
let appLog = "";
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
  const { ids, reviews: seededReviews, session } = JSON.parse(seeded.out.trim().split("\n").at(-1));

  // The app. A dev server stopped while writing can leave Turbopack's cache
  // unreadable, and the next one panics on it; it is only a cache, so it is
  // put aside once and the app started again.
  let log = "";
  const start = () => {
    log = "";
    app = spawn("npx", ["next", "dev", "-p", String(APP)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    app.stdout.on("data", (chunk) => {
      log += chunk;
      appLog += chunk;
    });
    app.stderr.on("data", (chunk) => {
      log += chunk;
      appLog += chunk;
    });
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

  // The dev server builds each route the first time it is asked for; asked
  // once here, so no check below races a route still being built.
  for (const path of [`/@localshop/p/${ids["Meal Planner"]}`, "/api/store/checkout", "/studio", "/@localshop/orders"]) {
    await fetch(`${LOCAL}${path}`).catch(() => {});
  }
  // On a fresh dev server, the store's pages under a product (its page, its
  // booking page) have now and then all answered "not found" for as long as
  // that server ran, without the page's code ever running — never on the
  // site itself, and never on a second server. So the first product page is
  // asked for until it is found, and a server that does not find it within
  // half a minute is started again, its cache put aside, at most twice.
  for (let restarts = 0; ; restarts += 1) {
    let found = false;
    for (let waited = 0; waited < 30_000 && !found; waited += 3_000) {
      const answer = await fetch(`${LOCAL}/@localshop/p/${ids["Meal Planner"]}`, { redirect: "manual" }).catch(() => null);
      found = answer?.status === 200;
      if (!found) await new Promise((wait) => setTimeout(wait, 3_000));
    }
    if (found) break;
    if (restarts >= 2) throw new Error("the product page was not found on three dev servers in a row");
    console.log("the first product page was not found; the dev server is started again");
    await stop(app);
    rmSync(join(root, ".next", "dev", "cache"), { recursive: true, force: true });
    start();
    const again = Date.now();
    while (!(await fetch(`${LOCAL}/@localshop`).then((r) => r.status === 200).catch(() => false))) {
      if (Date.now() - again > 180_000) throw new Error(`the app did not start again:\n${log.slice(-2000)}`);
      await new Promise((wait) => setTimeout(wait, 1500));
    }
    for (const path of [`/@localshop/p/${ids["Meal Planner"]}`, "/api/store/checkout", "/studio", "/@localshop/orders"]) {
      await fetch(`${LOCAL}${path}`).catch(() => {});
    }
  }
  browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium") } : {}).catch(() => chromium.launch());
  const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  // What a page's own security headers refused (lib/csp.ts): a script left without leave to run, a feature no browser knows.
  const policyRefusals = [];
  const reactWarnings = [];
  // A screenshot taken while another page is still being drawn hides the
  // text cursor by writing caret-color into the inputs: Playwright's doing,
  // not the page's. A diff that differs in nothing else is not a fault.
  const onlyScreenshotCaret = (text) => {
    // The diff is what follows React's link; the bullet list before it is the same in every warning.
    const diff = text.includes("hydration-mismatch") ? text.slice(text.indexOf("hydration-mismatch")) : "";
    const changed = diff.split("\n").map((line) => line.trim()).filter((line) => /^[+-]\s/.test(line));
    return changed.length > 0 && changed.every((line) => /caret-color:\s*"?transparent/.test(line));
  };
  // A frame refused on purpose (the product page framed by another site, below) is the policy working, not a fault.
  const watchPolicy = (target) => target.on("console", (m) => {
    if (/Content Security Policy|Permissions-Policy/.test(m.text()) && !/frame-ancestors/.test(m.text())) policyRefusals.push(m.text().slice(0, 200));
    // React saying the page the server drew is not the one the browser drew: the "1 Issue" a creator would see in development.
    // With where it happened and the end of React's diff, which names what differed.
    if (/hydrat|did not match|Warning: /.test(m.text()) && !onlyScreenshotCaret(m.text())) reactWarnings.push(`${target.url()} :: ${m.text().slice(0, 160)} … ${m.text().slice(-700)}`);
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  watchPolicy(page);
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
  // The first product page a fresh dev server builds has, now and then, come
  // back without its buy box; what it showed is said, and it is asked once more.
  for (let tries = 0; tries < 3 && !(await page.locator("#group summary").count()); tries += 1) {
    console.log("the product page came back without its buy box:", page.url(), (await words(page.locator("body"))).slice(0, 200));
    // What the app said meanwhile: why a page it has just built answers "not found" is in there.
    console.log("the app's last words:", log.split("\n").filter((l) => /GET |POST |⨯|rror/.test(l) && !/Error while requesting resource|Failed to download|next\/font/.test(l)).slice(-20).join("\n"));
    await page.waitForTimeout(3_000);
    await open(page, `${LOCAL}/@localshop/p/${ids["Meal Planner"]}`);
  }
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
  watchPolicy(studio);
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
  watchPolicy(site);
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
  watchPolicy(tab);
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
    watchPolicy(there);
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

  part("The store in Spanish");
  const setLanguage = (language) =>
    studio.evaluate(async (language) => {
      const response = await fetch("/api/store/language", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
      return response.status;
    }, language);
  is("a language there is not is refused", await setLanguage("tlh"), 400);
  is("Spanish is taken", await setLanguage("es"), 200);
  {
    const { visit, there } = await asBuyerFrom("US");
    is("the page says it is Spanish", await there.locator(".st-page[lang]").first().getAttribute("lang"), "es-ES");
    const box = await words(there.locator("#buy"));
    is("the buy button is in Spanish, with the price written the Spanish way", box.includes("Comprar por 9\u00a0US$") || box.includes("Comprar por 9 US$"), true);
    is("and nothing in the box is left in English", /\b(Buy|Pay|Subscribe|Choose)\b/.test(box), false);
    if (process.env.E2E_SHOTS) await there.locator("main").screenshot({ path: join(process.env.E2E_SHOTS, "spanish-product.png") });
    await open(there, `${LOCAL}/@localshop`);
    const front = await words(there.locator("main"));
    is("the store page too", front.includes("Hecho con Marktmorgen") || front.includes("Comprar por"), true);
    if (process.env.E2E_SHOTS) await there.locator("main").screenshot({ path: join(process.env.E2E_SHOTS, "spanish-store.png") });
    await open(there, `${LOCAL}/@localshop/p/${ids["Pantry Checklist"]}`);
    await Promise.all([there.waitForURL(/\/thanks\?session_id=/, { timeout: 120_000 }), there.locator('#buy form[action="/api/store/checkout"] button[type=submit]').first().click()]);
    is("Stripe's page is asked to speak Spanish", services.checkouts().at(-1).locale, "es");
    const thanks = await words(there.locator("main"));
    is("the page after paying is in Spanish", /Gracias|Pagado|Este pedido|Volver a/.test(thanks), true);
    is("with nothing on it left in English", /\b(Thank you|You bought|Back to|Download it|This order)\b/.test(thanks), false);
    if (process.env.E2E_SHOTS) await there.locator("main").screenshot({ path: join(process.env.E2E_SHOTS, "spanish-thanks.png") });
    await open(there, `${LOCAL}/@localshop/orders`);
    is("the list of purchases speaks Spanish", await there.locator(".st-page[lang]").first().getAttribute("lang"), "es-ES");
    await visit.close();
  }
  is("and back to English", await setLanguage("en"), 200);
  await open(studio, `${LOCAL}/studio`);
  is("the studio has the card that picks it", await studio.locator("select#store-language").count(), 1);
  is("showing the language the store speaks", await studio.locator("select#store-language").inputValue(), "en");

  part("A sales page with the newer blocks");
  {
    const saved = await studio.evaluate(async (id) => {
      const blocks = [
        { id: "hero0001", kind: "hero", headline: "Cut faster, safely", sub: "Ten short lessons.", media: "picture", video: null, layout: "cover", button: true },
        { id: "fact0001", kind: "facts", heading: "By the numbers", show: ["lessons", "buyers", "rating"] },
        { id: "fit00001", kind: "fit", heading: "Is it for you?", yesLabel: "", noLabel: "", yes: ["You cook every day", "You fear the knife"], no: ["You are a trained chef"] },
        { id: "step0001", kind: "steps", heading: "How it works", items: [{ title: "Pay", detail: "" }, { title: "Watch a lesson a day", detail: "Ten minutes each." }, { title: "Cook with confidence", detail: "" }] },
        { id: "comp0001", kind: "compare", heading: "Why a course", columnA: "Knife Skills", columnB: "", rows: [{ label: "Feedback on your grip", a: "\u2713", b: "\u2717" }, { label: "Time it takes", a: "Ten days", b: "Years" }] },
        { id: "bonu0001", kind: "bonuses", heading: "Also included", items: [{ title: "A sharpening chart", detail: "One page to keep by the board." }] },
        { id: "feat0001", kind: "feature", heading: "Why it works", body: "Short lessons you can follow at the board.", picture: null, side: "right", screens: "phone" },
        { id: "comp0002", kind: "compare", heading: "Side by side", columnA: "Knife Skills", columnB: "A video online", rows: [{ label: "A plan to follow", a: "\u2713", b: "\u2717" }], screens: "computer" },
        { id: "cta00001", kind: "cta", label: "", note: "" },
      ];
      const response = await fetch("/api/store/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, page: { blocks, seoTitle: "", seoDescription: "", next: null, test: null, style: "bands" } }) });
      return (await response.json()).ok === true;
    }, ids["Knife Skills"]);
    is("saved from the studio", saved, true);
    await open(page, `${LOCAL}/@localshop/p/${ids["Knife Skills"]}`);
    const main = await words(page.locator("main"));
    const hero = page.locator("header.sp-hero");
    is("the product's picture behind the words, with a button under them", [
      await hero.evaluate((el) => el.classList.contains("sp-hero-cover")),
      await hero.locator("h1").innerText(),
      await hero.locator("img.sp-hero-cover-img").count(),
      await hero.locator('form[action="/api/store/checkout"] button').count(),
      await hero.locator("h1").evaluate((el) => getComputedStyle(el).color),
    ], [true, "Cut faster, safely", 1, 1, "rgb(255, 255, 255)"]);
    is("who it is for, with the heading written for the creator", [main.includes("This is for you if"), main.includes("You fear the knife"), main.includes("This is not for you if")], [true, true, true]);
    is("the steps, numbered", await page.locator(".sp-step").count(), 3);
    is("the comparison, its other column named for the creator", [await page.locator('[data-block="comp0001"] .sp-compare tbody tr').count(), main.includes("Another way")], [2, true]);
    is("ticks and crosses spoken as yes and no", [await page.locator('[data-block="comp0001"] .sp-compare [role="img"][aria-label="Yes"]').count(), await page.locator('[data-block="comp0001"] .sp-compare [role="img"][aria-label="No"]').count()], [1, 1]);
    is("the bonus on its card, numbered", [await page.locator(".sp-bonus").count(), /bonus 1/i.test(main)], [1, true]);
    is("no number is shown that the store has not counted", await page.locator(".sp-facts").count(), 0);
    // Six sections show on a phone (the numbers block has none to show yet), so three bands.
    is("set in bands: every other section shown, from the first", [await page.locator(".sp-style-bands").count(), await page.locator(".sp-band-phone").count()], [1, 3]);
    is("a band is painted, not see-through", await page.locator(".sp-band-phone > .sp-section").first().evaluate((el) => getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)"), true);
    is("words beside a picture, with no picture yet: the words alone", [await page.locator(".sp-feature").count(), await page.locator(".sp-feature-picture").count(), main.includes("Short lessons you can follow at the board.")], [1, 0, true]);
    // This browser is phone-wide; the same page is then read at a computer's width.
    is("on a phone: the block kept to phones shows, the wide table does not", [await page.locator(".sp-only-phone").isVisible(), await page.locator(".sp-only-computer").isVisible()], [true, false]);
    if (process.env.E2E_SHOTS) await page.locator("main").screenshot({ path: join(process.env.E2E_SHOTS, "new-blocks.png") });
    const narrow = page.viewportSize();
    await page.setViewportSize({ width: 1200, height: 900 });
    is("on a computer: the other way round", [await page.locator(".sp-only-phone").isVisible(), await page.locator(".sp-only-computer").isVisible()], [false, true]);
    // Six sections on each screen: the bands alternate on what each one shows.
    is("bands counted apart for each screen, each painted on its own", [
      await page.locator(".sp-band-phone").count(),
      await page.locator(".sp-band-computer").count(),
      await page.locator(".sp-band-computer > .sp-section").last().evaluate((el) => getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)"),
    ], [3, 3, true]);
    if (process.env.E2E_SHOTS) await page.locator("main").screenshot({ path: join(process.env.E2E_SHOTS, "new-blocks-wide.png") });
    await page.setViewportSize(narrow);
  }

  part("The page coach in the studio");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Knife Skills"]}`);
    const title = studio.locator("#coach-title");
    const said = await words(title);
    const score = Number(said.match(/(\d+) out of 100/)?.[1] ?? -1);
    is("a score out of 100, for the page as it stands", score > 0 && score < 100, true);
    await studio.getByRole("button", { name: "See what to improve" }).click();
    const before = await studio.locator("ol > li").count();
    await studio.getByRole("button", { name: "Add benefits" }).click();
    is("a missing part is added with one press", await studio.locator("ol > li").count(), before + 1);
    if (process.env.E2E_SHOTS) await studio.locator("#coach-title").locator("xpath=ancestor::section[1]").screenshot({ path: join(process.env.E2E_SHOTS, "page-coach.png") });
  }

  part("The page's style, chosen in the studio");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Knife Skills"]}`);
    const picker = studio.getByRole("group", { name: "Page style" });
    is("the saved style is the one pressed", await picker.getByRole("button", { name: /^Bands/ }).getAttribute("aria-pressed"), "true");
    await studio.getByRole("button", { name: "Preview", exact: true }).click();
    await studio.getByRole("group", { name: "Page style" }).getByRole("button", { name: "Cards", exact: true }).click();
    is("the preview redraws in cards, before anything is saved", [await studio.locator(".sp-style-cards").count(), await studio.locator("[class*='sp-band-']").count()], [1, 0]);
    is("and the change waits to be saved", await studio.getByRole("button", { name: "Save the page" }).isEnabled(), true);
    await studio.getByRole("button", { name: "Save the page" }).click();
    await studio.getByText("Page saved.").first().waitFor({ timeout: 15_000 });
    await studio.getByRole("button", { name: "Build", exact: true }).click();
    const before = await studio.locator("ol > li").count();
    await studio.getByRole("button", { name: /^Duplicate block 2,/ }).click();
    is("a block is copied right under itself", await studio.locator("ol > li").count(), before + 1);
    await studio.getByText("Earlier versions").click();
    const load = studio.getByRole("button", { name: /^Load the version from / }).first();
    await load.waitFor({ timeout: 15_000 });
    await load.click();
    await studio.getByText(/^Loaded the version from /).first().waitFor({ timeout: 15_000 });
    is("the page as it was before the save comes back, in bands, waiting to be saved", [
      await studio.getByRole("group", { name: "Page style" }).getByRole("button", { name: /^Bands/ }).getAttribute("aria-pressed"),
      await studio.locator("ol > li").count(),
      await studio.getByRole("button", { name: "Save the page" }).isEnabled(),
    ], ["true", before, true]);
  }

  part("A product's address in words");
  {
    await open(page, `${LOCAL}/@localshop`);
    const href = await page.locator(`a[href*="/p/knife-skills-${ids["Knife Skills"]}"]`).first().getAttribute("href");
    is("the store links each product by its title's words and id", href, `/@localshop/p/knife-skills-${ids["Knife Skills"]}`);
    const response = await page.goto(`${LOCAL}${href}`, { waitUntil: "networkidle" });
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    is("that address opens the page, and names itself as the one to keep", [response.status(), canonical.endsWith(`/@localshop/p/knife-skills-${ids["Knife Skills"]}`)], [200, true]);
    const old = await page.goto(`${LOCAL}/@localshop/p/${ids["Knife Skills"]}`, { waitUntil: "networkidle" });
    is("an address shared before still opens the page, pointing search engines to the new one", [old.status(), (await page.locator('link[rel="canonical"]').getAttribute("href")).endsWith(`/p/knife-skills-${ids["Knife Skills"]}`)], [200, true]);
    const renamed = await page.goto(`${LOCAL}/@localshop/p/knife-basics-${ids["Knife Skills"]}`, { waitUntil: "networkidle" });
    is("and so does one with the words of an older title", [renamed.status(), (await words(page.locator("h1"))).length > 0], [200, true]);
  }

  part("Sharing a page and the store");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Knife Skills"]}`);
    await studio.getByRole("button", { name: "Share", exact: true }).click();
    const panel = studio.getByRole("region", { name: "Share Knife Skills" });
    const link = await panel.locator("#share-url").inputValue();
    is("the page's address in words, to copy", link.endsWith(`/@localshop/p/knife-skills-${ids["Knife Skills"]}`), true);
    const x = await panel.getByRole("link", { name: "X", exact: true }).getAttribute("href");
    is("a post opens the network's own page, tagged with where it went", x.startsWith("https://x.com/intent/post") && decodeURIComponent(x).includes("utm_source=x&utm_medium=share"), true);
    is("a QR code drawn", await panel.getByRole("img", { name: "QR code that opens Knife Skills" }).count(), 1);
    const [svg] = await Promise.all([studio.waitForEvent("download"), panel.getByRole("button", { name: "SVG" }).click()]);
    const [png] = await Promise.all([studio.waitForEvent("download"), panel.getByRole("button", { name: "PNG" }).click()]);
    is("and downloaded for print and for slides", [svg.suggestedFilename(), png.suggestedFilename()], ["knife-skills-qr.svg", "knife-skills-qr.png"]);
    if (process.env.E2E_SHOTS) await panel.screenshot({ path: join(process.env.E2E_SHOTS, "share-panel.png") });
    await open(studio, `${LOCAL}/studio`);
    await studio.getByText("Share the store: link, QR code, posts").click();
    is("the store's own address, to share the same way", (await studio.locator("#share-url").inputValue()).endsWith("/@localshop"), true);
  }

  part("Blocks added where they go, from a gallery");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Knife Skills"]}`);
    const blocks = studio.locator("ol > li");
    const before = await blocks.count();
    await studio.getByRole("button", { name: "Add a block after block 2", exact: true }).click();
    const gallery = studio.getByRole("region", { name: "Add a block after block 2", exact: true });
    is("a gallery opens there, with a box to find one", [await gallery.count(), await gallery.getByRole("searchbox").evaluate((el) => el === document.activeElement)], [1, true]);
    await gallery.getByRole("searchbox").fill("questions");
    is("finding narrows it", await gallery.getByRole("button", { name: /^Questions/ }).count(), 1);
    await gallery.getByRole("button", { name: /^Questions/ }).click();
    is("the block goes third, open to fill in", [await blocks.count(), (await words(blocks.nth(2))).startsWith("3. Questions"), await studio.locator("#block-find").count()], [before + 1, true, 0]);
    await studio.getByRole("group", { name: "Shows on" }).getByRole("button", { name: "Phones only" }).click();
    is("a block can be kept to phones, and its row says so", (await words(blocks.nth(2))).includes("Phones only · "), true);
    // A pause, so adding the next block is a step of its own for Undo.
    await studio.waitForTimeout(700);
    await studio.getByRole("button", { name: /^Add a block \(/ }).click();
    await studio.getByRole("region", { name: "Add a block at the end" }).getByRole("button", { name: /^Button/ }).click();
    is("and one at the end goes last", (await words(blocks.last())).includes(`${before + 2}. Button`), true);
    await studio.waitForTimeout(700);
    await studio.getByRole("button", { name: "Undo the last change" }).click();
    is("Undo takes the last change back, and only it", await blocks.count(), before + 1);
    await studio.getByRole("button", { name: "Redo" }).click();
    is("Redo puts it back", await blocks.count(), before + 2);
    await studio.locator("body").press("Control+z");
    is("and so do the keys: Ctrl+Z", await blocks.count(), before + 1);
    await studio.locator("body").press("Control+Shift+z");
    is("and Ctrl+Shift+Z", await blocks.count(), before + 2);
    // Unsaved: a link elsewhere in the studio asks first, and staying keeps everything.
    let asked = "";
    studio.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await studio.getByRole("navigation", { name: "Products" }).getByRole("link", { name: /Sunday Baking/ }).click();
    await studio.waitForTimeout(300);
    is("leaving unsaved changes is asked about, and staying keeps them", [asked.startsWith("You have changes that are not saved"), studio.url().includes(`product=${ids["Knife Skills"]}`), await blocks.count()], [true, true, before + 2]);
    if (process.env.E2E_SHOTS) {
      await studio.locator("ol").first().screenshot({ path: join(process.env.E2E_SHOTS, "block-list.png") });
      await studio.getByRole("button", { name: "Add a block after block 1", exact: true }).click();
      await studio.getByRole("region", { name: "Add a block after block 1", exact: true }).screenshot({ path: join(process.env.E2E_SHOTS, "block-gallery.png") });
    }
  }

  part("A page kept from visitors while it is worked on");
  {
    const save = (hidden, showFrom = 0) => studio.evaluate(async ([id, hidden, showFrom]) => {
      const blocks = [{ id: "hero0009", kind: "hero", headline: "Dinner in thirty minutes, every night", sub: "", media: "none", video: null }];
      const response = await fetch("/api/store/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, page: { blocks, seoTitle: "", seoDescription: "", next: null, test: null, style: "plain", hidden, showFrom } }) });
      return (await response.json()).ok === true;
    }, [ids["Weeknight Dinners"], hidden, showFrom]);
    is("saved, kept from visitors", await save(true), true);
    await open(page, `${LOCAL}/@localshop/p/${ids["Weeknight Dinners"]}`);
    is("visitors see the product's plain page meanwhile", await words(page.locator("h1")), "Weeknight Dinners");
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Weeknight Dinners"]}`);
    is("the studio says so, and the switch is off, with a moment to show it offered", [
      await studio.getByText("Hidden", { exact: true }).count() > 0,
      await studio.getByRole("checkbox", { name: /^Visitors see this page/ }).isChecked(),
      await studio.getByLabel("Show it by itself at (optional)").count(),
    ], [true, false, 1]);
    const now = Math.floor(Date.now() / 1000);
    await save(true, now + 3600);
    await open(page, `${LOCAL}/@localshop/p/${ids["Weeknight Dinners"]}`);
    is("set to show in an hour: still the plain page", await words(page.locator("h1")), "Weeknight Dinners");
    await save(true, now - 60);
    await open(page, `${LOCAL}/@localshop/p/${ids["Weeknight Dinners"]}`);
    is("its moment come: shown, with nobody switching it on", await words(page.locator("h1")), "Dinner in thirty minutes, every night");
    is("shown once switched on and saved", await save(false), true);
    await open(page, `${LOCAL}/@localshop/p/${ids["Weeknight Dinners"]}`);
    is("and then it is the product's page", await words(page.locator("h1")), "Dinner in thirty minutes, every night");
    // Put back as it was, a plain page, for what follows.
    await studio.evaluate(async (id) => fetch("/api/store/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, page: null }) }), ids["Weeknight Dinners"]);
  }

  part("Things said elsewhere, each with a link to where");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Weeknight Dinners"]}`);
    await studio.getByRole("button", { name: "Use the Ebook, guide or templates template" }).click();
    await studio.getByRole("button", { name: /^Add a block \(/ }).click();
    await studio.getByRole("region", { name: "Add a block at the end" }).getByRole("button", { name: /^Said elsewhere/ }).click();
    await studio.getByRole("button", { name: "Add one (0 of 6)" }).click();
    await studio.getByLabel("Their words, as they said them").fill("Cooked three of these this week. The kids ate everything.");
    await studio.getByLabel("Who said it (optional)").fill("@maria");
    await studio.getByLabel("Where it was said").fill("not a link");
    is("an address that is not one is said at once", await studio.getByText("That is not a full https address of a public page.").count(), 1);
    await studio.getByLabel("Where it was said").fill("https://x.com/maria/status/123");
    await studio.getByRole("button", { name: "Save the page" }).click();
    await studio.getByText(/^Page saved/).first().waitFor({ timeout: 30_000 });
    await open(page, `${LOCAL}/@localshop/p/${ids["Weeknight Dinners"]}`);
    const quote = page.locator(".sp-quote");
    is("on the page, their words with who said them", [(await words(quote)).includes("Cooked three of these this week."), (await words(quote)).includes("@maria")], [true, true]);
    is("and a link to the original a visitor can check", [await quote.getByRole("link", { name: /See it on x\.com/ }).getAttribute("href"), await quote.locator("blockquote").getAttribute("cite")], ["https://x.com/maria/status/123", "https://x.com/maria/status/123"]);
    if (process.env.E2E_SHOTS) await quote.screenshot({ path: join(process.env.E2E_SHOTS, "said-elsewhere.png") });
    await studio.evaluate(async (id) => fetch("/api/store/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, page: null }) }), ids["Weeknight Dinners"]);
  }

  part("Pictures seen large, without leaving the page");
  {
    await open(page, `${LOCAL}/@localshop/p/${ids["Sunday Baking"]}`);
    const viewer = page.locator("dialog.pv-dialog");
    await page.getByRole("link", { name: "The rye loaf, sliced, full size" }).click();
    is("a click opens the picture on the page, with where it is among them", [await viewer.evaluate((d) => d.open), await words(viewer.locator(".pv-count")), (await words(viewer)).includes("Week one: rye")], [true, "1 of 3", true]);
    await page.keyboard.press("ArrowRight");
    is("the arrow keys go through them", [await words(viewer.locator(".pv-count")), await viewer.locator(".pv-image").getAttribute("alt")], ["2 of 3", "A lemon cake"]);
    await viewer.getByRole("button", { name: "Previous picture" }).click();
    await viewer.getByRole("button", { name: "Previous picture" }).click();
    is("and round, from the first back to the last", await words(viewer.locator(".pv-count")), "3 of 3");
    await page.keyboard.press("Escape");
    is("Escape closes it, back where the reader was", [await viewer.evaluate((d) => d.open), page.url().includes(`/p/${ids["Sunday Baking"]}`)], [false, true]);
    await page.getByRole("link", { name: "A lemon cake, full size" }).click();
    if (process.env.E2E_SHOTS) await page.screenshot({ path: join(process.env.E2E_SHOTS, "picture-viewer.png") });
    await viewer.getByRole("button", { name: "Close" }).click();
    is("and so does Close", await viewer.evaluate((d) => d.open), false);
  }

  part("Reviews picked to show first");
  {
    const saved = await studio.evaluate(async ([id, first, knife]) => {
      const blocks = [
        { id: "hero0002", kind: "hero", headline: "Bake on Sundays", sub: "", media: "none", video: null },
        { id: "revw0002", kind: "reviews", heading: "What bakers say", first: [first] },
        { id: "faq00002", kind: "faq", heading: "Questions", items: [{ q: "Do I need a stand mixer?", a: "No: every recipe is kneaded by hand." }] },
        { id: "prod0002", kind: "product", heading: "Goes well with it", product: knife, note: "Sharp knives make quicker bread." },
      ];
      const response = await fetch("/api/store/page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, page: { blocks, seoTitle: "", seoDescription: "", next: null, test: null, style: "plain" } }) });
      return (await response.json()).ok === true;
    }, [ids["Sunday Baking"], seededReviews[0], ids["Knife Skills"]]);
    is("saved with the oldest review picked", saved, true);
    await open(page, `${LOCAL}/@localshop/p/${ids["Sunday Baking"]}`);
    const items = page.locator(".rv-item");
    is("the picked one first, marked as picked, then the newest", [
      await items.count(),
      (await words(items.nth(0))).includes("The rye loaf alone was worth it."),
      (await words(items.nth(0))).includes("Picked by the creator"),
      (await words(items.nth(1))).includes("My Sunday mornings smell like bread now."),
      (await words(items.nth(1))).includes("Picked by the creator"),
    ], [3, true, true, true, false]);
    const card = page.locator("a.sp-product");
    if (process.env.E2E_SHOTS) await page.locator('[data-block="prod0002"]').screenshot({ path: join(process.env.E2E_SHOTS, "product-card.png") });
    is("another product as a card: today's name and price, linking to its own page", [await card.count(), (await card.getAttribute("href"))?.endsWith(`/p/knife-skills-${ids["Knife Skills"]}`), (await words(card)).includes("Knife Skills"), (await words(card)).includes("$49")], [1, true, true, true]);
    const marked = await page.locator('script[type="application/ld+json"]').evaluateAll((all) => all.map((el) => JSON.parse(el.textContent)["@type"]));
    const faq = await page.locator('script[type="application/ld+json"]').evaluateAll((all) => all.map((el) => JSON.parse(el.textContent)).find((d) => d["@type"] === "FAQPage"));
    is("search engines are told the product, where it sits, and its answered questions", [marked.includes("Product"), marked.includes("BreadcrumbList"), faq?.mainEntity?.[0]?.name], [true, true, "Do I need a stand mixer?"]);
    if (process.env.E2E_SHOTS) await page.locator("#reviews").screenshot({ path: join(process.env.E2E_SHOTS, "picked-reviews.png") });
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Sunday Baking"]}`);
    await studio.getByRole("button", { name: /^2\. Reviews/ }).click();
    const boxes = studio.getByRole("group", { name: /^Show first/ }).getByRole("checkbox");
    is("the studio offers each review, with the picked one checked", [await boxes.count(), await boxes.nth(0).isChecked()], [3, true]);
    await studio.getByRole("button", { name: /^4\. Another product/ }).click();
    is("and the card's product is chosen in a list of the store's others", await studio.locator("select[id$='-p']").inputValue(), ids["Knife Skills"]);
  }

  part("On a wide screen, the page beside its blocks as they are edited");
  {
    const was = studio.viewportSize();
    await studio.setViewportSize({ width: 1440, height: 900 });
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Knife Skills"]}`);
    const beside = studio.getByRole("complementary", { name: "The page as visitors see it" });
    is("drawn beside the blocks", await beside.isVisible(), true);
    await studio.getByRole("button", { name: /^1\. Hero/ }).click();
    await studio.getByLabel("Headline", { exact: true }).fill("Sharper knives, faster dinners");
    is("and redrawn as the words are typed", await words(beside.locator("h1")), "Sharper knives, faster dinners");
    await beside.locator('[data-block="step0001"]').click();
    is("a press on a part of the page opens its block, outlined", [
      await studio.locator("#row-step0001 button[aria-expanded]").first().getAttribute("aria-expanded"),
      await beside.locator('[data-block="step0001"]').evaluate((el) => el.classList.contains("sp-editing")),
    ], ["true", true]);
    if (process.env.E2E_SHOTS) await studio.screenshot({ path: join(process.env.E2E_SHOTS, "side-by-side.png") });
    await studio.setViewportSize(was);
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Knife Skills"]}`);
    is("on a narrower one, drawn once, under Preview", await beside.count(), 0);
  }

  part("A page started from a template, chosen by what it holds");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Meal Planner"]}`);
    const course = studio.getByRole("list", { name: "The blocks of the Course template, in order" });
    is("each template shows its blocks in order", [(await course.locator("li").count()) >= 4, (await words(course)).includes("Questions")], [true, true]);
    if (process.env.E2E_SHOTS) await course.locator("xpath=ancestor::ul[1]").screenshot({ path: join(process.env.E2E_SHOTS, "template-gallery.png") });
    await studio.getByRole("button", { name: "Use the Course template" }).click();
    const blocks = studio.locator("ol > li");
    is("one press lays it out, under the product's own headline", [(await blocks.count()) >= 5, (await words(blocks.first())).startsWith("1. Hero")], [true, true]);
  }

  part("A page started from another product's page");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Pantry Checklist"]}`);
    await studio.locator("#page-copy").selectOption({ label: "Knife Skills" });
    await studio.getByRole("button", { name: "Copy its blocks" }).click();
    await studio.locator("#coach-title").waitFor({ timeout: 30_000 });
    is("its blocks are here, ready to change, and nothing saved yet", [await studio.locator("ol > li").count() >= 8, await studio.getByRole("button", { name: "Save the page" }).isEnabled()], [true, true]);
  }

  part("A whole page translated with AI");
  {
    await open(studio, `${LOCAL}/studio/pages?product=${ids["Knife Skills"]}`);
    await studio.getByText("Translate the whole page with AI").click();
    is("says first how many of the month's jobs the page takes", /This page takes 1 of your writing job/.test(await words(studio.locator("details", { hasText: "Translate the whole page with AI" }))), true);
    await studio.getByLabel("Into").selectOption("es");
    await studio.getByRole("button", { name: "Translate", exact: true }).click();
    await studio.getByText(/^Translated into Spanish/).waitFor({ timeout: 30_000 });
    const asked = services.writing().filter((w) => String(w.system).startsWith("You translate the words"));
    is("asks once, in the language picked", [asked.length, String(asked[0]?.system).includes("into Spanish")], [1, true]);
    is("nothing saved until Save is pressed", await studio.getByRole("button", { name: "Save the page" }).isEnabled(), true);
    await studio.getByRole("button", { name: /^1\. Hero/ }).click();
    const headline = await studio.getByLabel("Headline", { exact: true }).inputValue();
    is("every word of them", headline.length > 0 && headline === headline.toUpperCase(), true);
    await studio.waitForTimeout(700);
    await studio.locator("#undo-step").click();
    const undone = await studio.getByLabel("Headline", { exact: true }).inputValue();
    is("and Undo puts them back", undone !== headline && undone !== undone.toUpperCase(), true);
  }

  part("Each product's page views, in the studio's numbers");
  {
    await open(studio, `${LOCAL}/studio`);
    const table = studio.locator("table", { has: studio.locator('caption:text-is("What you sell, best first")') });
    is("a column for its page's views, beside its checkouts", await table.locator('th:text-is("Page views")').count(), 1);
    // The counting itself is held by tests/product-views.test.ts: this browser
    // calls itself headless, and a store's numbers leave out what robots open.
  }

  part("A reminder asked for on a product's page");
  {
    const remind = (enabled) => studio.evaluate(async (enabled) => (await (await fetch("/api/store/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, address: "1 Harbor Road, Portland, ME 04101" }) })).json()).ok === true, enabled);
    is("with reminders switched on", await remind(true), true);
    await open(page, `${LOCAL}/@localshop/p/${ids["Meal Planner"]}`);
    const box = page.locator("#remind");
    await box.locator("summary").click();
    await box.getByLabel("Your email").fill("later@example.com");
    await box.getByLabel("When").selectOption("day");
    await Promise.all([page.waitForURL(/asked=asked/), box.getByRole("button", { name: "Remind me once" }).click()]);
    is("back on the product's page, saying when, with no address in its link", [
      (await words(page.locator("#remind"))).includes("with the link to Meal Planner, tomorrow."),
      page.url().includes("later%40example.com") || page.url().includes("later@example.com"),
    ], [true, false]);
    if (process.env.E2E_SHOTS) await page.locator("#remind").screenshot({ path: join(process.env.E2E_SHOTS, "remind-asked.png") });
    is("and off again, the page offers none", await remind(false).then(() => open(page, `${LOCAL}/@localshop/p/${ids["Meal Planner"]}`)).then(() => page.locator("#remind").count()), 0);
  }

  part("The line under the store's name, written with AI");
  {
    await open(studio, `${LOCAL}/studio`);
    await studio.getByRole("button", { name: "Edit name and description" }).click();
    await studio.getByRole("button", { name: "Suggest three lines" }).click();
    const lines = studio.getByRole("list", { name: "Suggested lines" });
    await lines.waitFor({ timeout: 30_000 });
    is("three lines to choose from", await lines.locator("li").count(), 3);
    await lines.getByRole("button", { name: "Use this line: Cook once, eat all week." }).click();
    is("one press puts it in the box, nothing saved yet", await studio.locator("#store-bio").inputValue(), "Cook once, eat all week.");
  }

  part("The letters of the page, picked in the studio");
  {
    await open(studio, `${LOCAL}/studio`);
    const letters = studio.getByRole("group", { name: "Letters" });
    await letters.getByText("Editorial", { exact: true }).click();
    await studio.getByRole("button", { name: "Save the look" }).click();
    await studio.getByText("Look saved.").first().waitFor({ timeout: 15_000 });
    await open(page, `${LOCAL}/@localshop`);
    const painted = await page.locator(".st-page").first().evaluate((el) => [el.style.getPropertyValue("--st-font-head"), getComputedStyle(el.querySelector(".font-display") ?? el).fontFamily]);
    is("the store page's headings take them", [painted[0], /Fraunces|font-st-editorial/i.test(painted[1]) || painted[1].includes("__")], ["var(--font-st-editorial)", true]);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: join(process.env.E2E_SHOTS, "letters-editorial.png") });
    await open(studio, `${LOCAL}/studio`);
    await studio.getByRole("group", { name: "Letters" }).getByText("Modern", { exact: true }).click();
    await studio.getByRole("button", { name: "Save the look" }).click();
    await studio.getByText("Look saved.").first().waitFor({ timeout: 15_000 });
    await open(page, `${LOCAL}/@localshop`);
    is("and back to Modern, nothing more is painted", await page.locator(".st-page").first().evaluate((el) => el.style.getPropertyValue("--st-font-head")), "");
  }

  part("Logging in is not starting a store");
  await open(page, `${LOCAL}/signin?to=login`);
  is("pressed Log in: the page and its tab say log in", [await words(page.locator("h1")), await page.title()], ["Log in to your store", "Log in to your store — Marktmorgen"]);
  await open(page, `${LOCAL}/signin`);
  is("pressed Start your store: they say start", [await words(page.locator("h1")), await page.title()], ["Start your store", "Start your store — Marktmorgen"]);

  part("No accessibility errors on what buyers see");
  {
    // A context of its own that lets the rules' script in past the pages'
    // policy; the pages themselves are drawn exactly as for anyone else.
    const audit = await browser.newContext({ viewport: { width: 430, height: 900 }, bypassCSP: true });
    const reader = await audit.newPage();
    const check = async (path, width) => {
      if (width) await reader.setViewportSize({ width, height: 900 });
      await reader.goto(`${LOCAL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
      // Checked where it was meant to be, not on a page it was sent on to.
      if (new URL(reader.url()).pathname !== path.split("?")[0]) return [`landed on ${new URL(reader.url()).pathname}`];
      await reader.addScriptTag({ path: axePath });
      const found = await reader.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        const said = result.violations.map((v) => `${v.id} ×${v.nodes.length}: ${v.nodes[0]?.target.join(" ")} — ${v.nodes[0]?.failureSummary?.split("\n").slice(1, 2).join(" ").trim()}`);
        // A page the rules found nothing to check on would pass for the wrong reason.
        return result.passes.length >= 10 ? said : [`only ${result.passes.length} rules applied: the check did not run on the page`];
      });
      return found;
    };
    const pages = [
      ["the store", "/@localshop", 0],
      ["a sales page, on a phone", `/@localshop/p/${ids["Knife Skills"]}`, 0],
      ["the same page, on a computer", `/@localshop/p/${ids["Knife Skills"]}`, 1200],
      ["a page with reviews", `/@localshop/p/${ids["Sunday Baking"]}`, 430],
      ["all of a product's reviews", `/@localshop/p/${ids["Sunday Baking"]}/reviews`, 0],
      ["a product page without blocks", `/@localshop/p/${ids["Meal Planner"]}`, 0],
      ["signing in", "/signin", 0],
      // And what a creator works in, signed in as the store's owner.
      ["the studio", "/studio", 1200],
      ["the sales page editor", `/studio/pages?product=${ids["Knife Skills"]}`, 1200],
    ];
    await audit.addCookies(await wide.cookies());
    for (const [name, path, width] of pages) is(name, await check(path, width), []);
    await audit.close();
  }

  part("Nothing went wrong on the way");
  is("no page threw an error", errors, []);
  is("and no page's own policy refused anything on it", [...new Set(policyRefusals)], []);
  is("and React found every page as the server drew it", [...new Set(reactWarnings)], []);
  is("nothing was asked of a service with no stand-in", services.unknown(), []);
} catch (error) {
  failed += 1;
  console.error(`\nStopped: ${error?.stack ?? error}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  await stop(app);
  await services.close().catch(() => {});
  if (process.env.E2E_APP_LOG) writeFileSync(process.env.E2E_APP_LOG, appLog);
}

console.log(failed ? `\n${failed} failing.` : "\nEverything passing.");
process.exit(failed ? 1 : 0);
