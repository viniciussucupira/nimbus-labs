import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { linkExtras, linkMoment, linkShowing, linkWhen, parseStoreLinks, showingLinks, type StoreLink } from "@/lib/store-link";

const base: StoreLink = { id: "a1", title: "Watch", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", addedAt: "" };
const at = (iso: string) => Date.parse(iso);

describe("a store link's extras: spotlight, when it shows, played on the page", () => {
  it("keeps a moment only when it is one", () => {
    assert.equal(linkMoment("2026-10-12T15:00:00.000Z"), "2026-10-12T15:00:00.000Z");
    assert.equal(linkMoment("2026-10-12T15:00:00-03:00"), "2026-10-12T18:00:00.000Z");
    assert.equal(linkMoment("tomorrow"), "");
    assert.equal(linkMoment("1990-01-01T00:00:00Z"), "");
    assert.equal(linkMoment(5), "");
  });

  it("drops an end that comes before the start, so a link is never hidden for ever by mistake", () => {
    assert.deepEqual(linkExtras({ from: "2026-10-12T15:00:00Z", until: "2026-10-11T15:00:00Z" }, false), { from: "2026-10-12T15:00:00.000Z" });
    assert.deepEqual(
      linkExtras({ from: "2026-10-12T15:00:00Z", until: "2026-10-13T15:00:00Z" }, false),
      { from: "2026-10-12T15:00:00.000Z", until: "2026-10-13T15:00:00.000Z" },
    );
  });

  it("plays on the page only an address that is a video, and takes only true as yes", () => {
    assert.deepEqual(linkExtras({ play: true, spotlight: true }, true), { spotlight: true, play: true });
    assert.deepEqual(linkExtras({ play: true }, false), {});
    assert.deepEqual(linkExtras({ play: "yes", spotlight: 1 }, true), {});
  });

  it("shows a link only inside its window", () => {
    const link = { ...base, from: "2026-10-12T15:00:00.000Z", until: "2026-10-13T15:00:00.000Z" };
    assert.equal(linkShowing(link, at("2026-10-12T14:59:59Z")), false);
    assert.equal(linkShowing(link, at("2026-10-12T15:00:00Z")), true);
    assert.equal(linkShowing(link, at("2026-10-13T14:59:59Z")), true);
    assert.equal(linkShowing(link, at("2026-10-13T15:00:00Z")), false);
    assert.equal(linkShowing(base, at("2030-01-01T00:00:00Z")), true);
    assert.deepEqual([linkWhen(link, at("2026-10-01T00:00:00Z")), linkWhen(link, at("2026-10-12T20:00:00Z")), linkWhen(link, at("2026-10-20T00:00:00Z"))], ["soon", "live", "ended"]);
    assert.deepEqual(showingLinks([base, link], at("2026-10-01T00:00:00Z")).map((l) => l.id), ["a1"]);
  });

  it("reads kept links with their extras, and without them for links kept before", () => {
    const [video, page, old] = parseStoreLinks([
      { ...base, spotlight: true, play: true, from: "2026-10-12T15:00:00.000Z" },
      { id: "b2", title: "Blog", url: "https://example.com", addedAt: "", play: true },
      { id: "c3", title: "Old", url: "https://example.com/old", addedAt: "" },
    ]);
    assert.deepEqual([video.spotlight, video.play, video.from], [true, true, "2026-10-12T15:00:00.000Z"]);
    assert.equal(page.play, undefined);
    assert.deepEqual(Object.keys(old).sort(), ["addedAt", "id", "title", "url"]);
  });
});
