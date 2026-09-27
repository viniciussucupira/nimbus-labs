/**
 * A product's page, built from blocks: a sales page for something paid, or a
 * landing page that asks for an email address for something free.
 *
 * Every product already had a page of its own, with the long description
 * under its picture (lib/product-about.ts). This is the same page, laid out
 * by the creator: a hero, paragraphs, a list of what the buyer gets, what is
 * inside, who made it, questions and answers, a note on refunds, buttons
 * that lead to the checkout, and the buyers' own reviews (lib/reviews.ts).
 * A product without blocks keeps the page it has always had.
 *
 * Three rules make it something a buyer can trust, and they are kept here so
 * the studio's preview and the page itself apply the same ones:
 *
 *   - Nothing a creator types is ever read as markup. Every block is plain
 *     text with a fixed shape; paragraphs, "- " lists and written-out https
 *     addresses are the only formatting there is, drawn by the page itself
 *     (the same reading as the long description). A script, a style or a
 *     hidden element cannot be put on a page from here.
 *   - A video is one of three players, recognised from its address and
 *     rebuilt from its id — YouTube (on its privacy-enhanced address, which
 *     sets no cookie until the video plays), Vimeo (with do-not-track) and
 *     Loom. No other address becomes a frame, and the page loads none of
 *     them until the visitor presses play.
 *   - The terms are never the blocks'. A button in a block only leads to the
 *     checkout the page already has, with the price, options and plan the
 *     store page shows; a block cannot state a price of its own.
 *
 * The blocks live in a record of their own (lib/sales-page-store.ts), not in
 * the store's, which every visitor to the store page reads whole. Pure, so
 * the studio can import it.
 */

/** The most blocks one page may have. */
export const MAX_BLOCKS = 30;
/** The most questions one block of questions may have. */
export const MAX_FAQ_ITEMS = 15;
export const MAX_BENEFITS = 12;
export const MAX_INSIDE_ITEMS = 20;

export const MAX_HEADLINE = 120;
export const MAX_SUBHEADLINE = 300;
export const MAX_HEADING = 100;
export const MAX_TEXT = 3_000;
export const MAX_ITEM = 200;
export const MAX_ITEM_DETAIL = 300;
export const MAX_BIO = 1_200;
export const MAX_QUESTION = 200;
export const MAX_ANSWER = 1_500;
export const MAX_GUARANTEE = 1_000;
export const MAX_CTA_LABEL = 40;
export const MAX_CTA_NOTE = 120;
export const MAX_SEO_TITLE = 70;
export const MAX_SEO_DESCRIPTION = 160;
/** The most a page's record may weigh, in bytes: well past thirty full blocks. */
export const MAX_PAGE_BYTES = 120_000;

export type BlockKind = "hero" | "text" | "benefits" | "inside" | "bio" | "faq" | "guarantee" | "cta" | "reviews";

export const BLOCK_KINDS: { kind: BlockKind; label: string; hint: string }[] = [
  { kind: "hero", label: "Hero", hint: "The big headline at the top, with the product's picture or a video." },
  { kind: "text", label: "Text", hint: "A heading and paragraphs. A line starting with “- ” is a point in a list." },
  { kind: "benefits", label: "Benefits", hint: `Up to ${MAX_BENEFITS} short points, each with a tick.` },
  { kind: "inside", label: "What's inside", hint: `Up to ${MAX_INSIDE_ITEMS} parts, numbered, each with a line about it.` },
  { kind: "bio", label: "About you", hint: "Who made this, with your store photo." },
  { kind: "faq", label: "Questions", hint: `Up to ${MAX_FAQ_ITEMS} questions and answers that open and close.` },
  { kind: "guarantee", label: "Guarantee", hint: "Your refund promise, in your own words." },
  { kind: "cta", label: "Button", hint: "A button that goes to the checkout (or the sign-up form)." },
  { kind: "reviews", label: "Reviews", hint: "Where buyers' verified reviews sit on the page." },
];

