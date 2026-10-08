/**
 * The pictures and countdown blocks, drawn (components/sales-blocks.tsx).
 *
 * The rules of each are tested in sales-pictures.test.ts; this draws them to
 * markup the way the server does, because a block that parses and then draws
 * nothing, or draws a picture from the wrong address, is a blank space on a
 * page somebody is paying to send visitors to. What is checked:
 *
 *   - a picture is drawn from our own picture address, with its size, its
 *     description and its line, and opens full size; in the studio's preview
 *     it is not a link;
 *   - a countdown shows the time left from the clock the page was drawn
 *     with, and is not drawn at all once its moment has passed or was never
 *     set.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type BlockContext, BlockView } from "@/components/sales-blocks";
import type { PageBlock } from "@/lib/sales-page";
import { done, is, part } from "./check";

const ctx: BlockContext = {
  storeName: "Harbor Kitchen",
  productTitle: "Meal Planner",
  picture: null,
  photo: null,
  action: { kind: "link", href: "#buy" },
  defaultLabel: "Get it now",
  now: 1_900_000_000,
};
const draw = (block: PageBlock, context: BlockContext = ctx) => renderToStaticMarkup(createElement(BlockView, { block, ctx: context, reviews: null }));

part("Pictures");
const path = `images/${"a".repeat(24)}/${"1".repeat(32)}.webp`;
const pictures: PageBlock = { id: "pics0001", kind: "pictures", heading: "A look inside", items: [{ path, width: 1200, height: 800, alt: "Week one, on a page", caption: "Week one" }] };
const html = draw(pictures);
const address = `/api/image/${"a".repeat(24)}/${"1".repeat(32)}.webp`;
is("drawn from our own picture address, with its size", html.includes(`<img src="${address}" alt="Week one, on a page" width="1200" height="800"`), true);
is("with its heading and its line", [html.includes("A look inside"), html.includes("<figcaption") && html.includes("Week one</figcaption>")], [true, true]);
is("it opens full size", html.includes(`<a href="${address}" target="_blank"`), true);
is("in the studio's preview it is not a link", draw(pictures, { ...ctx, preview: true }).includes("<a "), false);
is("a block with no picture draws nothing", draw({ ...pictures, items: [] } as PageBlock), "");

part("A countdown");
const until = ctx.now! + 2 * 86_400 + 3 * 3_600 + 4 * 60 + 5;
const countdown: PageBlock = { id: "cnt00001", kind: "countdown", heading: "The launch price ends in", until, note: "After that it is $49." };
const timer = draw(countdown);
const numbers = [...timer.matchAll(/sp-countdown-number">([^<]*)</g)].map((m) => m[1]);
is("the time left, from the clock the page was drawn with", numbers, ["02", "03", "04", "05"]);
is("with what it counts to and what changes then", [timer.includes("The launch price ends in"), timer.includes("After that it is $49.")], [true, true]);
is("not drawn once its moment has passed", draw({ ...countdown, until: ctx.now! - 1 } as PageBlock), "");
is("or before it was given one", draw({ ...countdown, until: 0 } as PageBlock), "");

done();
