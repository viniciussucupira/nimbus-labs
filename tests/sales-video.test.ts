/**
 * Video blocks on a sales page (lib/sales-page.ts, added 7 October 2026): as
 * many as the page has blocks, each one of the three players and nothing
 * else, read back by the same rules as the hero's.
 */
import { pageProblem, parsePage } from "@/lib/sales-page";
import { done, is, part } from "./check";

part("Video blocks");
const sent = {
  blocks: [
    { id: "hero0001", kind: "hero", headline: "Bread", sub: "", media: "none", video: null },
    { id: "vid00001", kind: "video", heading: "Lesson one", video: { provider: "youtube", id: "dQw4w9WgXcQ", hash: "" }, caption: "The first ten minutes." },
    { id: "vid00002", kind: "video", heading: "", video: { provider: "loom", id: "a".repeat(32), hash: "" }, caption: "" },
  ],
};
const page = parsePage(sent);
is("several on one page, in their order", page.blocks.map((b) => b.kind), ["hero", "video", "video"]);
is("each kept as its player and id", page.blocks[1].kind === "video" ? page.blocks[1].video : null, { provider: "youtube", id: "dQw4w9WgXcQ", hash: "" });
is("a page of them is fine as sent", pageProblem(sent, page), null);
const bad = { blocks: [{ id: "vid00003", kind: "video", heading: "", video: { provider: "evil", id: "x", hash: "" }, caption: "" }] };
is("a video from anywhere else is refused, said as such", pageProblem(bad, parsePage(bad)), "video");
is("and never kept as one", parsePage(bad).blocks[0].kind === "video" ? (parsePage(bad).blocks[0] as { video: unknown }).video : "x", null);

done();
