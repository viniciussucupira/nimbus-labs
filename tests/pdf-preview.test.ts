/**
 * The first pages of a PDF, cut into a file of their own (lib/pdf-preview.ts).
 * What is checked: only the pages asked for, never more than the file has or
 * than ten; the rest of the book is not in the copy; only a PDF small enough
 * to read can have one.
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import { MAX_PREVIEW_PAGES, firstPages, previewable } from "@/lib/pdf-preview";
import { MAX_STAMP_BYTES } from "@/lib/product-file";
import { done, is, part } from "./check";

async function book(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i += 1) doc.addPage().drawText(`Recipe ${i}`, { x: 50, y: 700, size: 18, font });
  doc.setTitle("Weeknight Recipes");
  return doc.save();
}

async function main(): Promise<void> {
  part("Cutting");
  const twelve = await book(12);
  const three = await PDFDocument.load(await firstPages(twelve, 3));
  is("only the pages asked for", three.getPageCount(), 3);
  is("named as a preview", three.getTitle(), "Weeknight Recipes (first 3 pages)");
  const short = await PDFDocument.load(await firstPages(await book(2), 5));
  is("never more than the file has", short.getPageCount(), 2);
  const many = await PDFDocument.load(await firstPages(twelve, 50));
  is(`never more than ${MAX_PREVIEW_PAGES}`, many.getPageCount(), MAX_PREVIEW_PAGES);
  const text = Buffer.from(await firstPages(twelve, 3)).toString("latin1");
  is("the later pages are not in the copy", text.includes("Recipe 12"), false);

  part("Which files");
  const file = { pathname: "stores/a/b/book.pdf", name: "book.pdf", bytes: 1_000, contentType: "application/pdf", addedAt: "2026-10-07T00:00:00Z" };
  is("a PDF", previewable(file), true);
  is("not a PDF too big to read", previewable({ ...file, bytes: MAX_STAMP_BYTES + 1 }), false);
  is("not another kind of file", previewable({ ...file, name: "book.zip", contentType: "application/zip" }), false);
  is("not nothing", previewable(null), false);
  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
