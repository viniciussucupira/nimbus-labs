/**
 * The letters of a creator's page (lib/store-look.ts, FONTS). Checked: a
 * store saved before they existed, or with anything else written, reads as
 * Modern and paints nothing new; each other pairing paints only the variables
 * its faces need; every face is declared from our own address and never
 * preloaded, so a page downloads only what its creator picked; the page's
 * headings and words take them; and saving the look without saying the
 * letters keeps the ones chosen.
 */
import { readFileSync } from "node:fs";
import { DEFAULT_LOOK, FONTS, fontStyle, isFont, lookStyle, parseLook } from "@/lib/store-look";
import { done, is, part } from "./check";

part("What is kept");
is("a store saved before letters existed is Modern", [parseLook({ theme: "sand", accent: "#e5533d" }).font, parseLook(null).font], ["modern", "modern"]);
is("anything else written is Modern too", [parseLook({ font: "comic-sans" }).font, parseLook({ font: 3 }).font, isFont("bold")], ["modern", "modern", true]);
is("a pairing chosen is kept", parseLook({ font: "editorial" }).font, "editorial");

part("What is painted");
is("Modern paints nothing new", [fontStyle("modern"), Object.keys(lookStyle(DEFAULT_LOOK)).some((k) => k.startsWith("--st-font"))], [{}, false]);
is("a serif for headings only", fontStyle("editorial"), { "--st-font-head": "var(--font-st-editorial)", "--st-head-tracking": "-0.015em" });
is("rounded letters for headings and words", [fontStyle("friendly")["--st-font-head"], fontStyle("friendly")["--st-font-body"]], ["var(--font-st-friendly)", "var(--font-st-friendly)"]);
is("carried by the page's look wherever it is drawn", lookStyle({ ...DEFAULT_LOOK, font: "bold" })["--st-font-head"], "var(--font-st-bold)");

part("Where the faces come from");
const layout = readFileSync("app/layout.tsx", "utf8");
const named = [...new Set(FONTS.flatMap((f) => [f.head, f.body]).filter(Boolean))];
is("each face is declared, from our own address", named.every((v) => layout.includes(`variable: "${v}"`)), true);
is("and none is preloaded", named.every((v) => new RegExp(`variable: "${v}"[^)]*preload: false`).test(layout)), true);
is("nor the site's italic accent, which no store page uses", /variable: "--font-accent"[^)]*preload: false/.test(layout), true);
const css = readFileSync("app/globals.css", "utf8");
is("the page's words and headings take them", [css.includes("font-family: var(--st-font-body, var(--font-body))"), css.includes("font-family: var(--st-font-head, var(--font-body))")], [true, true]);
const route = readFileSync("app/api/store/look/route.ts", "utf8");
is("saving the look without them keeps the ones chosen", route.includes("const font = isFont(guarded.body.font) ? guarded.body.font : guarded.store.look.font;"), true);
done();
