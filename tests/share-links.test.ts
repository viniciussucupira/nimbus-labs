/**
 * Sharing a page (lib/share-links.ts, components/share-panel.tsx). Checked:
 *
 *   - each place a link is shared to is named in its tags, so the store's
 *     numbers say where visits came from, and the tags are the ones the
 *     store reads (utm_source, utm_medium);
 *   - each network opens its own page to post from, with the address in;
 *   - the QR code is a drawing of its grid with the quiet border scanners
 *     need, and holds the tagged address;
 *   - the studio offers it for each product's page and for the store.
 */
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { qrFileName, qrSvg, shareLinks, taggedFor } from "@/lib/share-links";
import { done, is, part } from "./check";

const URL_ = "https://marktmorgen.com/@harbor/p/knife-skills-5e3f350b52";

async function main(): Promise<void> {
  part("Tagged with where it went");
  is("a QR code", taggedFor(URL_, "qr"), `${URL_}?utm_source=qr&utm_medium=qr-code`);
  is("a post", taggedFor(URL_, "x"), `${URL_}?utm_source=x&utm_medium=share`);
  is("an address that already has a query", taggedFor(`${URL_}?a=1`, "email"), `${URL_}?a=1&utm_source=email&utm_medium=share`);

  part("Each network's own page");
  const links = shareLinks(URL_, "Knife Skills");
  is("five places", links.map((l) => l.label), ["X", "Facebook", "LinkedIn", "WhatsApp", "Email"]);
  is("each carries its own tagged address", links.every((l) => decodeURIComponent(l.href).includes(`${URL_}?utm_source=${l.place}&utm_medium=share`)), true);
  is("on the networks' own addresses", links.slice(0, 4).map((l) => new URL(l.href).host), ["x.com", "www.facebook.com", "www.linkedin.com", "wa.me"]);
  is("an email with the words as its subject", links[4].href.startsWith("mailto:?subject=Knife%20Skills&body="), true);

  part("The QR code");
  const code = QRCode.create(taggedFor(URL_, "qr"), { errorCorrectionLevel: "M" });
  const modules = Array.from(code.modules.data, Boolean);
  const svg = qrSvg(modules, code.modules.size);
  const side = (code.modules.size + 8) * 8;
  is("a white square with the quiet border", svg.includes(`width="${side}" height="${side}"`) && svg.includes('<rect width="100%" height="100%" fill="#ffffff"/>'), true);
  is("one dark square drawn for each dark module", (svg.match(/h8v8h-8z/g) ?? []).length, modules.filter(Boolean).length);
  is("nothing in it but squares", /<(script|text|image|foreignObject)/i.test(svg), false);
  is("a file name from the title", [qrFileName("Crème Brûlée: The Course", "svg"), qrFileName("包丁", "png")], ["creme-brulee-the-course-qr.svg", "page-qr.png"]);

  part("In the studio");
  is("for each product's page", readFileSync("components/page-editor.tsx", "utf8").includes("<SharePanel url={shareUrl}"), true);
  is("on the creator's own domain when it has one", readFileSync("app/studio/pages/page.tsx", "utf8").includes("`${storeBase(store)}/p/${productSegment(selected)}`"), true);
  is("and for the store", readFileSync("app/studio/page.tsx", "utf8").includes("<SharePanel url={storeBase(store)}"), true);
  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