export type VideoProvider = "youtube" | "vimeo" | "loom";

/** A video, kept as its player and id only, never as the address typed. */
export type Video = { provider: VideoProvider; id: string; hash: string };

export type HeroBlock = {
  id: string;
  kind: "hero";
  headline: string;
  sub: string;
  /** What sits beside the words: the product's picture, a video, or nothing. */
  media: "picture" | "video" | "none";
  video: Video | null;
};
export type TextBlock = { id: string; kind: "text"; heading: string; body: string };
export type BenefitsBlock = { id: string; kind: "benefits"; heading: string; items: string[] };
export type InsideItem = { title: string; detail: string };
export type InsideBlock = { id: string; kind: "inside"; heading: string; items: InsideItem[] };
export type BioBlock = { id: string; kind: "bio"; heading: string; body: string; photo: boolean };
export type FaqItem = { q: string; a: string };
export type FaqBlock = { id: string; kind: "faq"; heading: string; items: FaqItem[] };
export type GuaranteeBlock = { id: string; kind: "guarantee"; heading: string; body: string };
export type CtaBlock = { id: string; kind: "cta"; label: string; note: string };
export type ReviewsBlock = { id: string; kind: "reviews"; heading: string };

export type PageBlock =
  | HeroBlock
  | TextBlock
  | BenefitsBlock
  | InsideBlock
  | BioBlock
  | FaqBlock
  | GuaranteeBlock
  | CtaBlock
  | ReviewsBlock;

export type SalesPage = {
  blocks: PageBlock[];
  /** The title a search engine and a shared link show; empty is "<product> — <store>". */
  seoTitle: string;
  /** The line under it; empty is the product's summary or the start of its description. */
  seoDescription: string;
  /**
   * For a free product: a paid product of the same store shown to whoever
   * has just asked for the free one, with a link to its own page. Null is
   * none. Nothing is charged or added for them; it is a link.
   */
  next: string | null;
};

export const EMPTY_PAGE: SalesPage = { blocks: [], seoTitle: "", seoDescription: "", next: null };

export const BLOCK_ID_PATTERN = /^[a-z0-9]{4,12}$/;
const PRODUCT_ID_PATTERN = /^[a-z0-9]{6,40}$/;

