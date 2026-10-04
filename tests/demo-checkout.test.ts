/**
 * The demo store has to be buyable from where it is actually shown.
 *
 * The home page does not link to the demo store, it embeds it: an <iframe>
 * pointing at /demo, inside a panel the visitor opens with "See the live
 * demo" (components/home-parts.tsx). That is the first and for most visitors
 * the only place the demo is ever pressed.
 *
 * A form with no target loads its response into the frame it was submitted
 * from. The demo's checkout form had none, so pressing "Continue to checkout"
 * inside that panel sent Stripe Checkout into the frame — and Stripe refuses
 * to be framed. The buyer got a blank panel: in Chrome, "This content is
 * blocked. Contact the site owner to fix the issue."
 *
 * So the one page whose entire job is to prove that a buyer can pay and get
 * the file could not be paid on, from the place the site sends people to pay.
 * Opening /demo directly worked, which is exactly why it survived: the page
 * was fine, its setting was not, and the two were never tested together.
 *
 * target="_top" leaves the standalone page alone — outside a frame "_top" is
 * the same window — and breaks out of the panel when there is one, which is
 * what a checkout should do anyway.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

/** Comments explain the defect by name, so assertions about the markup must not read them. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("the demo's checkout form leaves the frame it is shown in", () => {
  const src = withoutComments(read("app/demo/page.tsx"));
  const at = src.indexOf('action="/api/demo/checkout"');
  assert.ok(at > 0, "the demo should still post to its own checkout route");
  const tag = src.slice(src.lastIndexOf("<form", at), src.indexOf(">", at) + 1);
  assert.match(
    tag,
    /target="_top"/,
    'without target="_top" this form sends Stripe Checkout into the home page\'s iframe, where Stripe ' +
      "refuses to render and the buyer sees a blocked, empty panel.",
  );
});

test("the home page really does frame the demo, which is why the line above matters", () => {
  // If this ever stops being true the rule above is still harmless, but the
  // reason for it should be found here rather than guessed at from the test.
  const src = read("components/home-parts.tsx");
  assert.match(src, /<iframe[^>]*src="\/demo"/, "the home page shows the demo store inside a frame");
});

test("nothing else in the demo navigates out of the frame by accident", () => {
  // The recovery form posts with fetch and stays put, which is right: it
  // returns a result into the page rather than going anywhere. Only a form
  // that hands the visitor to another site needs to break out.
  const recover = read("components/recover-form.tsx");
  assert.match(recover, /fetch\("\/api\/demo\/recover"/, "recovery answers in place rather than navigating");
  assert.ok(!/target="_top"/.test(recover), "a form that does not navigate has no reason to leave the frame");
});
