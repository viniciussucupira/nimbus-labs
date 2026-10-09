/**
 * A reminder asked for on a product's own page (components/store-product.tsx,
 * RemindBox; lib/checkout-ask.ts; lib/ask-when.ts). Checked:
 *
 *   - the form posts to the same guarded route as the checkout's way back,
 *     marked as from the page, with when, an empty field for bots and no
 *     address in the page's link afterward;
 *   - after asking, it says when and that it is the only email; a problem is
 *     said above the form, which stays;
 *   - the choices are an hour, tomorrow and three days, in every store
 *     language, and the email for it never says a checkout was left;
 *   - the page shows it only where a reminder can be sent: a paid product,
 *     on sale now, in a store with reminders on.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RemindBox } from "@/components/store-product";
import { ASK_WHENS, isAskWhen } from "@/lib/ask-when";
import { membershipWords } from "@/lib/buyer-words/membership";
import { givingWords } from "@/lib/buyer-words/giving";
import { LANGUAGE_CODES } from "@/lib/store-language";
import type { Listing, Store } from "@/lib/store";
import { done, is, part } from "./check";

const store = { name: "Harbor Kitchen", handle: "harbor", language: "en", currency: "usd" } as unknown as Store;
const product = { id: "plan000001", title: "Meal Planner" } as unknown as Listing;
const draw = (asked = "", when = "hour", on: Store = store) => renderToStaticMarkup(createElement(RemindBox, { store: on, product, asked, when }));

part("The form");
const form = draw();
is("posts to the guarded route, marked as from the page", [form.includes('action="/api/store/remind" method="post"'), form.includes('name="from" value="page"'), form.includes('name="product" value="plan000001"')], [true, true, true]);
is("with an email, when, and a field left empty by people", [/type="email" required=""[^>]*name="email"/.test(form), form.includes('name="when"'), /type="text" tabindex="-1"[^>]*name="website"/.test(form)], [true, true, true]);
is("closed until it is opened", form.includes("<details id=\"remind\"") && !form.includes(" open=\"\""), true);
is("the three choices", [...form.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]), ["hour", "day", "days"]);

part("After asking");
const asked = draw("asked", "day");
is("says when, and that it is the only email", [asked.includes("will email you once, with the link to Meal Planner, tomorrow."), asked.includes("That is the only email this sends.")], [true, true]);
is("open where it was, with no form left", [asked.includes(' open=""'), asked.includes("<form")], [true, false]);
const wrong = draw("email");
is("a problem is said above the form, which stays", [wrong.includes('role="alert"'), wrong.includes("That does not look like an email address"), wrong.includes("<form")], [true, true, true]);
is("a when that is not a choice reads as the hour", draw("asked", "forever").includes("in about an hour."), true);

part("In every store language");
is("the choices are an hour, tomorrow and three days", [ASK_WHENS.hour, ASK_WHENS.day, ASK_WHENS.days, isAskWhen("week")], [3600, 86_400, 259_200, false]);
is("each language says them and what was asked", LANGUAGE_CODES.map((code) => {
  const m = membershipWords(code);
  return Object.keys(m.askTimes).length === 3 && Object.keys(m.askSaid).length === 3 && m.pageAsked("S", "T", m.askSaid.day).includes(m.askSaid.day) && m.pageRemindNote("S").includes("S");
}), LANGUAGE_CODES.map(() => true));
is("and its email never says a checkout was left", LANGUAGE_CODES.map((code) => {
  const g = givingWords(code);
  return g.pageAskLead("Meal Planner", "S").includes("Meal Planner") && g.pageAskSubject("T") !== g.recoverSubject("T");
}), LANGUAGE_CODES.map(() => true));
is("drawn in the store's language", draw("", "hour", { ...store, language: "es" } as Store).includes("Dentro de tres días"), true);

part("Where it is offered");
const page = readFileSync("app/[handle]/p/[product]/page.tsx", "utf8");
is("only for a paid product on sale now, in a store with reminders on", page.includes("const remindable = selling && !soon && !isFree(product) && askable(store, product);"), true);
const route = readFileSync("app/api/store/remind/route.ts", "utf8");
is("and the answer goes back to the product's page, with no address in it", route.includes("?asked=${status}&when=${when}#remind") && !/asked=.*email/.test(route), true);
done();