/** One line: control characters and runs of space made one space. */
function line(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Several lines, as a message box writes them: line endings made one kind,
 * control characters other than the line break dropped, space at line ends
 * trimmed, no more than one blank line in a row.
 */
function lines(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, " ")
    .split("\n")
    .map((row) => row.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** A fresh block id: eight lower-case letters and digits. */
export function newBlockId(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += letters[byte % letters.length];
  return out;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;
const LOOM_ID = /^[0-9a-f]{32}$/;

/**
 * Reads a video address the way people copy it — the address bar, the share
 * button, an embed code's src — and keeps only which player and which video.
 * Anything that is not one of the three players, over https or http, is not
 * a video here, and comes back null.
 */
export function readVideo(raw: string): Video | null {
  const text = raw.trim().slice(0, 500);
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const id =
      parts[0] === "watch" || parts.length === 0
        ? url.searchParams.get("v") ?? ""
        : ["embed", "shorts", "live", "v"].includes(parts[0])
          ? parts[1] ?? ""
          : "";
    return YOUTUBE_ID.test(id) ? { provider: "youtube", id, hash: "" } : null;
  }
  if (host === "youtu.be") {
    const id = parts[0] ?? "";
    return YOUTUBE_ID.test(id) ? { provider: "youtube", id, hash: "" } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (an unlisted
    // video's key), player.vimeo.com/video/123456789?h=abcdef1234.
    const at = host === "player.vimeo.com" ? (parts[0] === "video" ? 1 : -1) : parts.findIndex((p) => VIMEO_ID.test(p));
    const id = at >= 0 ? parts[at] ?? "" : "";
    if (!VIMEO_ID.test(id)) return null;
    const after = parts[at + 1] ?? "";
    const given = url.searchParams.get("h") ?? (VIMEO_HASH.test(after) ? after : "");
    return { provider: "vimeo", id, hash: VIMEO_HASH.test(given) ? given : "" };
  }
  if (host === "loom.com") {
    const id = (parts[0] === "share" || parts[0] === "embed") ? parts[1] ?? "" : "";
    return LOOM_ID.test(id) ? { provider: "loom", id, hash: "" } : null;
  }
  return null;
}

/** The only frame addresses a page ever gets, one per player, built from the id alone. */
export function embedUrl(video: Video): string {
  if (video.provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`;
  }
  if (video.provider === "vimeo") {
    return `https://player.vimeo.com/video/${video.id}?dnt=1&autoplay=1${video.hash ? `&h=${video.hash}` : ""}`;
  }
  return `https://www.loom.com/embed/${video.id}?autoplay=1&hide_owner=true&hide_share=true&hide_title=true`;
}

/** The address a person would open the video at, for the studio's field. */
export function videoAddress(video: Video): string {
  if (video.provider === "youtube") return `https://www.youtube.com/watch?v=${video.id}`;
  if (video.provider === "vimeo") return `https://vimeo.com/${video.id}${video.hash ? `/${video.hash}` : ""}`;
  return `https://www.loom.com/share/${video.id}`;
}

export const PROVIDER_NAMES: Record<VideoProvider, string> = { youtube: "YouTube", vimeo: "Vimeo", loom: "Loom" };

/** The frame origins the page policy lets in (lib/csp.ts), and nothing else. */
export const VIDEO_FRAME_ORIGINS = ["https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://www.loom.com"];

function parseVideo(raw: unknown): Video | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : "";
  const hash = typeof value.hash === "string" && VIMEO_HASH.test(value.hash) ? value.hash : "";
  if (value.provider === "youtube" && YOUTUBE_ID.test(id)) return { provider: "youtube", id, hash: "" };
  if (value.provider === "vimeo" && VIMEO_ID.test(id)) return { provider: "vimeo", id, hash };
  if (value.provider === "loom" && LOOM_ID.test(id)) return { provider: "loom", id, hash: "" };
  return null;
}

/** One block, made safe to use; null when it cannot be one. */
function parseBlock(raw: unknown): PageBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" && BLOCK_ID_PATTERN.test(value.id) ? value.id : "";
  if (!id) return null;
  const heading = line(value.heading, MAX_HEADING);
  switch (value.kind) {
    case "hero": {
      const video = parseVideo(value.video);
      const media = value.media === "video" && video ? "video" : value.media === "none" ? "none" : "picture";
      return { id, kind: "hero", headline: line(value.headline, MAX_HEADLINE), sub: lines(value.sub, MAX_SUBHEADLINE), media, video };
    }
    case "text":
      return { id, kind: "text", heading, body: lines(value.body, MAX_TEXT) };
    case "benefits": {
      const items = Array.isArray(value.items) ? value.items.map((item) => line(item, MAX_ITEM)).filter(Boolean).slice(0, MAX_BENEFITS) : [];
      return { id, kind: "benefits", heading, items };
    }
    case "inside": {
      const items = Array.isArray(value.items)
        ? value.items
            .map((item) => {
              const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
              return { title: line(row.title, MAX_ITEM), detail: lines(row.detail, MAX_ITEM_DETAIL) };
            })
            .filter((item) => item.title)
            .slice(0, MAX_INSIDE_ITEMS)
        : [];
      return { id, kind: "inside", heading, items };
    }
    case "bio":
      return { id, kind: "bio", heading, body: lines(value.body, MAX_BIO), photo: value.photo !== false };
    case "faq": {
      const items = Array.isArray(value.items)
        ? value.items
            .map((item) => {
              const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
              return { q: line(row.q, MAX_QUESTION), a: lines(row.a, MAX_ANSWER) };
            })
            .filter((item) => item.q && item.a)
            .slice(0, MAX_FAQ_ITEMS)
        : [];
      return { id, kind: "faq", heading, items };
    }
    case "guarantee":
      return { id, kind: "guarantee", heading, body: lines(value.body, MAX_GUARANTEE) };
    case "cta":
      return { id, kind: "cta", label: line(value.label, MAX_CTA_LABEL), note: line(value.note, MAX_CTA_NOTE) };
    case "reviews":
      return { id, kind: "reviews", heading };
    default:
      return null;
  }
}

/**
 * Whatever came back from storage or from the studio, made safe to use: at
 * most thirty known blocks with unique ids, one hero at most and only at the
 * top (it carries the page's one main heading), one place for the reviews,
 * and the product to show after a sign-up only when it looks like an id.
 */
export function parsePage(raw: unknown): SalesPage {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PAGE, blocks: [] };
  const value = raw as Record<string, unknown>;
  const blocks: PageBlock[] = [];
  const seen = new Set<string>();
  let reviews = false;
  if (Array.isArray(value.blocks)) {
    for (const entry of value.blocks.slice(0, MAX_BLOCKS * 2)) {
      const block = parseBlock(entry);
      if (!block || seen.has(block.id)) continue;
      if (block.kind === "hero" && blocks.length > 0) continue;
      if (block.kind === "reviews") {
        if (reviews) continue;
        reviews = true;
      }
      seen.add(block.id);
      blocks.push(block);
      if (blocks.length >= MAX_BLOCKS) break;
    }
  }
  return {
    blocks,
    seoTitle: line(value.seoTitle, MAX_SEO_TITLE),
    seoDescription: line(value.seoDescription, MAX_SEO_DESCRIPTION),
    next: typeof value.next === "string" && PRODUCT_ID_PATTERN.test(value.next) ? value.next : null,
  };
}

