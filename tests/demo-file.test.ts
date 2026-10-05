/**
 * The file a buyer of the demo store is handed (lib/demo-file.ts).
 *
 * It is embedded as base64, so nothing that searches the code for a word can
 * see what the file says. That is how every page of both PDFs, and the four
 * pictures of them on the demo page, went on reading "Sample file from the
 * Nimbus Labs demo store" after the product had become Marktmorgen: the old
 * name was nowhere a search for it would look. It was found by buying the
 * file and opening it.
 *
 * So this opens the files the way a reader does, and reads them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync, constants } from "node:zlib";
import { getDemoFile, type DemoFileName } from "@/lib/demo-file";

const FILES: [DemoFileName, number][] = [
  ["weekly-meal-planner.pdf", 1],
  ["meal-planner-5-weeks.pdf", 5],
];

/** Every content stream of a PDF, inflated, as text. */
function streams(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes);
  const text = raw.toString("latin1");
  const out: string[] = [];
  const pattern = /stream\r?\n/g;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    const from = m.index + m[0].length;
    const to = text.indexOf("endstream", from);
    if (to < 0) break;
    try {
      out.push(inflateSync(raw.subarray(from, to), { finishFlush: constants.Z_SYNC_FLUSH }).toString("latin1"));
    } catch {
      // Not a compressed stream; nothing a reader sees is in it.
    }
  }
  return out;
}

for (const [name, pages] of FILES) {
  test(`${name} is a PDF, and says whose demo it is on every page`, () => {
    const bytes = getDemoFile(name);
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("latin1"), "%PDF-");
    const read = streams(bytes).filter((s) => s.includes("Tj"));
    assert.equal(read.length, pages, "one stream of text for each page");
    for (const page of read) {
      assert.ok(page.includes("Sample file from the Marktmorgen demo store"), "each page names the store it is a sample from");
      assert.ok(page.includes("Harbor Kitchen"));
    }
  });

  test(`${name} carries no name the product no longer has, in what is read or in what is kept about it`, () => {
    const bytes = getDemoFile(name);
    const everything = [Buffer.from(bytes).toString("latin1"), ...streams(bytes)].join("\n");
    assert.ok(!/nimbus/i.test(everything), "the old name is in neither the pages nor the file's own details");
    assert.match(everything, /Harbor Kitchen - Marktmorgen demo store/, "the file's author is the demo store, by today's name");
  });

  test(`${name} still says it was bought with no real money`, () => {
    // The one line that keeps a sample from being mistaken for a purchase.
    const first = streams(getDemoFile(name)).find((s) => s.includes("Tj")) ?? "";
    assert.ok(first.includes("This is a demo product. It was bought in Stripe test mode, so no real money moved."));
  });
}
