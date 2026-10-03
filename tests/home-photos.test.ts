/**
 * Every photograph on the home page must be a real one.
 *
 * Written after twenty of twenty-four ids shipped broken: they came from
 * Unsplash's search API, whose `urls.raw` needs query parameters this site
 * does not send, so the bare id resolved to nothing and the page served
 * twenty empty rectangles. The ids below were each loaded in a browser
 * before being written into the source.
 *
 * This test cannot reach the network — the sandbox has no route to the image
 * host — so it checks the two things that failed in practice: that every id
 * on the page is one that was checked by hand, and that no photograph is
 * used so often it stops reading as a market.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Ids confirmed to load, in a browser, before being used anywhere. */
const VERIFIED = new Set([
  "photo-1537861295351-76bb831ece99", "photo-1562577309-d67db487e6cd",
  "photo-1519408469771-2586093c3f14", "photo-1580642682609-8b6ab251fbb7",
  "photo-1620545628446-6319bce6b95c", "photo-1621111848501-8d3634f82336",
  "photo-1632494873717-d630cd5f2634", "photo-1574100004472-e536d3b6bacc",
  "photo-1561070791-2526d30994b5", "photo-1626785774573-4b799315345d",
  "photo-1637270873552-80d3bb9569dd", "photo-1603201667246-3c45012c6d17",
  "photo-1534670007418-fbb7f6cf32c3", "photo-1761628332000-9da4f810183e",
  "photo-1613579917953-d35e6b72d32b", "photo-1528712306091-ed0763094c98",
  "photo-1556911220-e15b29be8c8f", "photo-1653233797467-1a528819fd4f",
  "photo-1518737003272-dac7c4760d5e", "photo-1556911073-a517e752729c",
  "photo-1636647511729-6703539ba71f", "photo-1606787503066-794bb59c64bc",
  "photo-1556910103-1c02745aae4d", "photo-1592837613828-4b65deb44f15",
  "photo-1556908153-1055164fe2df", "photo-1676496962536-d8ef110ff6f0",
  "photo-1626444232874-e72c020eeb0e", "photo-1761971975962-9cc397e2ba2a",
  "photo-1763403921315-f2ef8697199f", "photo-1666478042293-17ea55f33b52",
  "photo-1665781665930-43c9bfd33952", "photo-1671580704901-98cedb46e06b",
  "photo-1671581084718-c4c04fc00250", "photo-1671581081519-321ab53e0dac",
  "photo-1671581081106-283f2bcdef71",
  // the four the site opened with, live since before any of this
  "photo-1543871595-e11129e271cc", "photo-1758599880979-f6a64947b541",
  "photo-1780277993159-b4ca60e8922d", "photo-1787647090008-4b88ffc977b7",
  "photo-1765429158141-b283bbe7d0e4", "photo-1770393391946-7d9b658deec3",
  "photo-1775196610640-5e70ef38f846", "photo-1780585328302-747a6eee7694",
  "photo-1535473895227-bdecb20fb157",
]);

const FILES = ["app/page.tsx", "components/home-parts.tsx", "components/buyer-path.tsx"];

/*
 * The runner compiles each test into a temporary directory, so a path
 * relative to this file points at nothing. These resolve from the working
 * directory, which is the repository root under `npm test`.
 */
function idsIn(file: string): string[] {
  const src = readFileSync(join(process.cwd(), file), "utf8");
  return src.match(/photo-[0-9a-f]+-[0-9a-f]+/g) ?? [];
}

test("every photograph on the home page was checked by hand", () => {
  for (const file of FILES) {
    for (const id of idsIn(file)) {
      assert.ok(
        VERIFIED.has(id),
        `${file} uses ${id}, which is not in the checked list. Load it in a browser first, then add it.`,
      );
    }
  }
});

test("no photograph is used more than five times", () => {
  const seen = new Map<string, number>();
  for (const file of FILES) {
    for (const id of idsIn(file)) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  for (const [id, n] of seen) {
    assert.ok(n <= 5, `${id} appears ${n} times; a face repeated that often stops reading as a market.`);
  }
});