/** What is wrong with a page the studio sent, in a word the studio can explain; null when nothing. */
export type PageProblem = "too_many" | "hero_first" | "two_reviews" | "video" | "shape" | "too_big" | null;

/**
 * The same rules as parsePage, told back rather than quietly applied, so a
 * creator is never shown "saved" for a page that was saved differently.
 */
export function pageProblem(raw: { blocks?: unknown }, parsed: SalesPage): PageProblem {
  const sent = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (sent.length > MAX_BLOCKS) return "too_many";
  const kinds = sent.map((b) => (b && typeof b === "object" ? (b as { kind?: unknown }).kind : null));
  if (kinds.slice(1).includes("hero")) return "hero_first";
  if (kinds.filter((k) => k === "reviews").length > 1) return "two_reviews";
  for (const block of sent) {
    const value = block && typeof block === "object" ? (block as Record<string, unknown>) : {};
    if (value.kind === "hero" && value.media === "video" && !parseVideo(value.video)) return "video";
  }
  if (parsed.blocks.length !== sent.length) return "shape";
  if (JSON.stringify(parsed).length > MAX_PAGE_BYTES) return "too_big";
  return null;
}

/** A block with nothing in it yet, of the kind asked for. */
export function emptyBlock(kind: BlockKind, id = newBlockId()): PageBlock {
  switch (kind) {
    case "hero":
      return { id, kind, headline: "", sub: "", media: "picture", video: null };
    case "text":
      return { id, kind, heading: "", body: "" };
    case "benefits":
      return { id, kind, heading: "What you get", items: [] };
    case "inside":
      return { id, kind, heading: "What's inside", items: [] };
    case "bio":
      return { id, kind, heading: "", body: "", photo: true };
    case "faq":
      return { id, kind, heading: "Questions", items: [] };
    case "guarantee":
      return { id, kind, heading: "Guarantee", body: "" };
    case "cta":
      return { id, kind, label: "", note: "" };
    case "reviews":
      return { id, kind, heading: "Reviews" };
  }
}
