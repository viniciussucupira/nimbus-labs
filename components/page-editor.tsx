"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import { shrink } from "@/components/product-image-editor";
import { IMAGE_ACCEPT, MAX_ALT_LENGTH, MAX_SOURCE_BYTES, imagePath, imageUrl } from "@/lib/product-image";
import { Icon, type IconName } from "@/components/icons";
import { toast } from "@/components/toast";
import { AiAssist } from "@/components/ai-assist";
import { PageCoach } from "@/components/page-coach";
import { BlockRewrite } from "@/components/block-rewrite";
import { MIN_VIEWS, type Counts, rate, winner } from "@/lib/headline-test-rules";
import { type BlockContext, BlockView, HeroView } from "@/components/sales-blocks";
import { RatingLine, ReviewsSection } from "@/components/review-list";
import { type StoreLook, lookStyle } from "@/lib/store-look";
import type { Review, Summary } from "@/lib/review-summary";
import {
  blocksFromDraft,
  type DraftCopy,
  BLOCK_KINDS,
  type BlockKind,
  MAX_ANSWER,
  MAX_BENEFITS,
  MAX_BIO,
  MAX_BLOCKS,
  MAX_CTA_LABEL,
  MAX_CTA_NOTE,
  MAX_FAQ_ITEMS,
  MAX_GUARANTEE,
  MAX_HEADING,
  MAX_HEADLINE,
  MAX_INSIDE_ITEMS,
  MAX_ITEM,
  MAX_ITEM_DETAIL,
  MAX_QUESTION,
  MAX_SEO_DESCRIPTION,
  MAX_SEO_TITLE,
  MAX_SUBHEADLINE,
  MAX_TEXT,
  MAX_CAPTION,
  MAX_COUNTDOWN_LABEL,
  MAX_COUNTDOWN_NOTE,
  MAX_PAGE_PICTURES,
  MAX_PICTURES,
  MAX_PICTURE_CAPTION,
  MAX_FIT_ITEMS,
  MAX_STEPS,
  MAX_BONUSES,
  MAX_COMPARE_ROWS,
  MAX_COLUMN,
  MAX_CELL,
  CELL_YES,
  CELL_NO,
  FACT_KEYS,
  type CompareRow,
  type FactKey,
  PAGE_TEMPLATES,
  PROVIDER_NAMES,
  type PageBlock,
  type Picture,
  type SalesPage,
  blocksFromTemplate,
  emptyBlock,
  newBlockId,
  readVideo,
  videoAddress,
} from "@/lib/sales-page";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";
import type { PageFacts } from "@/lib/page-facts";
import { blockWords } from "@/lib/buyer-words/blocks";
import type { LanguageCode } from "@/lib/store-language";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  too_many: `A page can have up to ${MAX_BLOCKS} blocks.`,
  hero_first: "The hero can only be the first block: it carries the page's main headline.",
  two_reviews: "Reviews can sit in one place on the page. Remove the second block of them.",
  video: "That video address is not one we can play. Paste a YouTube, Vimeo or Loom link.",
  pictures: `A picture on the page could not be kept. A page holds up to ${MAX_PAGE_PICTURES} pictures, each shown once: remove the one that was added twice, or add it again.`,
  countdown: "Give the countdown the moment it runs to, no more than a year away, or remove the block.",
  shape: "Something in the page could not be read. Reload the studio and try again.",
  too_big: "The page is too long to save. Shorten some of the text.",
  next: "After a sign-up, only another product that costs money can be shown.",
  unknown: "That product is no longer in your store. Reload the page.",
  store_full: "Your store is full. Remove something before adding more.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

const KIND_ICONS: Record<BlockKind, IconName> = {
  hero: "sparkle",
  text: "type",
  benefits: "check-circle",
  inside: "list",
  bio: "user",
  faq: "chat",
  guarantee: "shield",
  cta: "arrow-right",
  reviews: "star",
  video: "play",
  pictures: "camera",
  countdown: "clock",
  fit: "target",
  steps: "ladder",
  compare: "scale",
  bonuses: "gift",
  facts: "chart",
};

/** A moment in seconds as the date-and-time field holds it, in the creator's own time zone. */
function toLocalField(seconds: number): string {
  if (!seconds) return "";
  const d = new Date(seconds * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** And back: what the field holds, as a moment in seconds; 0 when it holds nothing readable. */
function fromLocalField(value: string): number {
  const at = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(at) ? Math.floor(at / 1000) : 0;
}

/** Below this many visitors a share would say more about chance than about the page. */
const MIN_DEPTH_VISITORS = 30;

const kindLabel = (kind: BlockKind) => BLOCK_KINDS.find((k) => k.kind === kind)?.label ?? kind;

export type EditorProduct = {
  id: string;
  title: string;
  summary: string;
  free: boolean;
  pill: string;
  picture: { src: string; alt: string; width: number; height: number } | null;
  /** What a button says when its label is left empty, and where it leads, in words. */
  defaultLabel: string;
  leadsTo: string;
};

/** A block as the editor holds it: a hero keeps the video address as typed, too. */
type Draft = { block: PageBlock; video: string };

function toDrafts(page: SalesPage): Draft[] {
  return page.blocks.map((block) => ({
    block,
    video: (block.kind === "hero" || block.kind === "video") && block.video ? videoAddress(block.video) : "",
  }));
}

function counter(value: string, max: number) {
  return <span className="text-xs tabular-nums text-ink-mute">{`${value.length}/${max}`}</span>;
}

/**
 * The studio's page builder for one product: blocks to add, fill in, move
 * and remove, and a preview drawn by the same components as the live page,
 * in the store's own look. Saved as a whole, the way the funnel editor is.
 */
export function PageEditor({
  product,
  initial,
  about,
  look,
  storeName,
  photo,
  pageHref,
  nextOptions,
  summary,
  reviews = [],
  folder,
  lang = "en",
  facts = {},
  traffic = null,
}: {
  product: EditorProduct;
  /** The store's own picture folder (lib/product-image.ts), where a page's pictures go. */
  folder: string;
  initial: SalesPage;
  /** The long description, to start a page from. */
  about: string;
  look: StoreLook;
  storeName: string;
  photo: string | null;
  pageHref: string;
  /** For something free: the paid products that can be shown after a sign-up. */
  nextOptions: { id: string; title: string }[];
  summary: Summary | null;
  /** The newest reviews on the page, so the preview shows real ones. */
  reviews?: Review[];
  /** The store's language, so the preview speaks it as the page does. */
  lang?: LanguageCode;
  /** The numbers the store has counted for this product (lib/page-facts.ts). */
  facts?: PageFacts;
  /** Its page's last 30 days: times it was opened, checkouts started. */
  traffic?: { views: number; checkouts: number } | null;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(initial));
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [next, setNext] = useState(initial.next ?? "");
  // How far down the saved page visitors read (lib/page-depth.ts), shown on each block.
  const [reach, setReach] = useState<{ shares: Record<string, number>; visitors: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/store/depth?id=${encodeURIComponent(product.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; shares?: Record<string, number>; visitors?: number }) => {
        if (live && data.ok && data.shares) setReach({ shares: data.shares, visitors: data.visitors ?? 0 });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [product.id]);
  // A second headline, tested against the hero's (lib/headline-test.ts).
  const [testing, setTesting] = useState(initial.test !== null);
  const [testHeadline, setTestHeadline] = useState(initial.test?.headline ?? "");
  const [testSub, setTestSub] = useState(initial.test?.sub ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"build" | "preview">("build");
  const [wide, setWide] = useState(false);
  const [adding, setAdding] = useState<BlockKind>("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Which template the empty page would start from, and the block being dragged.
  const templates = PAGE_TEMPLATES.filter((t) => t.free === product.free);
  const [template, setTemplate] = useState(templates[0]?.id ?? "");
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  // The time, for saying a countdown's moment has passed; read off the clock every half minute, never while drawing.
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const read = () => setClock(Date.now());
    const first = window.setTimeout(read, 0);
    const timer = window.setInterval(read, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const saved = JSON.stringify({ d: toDrafts(initial), t: initial.seoTitle, s: initial.seoDescription, n: initial.next ?? "", ab: initial.test ? [initial.test.headline, initial.test.sub] : null });
  const dirty = JSON.stringify({ d: drafts, t: seoTitle, s: seoDescription, n: next, ab: testing ? [testHeadline.trim(), testSub.trim()] : null }) !== saved;
  const hasHero = drafts[0]?.block.kind === "hero";
  const hasReviews = drafts.some((d) => d.block.kind === "reviews");
  const addable = BLOCK_KINDS.filter((k) => (k.kind === "hero" ? !hasHero : k.kind === "reviews" ? !hasReviews : true));
  const chosen = addable.some((k) => k.kind === adding) ? adding : addable[0]?.kind ?? "text";

  function change(index: number, patch: Partial<PageBlock>) {
    setDrafts((all) => all.map((d, i) => (i === index ? { ...d, block: { ...d.block, ...patch } as PageBlock } : d)));
  }

  function setVideo(index: number, typed: string) {
    const video = readVideo(typed);
    setDrafts((all) =>
      all.map((d, i) => (i === index && (d.block.kind === "hero" || d.block.kind === "video") ? { video: typed, block: { ...d.block, video } } : d)),
    );
  }

  function add(kind: BlockKind) {
    if (drafts.length >= MAX_BLOCKS) return;
    const block = emptyBlock(kind, newBlockId());
    const draft: Draft = { block, video: "" };
    setDrafts((all) => (kind === "hero" ? [draft, ...all] : [...all, draft]));
    setOpen(block.id);
  }

  function move(index: number, by: -1 | 1) {
    setDrafts((all) => {
      const to = index + by;
      if (to < 0 || to >= all.length) return all;
      if (all[index].block.kind === "hero" || all[to].block.kind === "hero") return all;
      const copy = [...all];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    });
  }

  /** Dropping one block on another puts it in that place; the hero stays on top. */
  function moveTo(from: number, to: number) {
    setDrafts((all) => {
      if (from === to || from < 0 || to < 0 || from >= all.length || to >= all.length) return all;
      if (all[from].block.kind === "hero" || all[to].block.kind === "hero") return all;
      const copy = [...all];
      const [taken] = copy.splice(from, 1);
      copy.splice(to, 0, taken);
      return copy;
    });
  }

  /** Puts a block where it reads best: after the first of `after` found on the page, or right under the hero. */
  function insertNear(block: PageBlock, after: BlockKind[]) {
    setDrafts((all) => {
      if (all.length >= MAX_BLOCKS) return all;
      const at = all.findIndex((d) => after.includes(d.block.kind));
      const place = at >= 0 ? at + 1 : all[0]?.block.kind === "hero" ? 1 : 0;
      const copy = [...all];
      copy.splice(place, 0, { block, video: "" });
      return copy;
    });
    setOpen(block.id);
  }

  /** The coach's headline, in the hero: the one there, or a new hero when the page has none. */
  function putHeadline(headline: string, sub: string) {
    setDrafts((all) => {
      if (all[0]?.block.kind === "hero") {
        return all.map((d, i) => (i === 0 ? { ...d, block: { ...d.block, headline: headline.slice(0, MAX_HEADLINE), sub: sub.slice(0, MAX_SUBHEADLINE) } as PageBlock } : d));
      }
      const hero = { ...(emptyBlock("hero") as Extract<PageBlock, { kind: "hero" }>), headline: headline.slice(0, MAX_HEADLINE), sub: sub.slice(0, MAX_SUBHEADLINE), media: product.picture ? ("picture" as const) : ("none" as const) };
      return [{ block: hero, video: "" }, ...all];
    });
  }

  /** The coach's questions, added to the page's questions, or as a block of their own before the last button. */
  function addQuestions(items: { q: string; a: string }[]) {
    setDrafts((all) => {
      const at = all.findIndex((d) => d.block.kind === "faq");
      if (at >= 0) {
        return all.map((d, i) => {
          if (i !== at || d.block.kind !== "faq") return d;
          const known = new Set(d.block.items.map((item) => item.q.trim().toLowerCase()));
          const added = items.filter((item) => !known.has(item.q.trim().toLowerCase()));
          return { ...d, block: { ...d.block, items: [...d.block.items, ...added].slice(0, MAX_FAQ_ITEMS) } };
        });
      }
      if (all.length >= MAX_BLOCKS) return all;
      const faq: PageBlock = { ...(emptyBlock("faq") as Extract<PageBlock, { kind: "faq" }>), items: items.slice(0, MAX_FAQ_ITEMS) };
      const lastCta = all.map((d) => d.block.kind).lastIndexOf("cta");
      const copy = [...all];
      copy.splice(lastCta > 0 ? lastCta : copy.length, 0, { block: faq, video: "" });
      return copy;
    });
  }

  function remove(index: number) {
    setDrafts((all) => all.filter((_, i) => i !== index));
  }

  /** A first page from a template: its order of blocks, with the product's own title and summary on top. */
  function startFromTemplate() {
    const blocks = blocksFromTemplate(template, { title: product.title, summary: product.summary, picture: Boolean(product.picture) });
    if (blocks.length === 0) return;
    setDrafts(blocks.map((block) => ({ block, video: "" })));
    setOpen(blocks[1]?.id ?? blocks[0].id);
  }

  /** A first page from what the product already says: hero, description, button, reviews. */
  function startFromDescription() {
    const blocks: PageBlock[] = [
      { ...(emptyBlock("hero") as Extract<PageBlock, { kind: "hero" }>), headline: product.title, sub: product.summary, media: product.picture ? "picture" : "none" },
    ];
    if (about) blocks.push({ ...(emptyBlock("text") as Extract<PageBlock, { kind: "text" }>), heading: `About ${product.title}`, body: about });
    blocks.push(emptyBlock("cta"));
    blocks.push(emptyBlock("reviews"));
    setDrafts(blocks.map((block) => ({ block, video: "" })));
    setOpen(blocks[0].id);
  }

  function pageToSend(): SalesPage {
    return {
      blocks: drafts.map((d) => d.block),
      seoTitle: seoTitle.trim(),
      seoDescription: seoDescription.trim(),
      next: product.free && next ? next : null,
      // The id is the server's to give (lib/sales-page.ts, parseTest).
      test: testing && testHeadline.trim() ? { id: "", headline: testHeadline.trim(), sub: testSub.trim() } : null,
    };
  }

  async function send(page: SalesPage | null, confirmation: string) {
    setBusy(true);
    setError(null);
    const badVideo = page?.blocks.find((b) => (b.kind === "hero" && b.media === "video" && !b.video) || (b.kind === "video" && !b.video));
    if (badVideo) {
      setError(MESSAGES.video);
      setBusy(false);
      setOpen(badVideo.id);
      return;
    }
    const badCountdown = page?.blocks.find((b) => b.kind === "countdown" && !b.until);
    if (badCountdown) {
      setError(MESSAGES.countdown);
      setBusy(false);
      setOpen(badCountdown.id);
      return;
    }
    try {
      const response = await fetch("/api/store/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, page }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        toast(confirmation);
        setConfirmClear(false);
        router.refresh();
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  const ctx: BlockContext = {
    storeName,
    productTitle: product.title,
    picture: product.picture,
    photo,
    action: { kind: "link", href: "#" },
    defaultLabel: product.defaultLabel,
    preview: true,
    lang,
    facts,
  };
  const preview = useMemo(() => {
    const blocks = drafts.map((d) => d.block);
    const hero = blocks[0]?.kind === "hero" ? blocks[0] : null;
    const rest = hero ? blocks.slice(1) : blocks;
    return { hero, rest, placed: blocks.some((b) => b.kind === "reviews") };
  }, [drafts]);
  const pill = <p className="st-price text-sm">{product.pill}</p>;
  const rating = summary ? <RatingLine summary={summary} /> : null;
  const reviewsPart = (heading: string) =>
    summary ? (
      <ReviewsSection heading={heading} summary={summary} reviews={reviews} storeName={storeName} productTitle={product.title} moreHref={null} preview />
    ) : null;
  const buyPreview = (
    <section className="st-card sp-section p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="font-display text-xl font-semibold leading-snug sm:text-2xl">{product.free ? `Get ${product.title}` : product.title}</p>
        {pill}
      </div>
      <p className="st-muted mt-3 text-sm">
        {product.free
          ? "The sign-up form goes here: an email field, the box to hear from you, and the button. It works as it does on your store page."
          : "The buy box goes here, exactly as on your store page: price options, payment plan, the product offered alongside, and the checkout button."}
      </p>
      <span className="btn st-btn btn-block mt-4">
        {product.defaultLabel}
      </span>
    </section>
  );

  const field = (id: string, label: string, input: React.ReactNode, extra?: React.ReactNode) => (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {extra}
      </div>
      {input}
    </div>
  );

  function blockFields(draft: Draft, index: number) {
    const block = draft.block;
    const base = `blk-${block.id}`;
    switch (block.kind) {
      case "hero": {
        const recognised = readVideo(draft.video);
        return (
          <div className="space-y-4">
            {field(
              `${base}-h`,
              "Headline",
              <input id={`${base}-h`} className="field" maxLength={MAX_HEADLINE} value={block.headline} placeholder={product.title} onChange={(e) => change(index, { headline: e.target.value })} />,
              counter(block.headline, MAX_HEADLINE),
            )}
            {field(
              `${base}-s`,
              "Subheadline",
              <textarea id={`${base}-s`} className="field" rows={2} maxLength={MAX_SUBHEADLINE} value={block.sub} placeholder="Who it is for and what it changes, in a sentence." onChange={(e) => change(index, { sub: e.target.value })} />,
              counter(block.sub, MAX_SUBHEADLINE),
            )}
            <fieldset>
              <legend className="field-label">Beside the words</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {(["picture", "video", "none"] as const).map((media) => {
                  const off = media === "picture" && !product.picture;
                  return (
                    <label
                      key={media}
                      className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 transition-colors ${
                        block.media === media ? "bg-lilac text-violet-ink ring-violet-brand/40" : "bg-white text-ink-soft ring-line hover:text-ink"
                      } ${off ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`${base}-m`}
                        value={media}
                        checked={block.media === media}
                        disabled={off}
                        onChange={() => change(index, { media })}
                        className="h-4 w-4"
                      />
                      {media === "picture" ? "The product's picture" : media === "video" ? "A video" : "Nothing"}
                    </label>
                  );
                })}
              </div>
              {!product.picture ? <p className="mt-1 text-xs text-ink-soft">Give the product a picture in the studio and it can go here.</p> : null}
            </fieldset>
            {block.media === "video" ? (
              <div>
                {field(
                  `${base}-v`,
                  "Video address",
                  <input
                    id={`${base}-v`}
                    className="field"
                    inputMode="url"
                    value={draft.video}
                    placeholder="https://www.youtube.com/watch?v=…"
                    aria-describedby={`${base}-vh`}
                    onChange={(e) => setVideo(index, e.target.value)}
                  />,
                )}
                <p id={`${base}-vh`} className={`mt-1 text-xs ${draft.video && !recognised ? "font-semibold text-danger" : "text-ink-soft"}`}>
                  {recognised
                    ? `${PROVIDER_NAMES[recognised.provider]} video recognized. It loads only when a visitor presses play (YouTube's privacy-enhanced player, Vimeo with do-not-track).`
                    : draft.video
                      ? "Not a video we can play. Paste a link from YouTube, Vimeo or Loom."
                      : "A link from YouTube, Vimeo or Loom. Nothing else can be played on the page."}
                </p>
              </div>
            ) : null}
            {/*
              A second headline, tested against this one (lib/headline-test.ts).
              Only words: the price and what is sold are the same for everyone.
            */}
            <div className="rounded-2xl bg-paper p-4 ring-1 ring-line">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold text-ink">
                <input type="checkbox" checked={testing} onChange={(e) => setTesting(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-violet-brand" />
                <span>
                  Test a second headline
                  <span className="block font-normal text-ink-soft">
                    {`Half your visitors see this one, half see the second. Once each has been seen ${MIN_VIEWS} times and one brings clearly more people to the checkout, your page shows that one to everybody by itself. Only the words change: never the price.`}
                  </span>
                </span>
              </label>
              {testing ? (
                <div className="mt-3 space-y-3">
                  {field(
                    `${base}-th`,
                    "Second headline",
                    <input id={`${base}-th`} className="field" maxLength={MAX_HEADLINE} value={testHeadline} placeholder="Another way to say what they get" onChange={(e) => setTestHeadline(e.target.value)} />,
                    counter(testHeadline, MAX_HEADLINE),
                  )}
                  {field(
                    `${base}-ts`,
                    "Its line under it (optional)",
                    <textarea id={`${base}-ts`} className="field" rows={2} maxLength={MAX_SUBHEADLINE} value={testSub} onChange={(e) => setTestSub(e.target.value)} />,
                  )}
                  <TestResults productId={product.id} running={initial.test !== null} />
                </div>
              ) : null}
            </div>
          </div>
        );
      }
      case "text":
      case "guarantee": {
        const max = block.kind === "text" ? MAX_TEXT : MAX_GUARANTEE;
        return (
          <div className="space-y-4">
            {field(
              `${base}-h`,
              "Heading",
              <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder={block.kind === "guarantee" ? "Guarantee" : "Optional"} onChange={(e) => change(index, { heading: e.target.value })} />,
            )}
            {field(
              `${base}-b`,
              block.kind === "guarantee" ? "Your refund promise" : "Text",
              <textarea
                id={`${base}-b`}
                className="field"
                rows={block.kind === "text" ? 7 : 4}
                maxLength={max}
                value={block.body}
                placeholder={block.kind === "guarantee" ? "For example: if it is not for you, email me within 14 days and I refund you in full." : "A blank line starts a new paragraph. A line starting with “- ” is a point in a list."}
                onChange={(e) => change(index, { body: e.target.value })}
              />,
              counter(block.body, max),
            )}
            {block.kind === "guarantee" ? (
              <p className="text-xs text-ink-soft">Say only what you will do: buyers read this as a promise, and refunds are made by you, from your Stripe account.</p>
            ) : null}
          </div>
        );
      }
      case "benefits":
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} onChange={(e) => change(index, { heading: e.target.value })} />)}
            <ListEditor
              base={base}
              label="Point"
              items={block.items}
              max={MAX_BENEFITS}
              maxLength={MAX_ITEM}
              onChange={(items) => change(index, { items })}
            />
          </div>
        );
      case "inside":
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} onChange={(e) => change(index, { heading: e.target.value })} />)}
            <PairEditor
              base={base}
              first={{ label: "Part", max: MAX_ITEM }}
              second={{ label: "A line about it (optional)", max: MAX_ITEM_DETAIL }}
              items={block.items.map((item) => [item.title, item.detail] as [string, string])}
              max={MAX_INSIDE_ITEMS}
              onChange={(pairs) => change(index, { items: pairs.map(([title, detail]) => ({ title, detail })) })}
              addLabel="Add a part"
            />
          </div>
        );
      case "bio":
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder={`About ${storeName}`} onChange={(e) => change(index, { heading: e.target.value })} />)}
            {field(
              `${base}-b`,
              "About you",
              <textarea id={`${base}-b`} className="field" rows={5} maxLength={MAX_BIO} value={block.body} placeholder="Who you are, and why you made this." onChange={(e) => change(index, { body: e.target.value })} />,
              counter(block.body, MAX_BIO),
            )}
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
              <input type="checkbox" className="h-4 w-4" checked={block.photo} onChange={(e) => change(index, { photo: e.target.checked })} />
              Show your store photo
            </label>
          </div>
        );
      case "faq":
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} onChange={(e) => change(index, { heading: e.target.value })} />)}
            <PairEditor
              base={base}
              first={{ label: "Question", max: MAX_QUESTION }}
              second={{ label: "Answer", max: MAX_ANSWER, rows: 3 }}
              items={block.items.map((item) => [item.q, item.a] as [string, string])}
              max={MAX_FAQ_ITEMS}
              onChange={(pairs) => change(index, { items: pairs.map(([q, a]) => ({ q, a })) })}
              addLabel="Add a question"
              needsBoth
            />
          </div>
        );
      case "cta":
        return (
          <div className="space-y-4">
            {field(
              `${base}-l`,
              "Button label",
              <input id={`${base}-l`} className="field" maxLength={MAX_CTA_LABEL} value={block.label} placeholder={product.defaultLabel} onChange={(e) => change(index, { label: e.target.value })} />,
              counter(block.label, MAX_CTA_LABEL),
            )}
            {field(
              `${base}-n`,
              "A line under it (optional)",
              <input id={`${base}-n`} className="field" maxLength={MAX_CTA_NOTE} value={block.note} placeholder="For example: instant download, 40 pages as a PDF" onChange={(e) => change(index, { note: e.target.value })} />,
            )}
            <p className="text-xs text-ink-soft">{product.leadsTo}</p>
          </div>
        );
      case "video": {
        const recognised = readVideo(draft.video);
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading (optional)", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder="Watch the first lesson" onChange={(e) => change(index, { heading: e.target.value })} />)}
            <div>
              {field(
                `${base}-v`,
                "Video address",
                <input
                  id={`${base}-v`}
                  className="field"
                  inputMode="url"
                  value={draft.video}
                  placeholder="https://www.youtube.com/watch?v=…"
                  aria-describedby={`${base}-vh`}
                  onChange={(e) => setVideo(index, e.target.value)}
                />,
              )}
              <p id={`${base}-vh`} className={`mt-1 text-xs ${draft.video && !recognised ? "font-semibold text-danger" : "text-ink-soft"}`}>
                {recognised
                  ? `${PROVIDER_NAMES[recognised.provider]} video recognized. It loads only when a visitor presses play.`
                  : draft.video
                    ? "Not a video we can play. Paste a link from YouTube, Vimeo or Loom."
                    : "A link from YouTube, Vimeo or Loom. Add as many video blocks as the page needs."}
              </p>
            </div>
            {field(
              `${base}-c`,
              "A line under it (optional)",
              <textarea id={`${base}-c`} className="field" rows={2} maxLength={MAX_CAPTION} value={block.caption} placeholder="What the visitor is about to see." onChange={(e) => change(index, { caption: e.target.value })} />,
              counter(block.caption, MAX_CAPTION),
            )}
          </div>
        );
      }
      case "pictures": {
        const elsewhere = drafts.reduce((n, d, i) => (i !== index && d.block.kind === "pictures" ? n + d.block.items.length : n), 0);
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading (optional)", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder="A look inside" onChange={(e) => change(index, { heading: e.target.value })} />)}
            <PicturesEditor
              base={base}
              productId={product.id}
              folder={folder}
              items={block.items}
              room={Math.min(MAX_PICTURES, MAX_PAGE_PICTURES - elsewhere)}
              onChange={(items) => change(index, { items })}
            />
          </div>
        );
      }
      case "countdown": {
        const passed = clock > 0 && block.until > 0 && block.until * 1000 <= clock;
        return (
          <div className="space-y-4">
            {field(
              `${base}-u`,
              "Counts down to",
              <input id={`${base}-u`} type="datetime-local" className="field" value={toLocalField(block.until)} aria-describedby={`${base}-uh`} onChange={(e) => change(index, { until: fromLocalField(e.target.value) })} />,
            )}
            <p id={`${base}-uh`} className={`-mt-2 text-xs ${passed ? "font-semibold text-danger" : "text-ink-soft"}`}>
              {passed
                ? "That moment has passed, so the countdown is no longer shown on the page. Set a new one, or remove the block."
                : "One moment, typed in your own time zone and shown to each visitor in theirs. It is the same for everybody and never starts again for anyone; once it has passed, the block disappears by itself."}
            </p>
            {field(
              `${base}-h`,
              "Above the numbers",
              <input id={`${base}-h`} className="field" maxLength={MAX_COUNTDOWN_LABEL} value={block.heading} placeholder="The launch price ends in" onChange={(e) => change(index, { heading: e.target.value })} />,
              counter(block.heading, MAX_COUNTDOWN_LABEL),
            )}
            {field(
              `${base}-n`,
              "What changes then (optional)",
              <input id={`${base}-n`} className="field" maxLength={MAX_COUNTDOWN_NOTE} value={block.note} placeholder="After that, the price is $49." onChange={(e) => change(index, { note: e.target.value })} />,
              counter(block.note, MAX_COUNTDOWN_NOTE),
            )}
            <p className="text-xs text-ink-soft">Buyers read this as a promise. Count down only to a moment after which something really changes: a sale that ends, doors that close, a session that starts.</p>
          </div>
        );
      }
      case "fit": {
        const said = blockWords(lang);
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading (optional)", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder="Is it for you?" onChange={(e) => change(index, { heading: e.target.value })} />)}
            <div className="rounded-xl bg-paper p-3 ring-1 ring-line">
              {field(`${base}-yl`, "Above the first list", <input id={`${base}-yl`} className="field" maxLength={MAX_HEADING} value={block.yesLabel} placeholder={said.fitYes} onChange={(e) => change(index, { yesLabel: e.target.value })} />)}
              <div className="mt-3">
                <ListEditor base={`${base}-y`} label="Point" items={block.yes} max={MAX_FIT_ITEMS} maxLength={MAX_ITEM} onChange={(yes) => change(index, { yes })} />
              </div>
            </div>
            <div className="rounded-xl bg-paper p-3 ring-1 ring-line">
              {field(`${base}-nl`, "Above the second list", <input id={`${base}-nl`} className="field" maxLength={MAX_HEADING} value={block.noLabel} placeholder={said.fitNo} onChange={(e) => change(index, { noLabel: e.target.value })} />)}
              <div className="mt-3">
                <ListEditor base={`${base}-n`} label="Point" items={block.no} max={MAX_FIT_ITEMS} maxLength={MAX_ITEM} onChange={(no) => change(index, { no })} />
              </div>
            </div>
            <p className="text-xs text-ink-soft">
              Saying who should not buy is the most honest line on a page, and the one that sends back the fewest refunds: a visitor who sees themselves in the second list leaves before paying instead of after. Left empty, the two headings are written in your store&apos;s language.
            </p>
          </div>
        );
      }
      case "steps":
      case "bonuses":
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} onChange={(e) => change(index, { heading: e.target.value })} />)}
            <PairEditor
              base={base}
              first={{ label: block.kind === "steps" ? "Step" : "Bonus", max: MAX_ITEM }}
              second={{ label: "A line about it (optional)", max: MAX_ITEM_DETAIL }}
              items={block.items.map((item) => [item.title, item.detail] as [string, string])}
              max={block.kind === "steps" ? MAX_STEPS : MAX_BONUSES}
              onChange={(pairs) => change(index, { items: pairs.map(([title, detail]) => ({ title, detail })) })}
              addLabel={block.kind === "steps" ? "Add a step" : "Add a bonus"}
            />
            {block.kind === "bonuses" ? (
              <p className="text-xs text-ink-soft">
                Only what really comes with it. There is no place for a &ldquo;worth $497&rdquo; beside a bonus on purpose: a value nobody ever paid makes buyers doubt the rest of the page.
              </p>
            ) : (
              <p className="text-xs text-ink-soft">From the moment they pay to the result: what happens first, what they do next, what they end up with.</p>
            )}
          </div>
        );
      case "compare":
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading (optional)", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder="Why this, and not the usual way" onChange={(e) => change(index, { heading: e.target.value })} />)}
            <div className="grid gap-3 sm:grid-cols-2">
              {field(`${base}-ca`, "Your column", <input id={`${base}-ca`} className="field" maxLength={MAX_COLUMN} value={block.columnA} placeholder={product.title.slice(0, MAX_COLUMN)} onChange={(e) => change(index, { columnA: e.target.value })} />)}
              {field(`${base}-cb`, "The other column", <input id={`${base}-cb`} className="field" maxLength={MAX_COLUMN} value={block.columnB} placeholder="Figuring it out alone" onChange={(e) => change(index, { columnB: e.target.value })} />)}
            </div>
            <CompareEditor base={base} rows={block.rows} onChange={(rows) => change(index, { rows })} />
            <p className="text-xs text-ink-soft">
              Compare with a way of doing it, not with a named competitor, and write only what you could show to be true. A row with nothing in either column is left out when you save.
            </p>
          </div>
        );
      case "facts": {
        const chosen = new Set(block.show);
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading (optional)", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder="By the numbers" onChange={(e) => change(index, { heading: e.target.value })} />)}
            <fieldset>
              <legend className="field-label">Which numbers may appear</legend>
              <div className="mt-2 space-y-1">
                {FACT_KEYS.map((fact) => {
                  const now = facts[fact.key];
                  return (
                    <label key={fact.key} className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0"
                        checked={chosen.has(fact.key)}
                        onChange={(e) => {
                          const next = new Set(block.show);
                          if (e.target.checked) next.add(fact.key);
                          else next.delete(fact.key);
                          change(index, { show: FACT_KEYS.map((f) => f.key).filter((k): k is FactKey => next.has(k)) });
                        }}
                      />
                      <span>
                        <span className="block font-semibold text-ink">
                          {fact.label}
                          <span className="ml-2 font-normal text-ink-soft">{now ? `now: ${now.value} ${now.label}` : "not shown yet"}</span>
                        </span>
                        <span className="block text-xs text-ink-soft">{fact.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="text-xs text-ink-soft">
              Every number here is counted by your store and kept up to date by itself; none can be typed. One that is not there yet, such as a rating before the first review, simply does not appear.
            </p>
          </div>
        );
      }
      case "reviews":
        return (
          <div className="space-y-4">
            {field(`${base}-h`, "Heading", <input id={`${base}-h`} className="field" maxLength={MAX_HEADING} value={block.heading} placeholder="Reviews" onChange={(e) => change(index, { heading: e.target.value })} />)}
            <p className="text-xs text-ink-soft">
              Only buyers can write reviews, and they appear here as they come. Without this block they still appear, at the end of the page.
            </p>
          </div>
        );
    }
  }

  const summaryLine = (block: PageBlock) => {
    switch (block.kind) {
      case "hero":
        return block.headline || product.title;
      case "text":
      case "guarantee":
        return block.heading || block.body.slice(0, 60) || "Empty";
      case "benefits":
      case "inside":
      case "faq":
        return `${block.heading ? `${block.heading} · ` : ""}${block.items.length} ${block.items.length === 1 ? "item" : "items"}`;
      case "bio":
        return block.heading || `About ${storeName}`;
      case "cta":
        return block.label || product.defaultLabel;
      case "reviews":
        return block.heading || "Reviews";
      case "video":
        return block.heading || (block.video ? `${PROVIDER_NAMES[block.video.provider]} video` : "No video yet");
      case "pictures":
        return `${block.heading ? `${block.heading} · ` : ""}${block.items.length} ${block.items.length === 1 ? "picture" : "pictures"}`;
      case "countdown":
        return block.until
          ? `${block.heading ? `${block.heading} · ` : ""}${new Date(block.until * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
          : "No moment set yet";
      case "fit":
        return `${block.heading ? `${block.heading} · ` : ""}${block.yes.length} for, ${block.no.length} not for`;
      case "steps":
      case "bonuses":
        return `${block.heading ? `${block.heading} · ` : ""}${block.items.length} ${block.kind === "steps" ? (block.items.length === 1 ? "step" : "steps") : block.items.length === 1 ? "bonus" : "bonuses"}`;
      case "compare":
        return `${block.heading ? `${block.heading} · ` : ""}${block.rows.length} ${block.rows.length === 1 ? "row" : "rows"}`;
      case "facts": {
        const live = block.show.filter((key) => facts[key]).length;
        return `${block.heading ? `${block.heading} · ` : ""}${live} ${live === 1 ? "number" : "numbers"} shown now`;
      }
    }
  };

  const kind = product.free ? "Landing page" : "Sales page";

  return (
    <section aria-labelledby="page-title" className="card min-w-0 p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="page-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
            {`${kind} for ${product.title}`}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {initial.blocks.length
              ? `${initial.blocks.length} ${initial.blocks.length === 1 ? "block" : "blocks"} live on its page.`
              : "No blocks yet: the product's page shows its picture, description and buy box, as it always has."}
          </p>
        </div>
        <span className={`tag ${initial.blocks.length ? "tag-live" : ""}`}>{initial.blocks.length ? "Built" : "Plain"}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-paper p-1 ring-1 ring-line" role="group" aria-label="Build or preview">
          {(["build", "preview"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${view === v ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-ink-soft hover:text-ink"}`}
            >
              {v === "build" ? "Build" : "Preview"}
            </button>
          ))}
        </div>
        <a href={pageHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-violet-deep underline-offset-4 hover:underline">
          Open the live page
          <Icon name="external" size={15} />
        </a>
      </div>

      {view === "preview" ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Width:</span>
            {[false, true].map((w) => (
              <button
                key={String(w)}
                type="button"
                aria-pressed={wide === w}
                onClick={() => setWide(w)}
                className={`inline-flex min-h-11 items-center rounded-full px-3 font-semibold ring-1 ${wide === w ? "bg-lilac text-violet-ink ring-violet-brand/40" : "text-ink-soft ring-line"}`}
              >
                {w ? "Wide" : "Phone"}
              </button>
            ))}
            {dirty ? <span className="ml-auto text-xs font-semibold text-ink-soft">Showing unsaved changes</span> : null}
          </div>
          <div className="overflow-hidden rounded-2xl ring-1 ring-line">
            <div
              className={`st-page st-theme-${look.theme} mx-auto overflow-hidden`}
              style={{ ...(lookStyle(look) as React.CSSProperties), maxWidth: wide ? "100%" : 390 }}
            >
              <div className={`sp-body mx-auto ${wide ? "max-w-3xl" : ""} px-4 pb-12 pt-8`}>
                {drafts.length === 0 ? (
                  <p className="st-note text-sm">Add a block and it appears here, in your store&apos;s look.</p>
                ) : (
                  <>
                    {preview.hero ? (
                      <HeroView block={preview.hero} ctx={ctx} pill={pill} rating={rating} />
                    ) : (
                      <header>
                        <div className="flex flex-wrap items-center gap-2">
                          {pill}
                          {rating}
                        </div>
                        <p className="font-display mt-4 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.025em]">{product.title}</p>
                      </header>
                    )}
                    {product.free ? buyPreview : null}
                    {preview.rest.map((block) => (
                      <BlockView key={block.id} block={block} ctx={ctx} reviews={block.kind === "reviews" ? reviewsPart(block.heading) ?? <p className="st-note text-sm">Buyers&apos; reviews appear here once somebody who paid writes one.</p> : null} />
                    ))}
                    {product.free ? null : buyPreview}
                    {!preview.placed && summary ? <section className="sp-section">{reviewsPart("Reviews")}</section> : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {drafts.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-paper p-5 ring-1 ring-line sm:p-6">
              <p className="font-semibold text-ink">Start the page</p>
              <p className="mt-1 text-sm text-ink-soft">
                {`Begin from what ${product.title} already says — its title, summary and description, a button and a place for reviews — or add blocks one by one below.`}
              </p>
              <button type="button" onClick={startFromDescription} className="btn btn-primary mt-4">
                <Icon name="sparkle" size={17} />
                Start from the description
              </button>
              {templates.length > 0 ? (
                <div className="mt-6 border-t border-line pt-5">
                  <label htmlFor="page-template" className="field-label">
                    Or start from a template
                  </label>
                  <div className="mt-1 flex flex-wrap items-end gap-3">
                    <select id="page-template" className="field min-w-0 flex-1" value={template} onChange={(e) => setTemplate(e.target.value)}>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={startFromTemplate} className="btn btn-secondary">
                      Use this template
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    {`${templates.find((t) => t.id === template)?.hint ?? ""} A template is an order of blocks with their headings: the words are yours to write, and a block you leave empty is not shown.`}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {drafts.length > 0 ? (
            <PageCoach
              productId={product.id}
              productTitle={product.title}
              free={product.free}
              picture={Boolean(product.picture)}
              facts={facts}
              page={pageToSend()}
              reach={reach}
              onAdd={(kind) => (kind === "fit" || kind === "facts" || kind === "steps" ? insertNear(emptyBlock(kind), kind === "facts" ? ["hero"] : ["benefits", "inside"]) : add(kind))}
              onHeadline={putHeadline}
              onTest={(headline, sub) => {
                setTesting(true);
                setTestHeadline(headline.slice(0, MAX_HEADLINE));
                setTestSub(sub.slice(0, MAX_SUBHEADLINE));
              }}
              onFit={(yes, no) =>
                insertNear({ ...(emptyBlock("fit") as Extract<PageBlock, { kind: "fit" }>), yes: yes.slice(0, MAX_FIT_ITEMS), no: no.slice(0, MAX_FIT_ITEMS) }, ["benefits", "inside", "steps"])
              }
              onQuestions={addQuestions}
              traffic={traffic}
            />
          ) : null}

          {/*
            The whole page drafted at once (lib/ai.ts, writePage), from what the
            product already says and anything written in the box. It replaces
            the blocks in this editor only: nothing is saved until Save, and
            leaving without saving keeps the page as it was.
          */}
          <div className="mt-6">
            <AiAssist<DraftCopy>
              title="Write the whole page with AI"
              hint={`A full draft — headline, what the buyer gets, what is inside, questions and buttons — from ${product.title}'s name, price and description. Add anything else it should know below, or leave the box empty. It replaces the blocks here; nothing is saved until you press Save.`}
              placeholder="Who it is for, what makes it different, what buyers ask you most. Your refund promise, if you have one."
              allowEmpty
              payload={() => ({ kind: "page", product: product.id })}
              onResult={(draft) => {
                const page = blocksFromDraft(draft, Boolean(product.picture));
                setDrafts(toDrafts(page));
                if (page.seoTitle) setSeoTitle(page.seoTitle);
                if (page.seoDescription) setSeoDescription(page.seoDescription);
                setOpen(page.blocks[0]?.id ?? null);
              }}
              done="Drafted. Read each block, change what is not yours, then press Save."
            />
          </div>

          <ol className="mt-6 space-y-3">
            {drafts.map((draft, index) => {
              const block = draft.block;
              const isOpen = open === block.id;
              const locked = block.kind === "hero";
              return (
                <li
                  key={block.id}
                  className={`rounded-2xl border bg-white transition-shadow ${over === index && dragged !== null && dragged !== index && !locked ? "border-violet-brand ring-2 ring-violet-brand/30" : "border-line"} ${dragged === index ? "opacity-60" : ""}`}
                  onDragOver={(event) => {
                    if (dragged === null || locked) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (over !== index) setOver(index);
                  }}
                  onDrop={(event) => {
                    if (dragged === null || locked) return;
                    event.preventDefault();
                    moveTo(dragged, index);
                    setDragged(null);
                    setOver(null);
                  }}
                >
                  <div className="flex items-center gap-2 p-2 pl-3 sm:gap-3">
                    {/* The handle: dragged with a mouse to put the block somewhere else. The arrows beside it do the same from a keyboard or a phone. */}
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lilac text-violet-deep ${locked ? "" : "cursor-grab active:cursor-grabbing"}`}
                      draggable={!locked}
                      title={locked ? undefined : "Drag to move this block"}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", block.id);
                        const row = event.currentTarget.closest("li");
                        if (row) event.dataTransfer.setDragImage(row, 24, 24);
                        setDragged(index);
                      }}
                      onDragEnd={() => {
                        setDragged(null);
                        setOver(null);
                      }}
                    >
                      <Icon name={KIND_ICONS[block.kind]} size={17} />
                    </span>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`panel-${block.id}`}
                      onClick={() => setOpen(isOpen ? null : block.id)}
                      className="flex min-h-[44px] min-w-0 flex-1 flex-col items-start justify-center text-left"
                    >
                      <span className="text-sm font-semibold text-ink">{`${index + 1}. ${kindLabel(block.kind)}`}</span>
                      <span className="w-full truncate text-xs text-ink-soft">
                        {summaryLine(block)}
                        {reach && reach.visitors >= MIN_DEPTH_VISITORS && reach.shares[block.id] !== undefined
                          ? ` · ${reach.shares[block.id]}% of visitors reach it`
                          : ""}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={locked || index === 0 || (index === 1 && hasHero)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:opacity-30"
                        aria-label={`Move block ${index + 1} up`}
                      >
                        <Icon name="chevron-down" size={18} className="rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={locked || index === drafts.length - 1}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:opacity-30"
                        aria-label={`Move block ${index + 1} down`}
                      >
                        <Icon name="chevron-down" size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger"
                        aria-label={`Remove block ${index + 1}, ${kindLabel(block.kind)}`}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div id={`panel-${block.id}`} className="border-t border-line p-4 sm:p-5">
                      {blockFields(draft, index)}
                      <BlockRewrite
                        key={block.id}
                        productId={product.id}
                        block={block}
                        page={pageToSend}
                        onChange={(next) => setDrafts((all) => all.map((d, i) => (i === index ? { ...d, block: next } : d)))}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border-2 border-dashed border-line-strong p-3 sm:p-4">
            {drafts.length < MAX_BLOCKS ? (
              <>
                <label className="min-w-0 flex-1" htmlFor="add-kind">
                  <span className="field-label">{`Add a block (${drafts.length} of ${MAX_BLOCKS})`}</span>
                  <select id="add-kind" className="field" value={chosen} onChange={(e) => setAdding(e.target.value as BlockKind)}>
                    {addable.map((k) => (
                      <option key={k.kind} value={k.kind}>{`${k.label} — ${k.hint}`}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => add(chosen)} className="btn btn-secondary">
                  <Icon name="plus" size={17} />
                  Add
                </button>
              </>
            ) : (
              <p className="text-sm text-ink-soft">{`${MAX_BLOCKS} blocks is the most one page can have.`}</p>
            )}
          </div>

          {product.free ? (
            <div className="mt-6 rounded-2xl bg-paper p-4 ring-1 ring-line sm:p-5">
              <label htmlFor="next-product" className="field-label">
                After someone signs up, show
              </label>
              <select id="next-product" className="field" value={next} onChange={(e) => setNext(e.target.value)}>
                <option value="">Nothing more</option>
                {nextOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-soft">
                A card with that product&apos;s picture, price and a link to its own page, under &ldquo;Check your inbox&rdquo; and beside the download. Nothing is charged or added for them.
              </p>
            </div>
          ) : null}

          <details className="mt-6 rounded-2xl bg-paper p-4 ring-1 ring-line sm:p-5">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Search and sharing</summary>
            <div className="mt-4 space-y-4">
              {field(
                "seo-title",
                "Title in search results and shared links",
                <input id="seo-title" className="field" maxLength={MAX_SEO_TITLE} value={seoTitle} placeholder={`${product.title} — ${storeName}`} onChange={(e) => setSeoTitle(e.target.value)} />,
                counter(seoTitle, MAX_SEO_TITLE),
              )}
              {field(
                "seo-description",
                "Description",
                <textarea id="seo-description" className="field" rows={2} maxLength={MAX_SEO_DESCRIPTION} value={seoDescription} placeholder={product.summary || "One or two sentences on what it is."} onChange={(e) => setSeoDescription(e.target.value)} />,
                counter(seoDescription, MAX_SEO_DESCRIPTION),
              )}
              <p className="text-xs text-ink-soft">
                The picture a shared link unfolds into is made from the product&apos;s picture, its title, price and — once buyers review it — its stars.
              </p>
            </div>
          </details>
        </>
      )}

      {error ? (
        <p className="notice notice-error mt-4" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => send(pageToSend(), "Page saved.")} aria-busy={busy} disabled={busy || !dirty} className="btn btn-primary">
          {busy ? "Saving…" : "Save the page"}
        </button>
        {dirty ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDrafts(toDrafts(initial));
              setSeoTitle(initial.seoTitle);
              setSeoDescription(initial.seoDescription);
              setNext(initial.next ?? "");
              setError(null);
            }}
          >
            Undo changes
          </button>
        ) : null}
        {initial.blocks.length > 0 && !dirty ? (
          confirmClear ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              Back to the plain page?
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => send(null, "Page cleared.")}>
                Yes, clear it
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(true)}>
              Clear the page
            </button>
          )
        ) : null}
      </div>
    </section>
  );
}

/** A list of one-line points. */
/** The rows of a comparison: what is compared, and a cell for each column, with a tick and a cross a press away. */
function CompareEditor({ base, rows, onChange }: { base: string; rows: CompareRow[]; onChange: (rows: CompareRow[]) => void }) {
  const set = (i: number, patch: Partial<CompareRow>) => onChange(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const cell = (i: number, side: "a" | "b", label: string) => {
    const value = rows[i][side];
    return (
      <div className="min-w-0">
        <label htmlFor={`${base}-r${i}${side}`} className="text-xs font-semibold text-ink-soft">
          {label}
        </label>
        <div className="mt-1 flex items-center gap-1.5">
          <input
            id={`${base}-r${i}${side}`}
            className="field min-w-0"
            maxLength={MAX_CELL}
            value={value === CELL_YES ? "" : value === CELL_NO ? "" : value}
            placeholder={value === CELL_YES ? "A tick" : value === CELL_NO ? "A cross" : "A few words"}
            onChange={(e) => set(i, { [side]: e.target.value })}
          />
          <button
            type="button"
            aria-pressed={value === CELL_YES}
            onClick={() => set(i, { [side]: value === CELL_YES ? "" : CELL_YES })}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-line ${value === CELL_YES ? "bg-mint-soft text-mint-deep" : "text-ink-soft hover:bg-paper"}`}
            aria-label={`A tick in ${label.toLowerCase()}`}
          >
            <Icon name="check" size={16} />
          </button>
          <button
            type="button"
            aria-pressed={value === CELL_NO}
            onClick={() => set(i, { [side]: value === CELL_NO ? "" : CELL_NO })}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-line ${value === CELL_NO ? "bg-danger-soft text-danger" : "text-ink-soft hover:bg-paper"}`}
            aria-label={`A cross in ${label.toLowerCase()}`}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl bg-paper p-3 ring-1 ring-line">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-mute">{`Row ${i + 1}`}</p>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger"
              aria-label={`Remove row ${i + 1}`}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
          <label htmlFor={`${base}-r${i}l`} className="sr-only">{`What row ${i + 1} compares`}</label>
          <input
            id={`${base}-r${i}l`}
            className="field mt-1"
            maxLength={MAX_ITEM}
            value={row.label}
            placeholder="What is compared, e.g. Feedback on your work"
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {cell(i, "a", "Your column")}
            {cell(i, "b", "The other column")}
          </div>
        </div>
      ))}
      {rows.length < MAX_COMPARE_ROWS ? (
        <button type="button" onClick={() => onChange([...rows, { label: "", a: CELL_YES, b: CELL_NO }])} className="btn btn-ghost btn-sm">
          <Icon name="plus" size={15} />
          {`Add a row (${rows.length} of ${MAX_COMPARE_ROWS})`}
        </button>
      ) : null}
    </div>
  );
}

function ListEditor({
  base,
  label,
  items,
  max,
  maxLength,
  onChange,
}: {
  base: string;
  label: string;
  items: string[];
  max: number;
  maxLength: number;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <label htmlFor={`${base}-i${i}`} className="sr-only">{`${label} ${i + 1}`}</label>
          <input
            id={`${base}-i${i}`}
            className="field"
            maxLength={maxLength}
            value={item}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger"
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      {items.length < max ? (
        <button type="button" onClick={() => onChange([...items, ""])} className="btn btn-ghost btn-sm">
          <Icon name="plus" size={15} />
          {`Add a ${label.toLowerCase()} (${items.length} of ${max})`}
        </button>
      ) : null}
      {items.some((item) => !item.trim()) ? <p className="text-xs text-ink-soft">Empty points are left out when you save.</p> : null}
    </div>
  );
}

/** A list of pairs: a part and a line about it, or a question and its answer. */
function PairEditor({
  base,
  first,
  second,
  items,
  max,
  onChange,
  addLabel,
  needsBoth = false,
}: {
  base: string;
  first: { label: string; max: number };
  second: { label: string; max: number; rows?: number };
  items: [string, string][];
  max: number;
  onChange: (items: [string, string][]) => void;
  addLabel: string;
  needsBoth?: boolean;
}) {
  const set = (i: number, k: 0 | 1, value: string) =>
    onChange(items.map((pair, j) => (j === i ? ((k === 0 ? [value, pair[1]] : [pair[0], value]) as [string, string]) : pair)));
  const incomplete = items.some(([a, b]) => (needsBoth ? !a.trim() || !b.trim() : !a.trim()));
  return (
    <div className="space-y-3">
      {items.map(([a, b], i) => (
        <div key={i} className="rounded-xl bg-paper p-3 ring-1 ring-line">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-mute">{`${first.label} ${i + 1}`}</p>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger"
              aria-label={`Remove ${first.label.toLowerCase()} ${i + 1}`}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <label htmlFor={`${base}-a${i}`} className="sr-only">{`${first.label} ${i + 1}`}</label>
          <input id={`${base}-a${i}`} className="field mt-1" maxLength={first.max} value={a} placeholder={first.label} onChange={(e) => set(i, 0, e.target.value)} />
          <label htmlFor={`${base}-b${i}`} className="sr-only">{`${second.label}, ${first.label.toLowerCase()} ${i + 1}`}</label>
          <textarea
            id={`${base}-b${i}`}
            className="field mt-2"
            rows={second.rows ?? 2}
            maxLength={second.max}
            value={b}
            placeholder={second.label}
            onChange={(e) => set(i, 1, e.target.value)}
          />
        </div>
      ))}
      {items.length < max ? (
        <button type="button" onClick={() => onChange([...items, ["", ""]])} className="btn btn-ghost btn-sm">
          <Icon name="plus" size={15} />
          {`${addLabel} (${items.length} of ${max})`}
        </button>
      ) : null}
      {incomplete ? (
        <p className="text-xs text-ink-soft">{needsBoth ? "A question without an answer, or an answer without a question, is left out when you save." : "A part without a name is left out when you save."}</p>
      ) : null}
    </div>
  );
}

/**
 * How the saved headline test is going, read from the counts (lib/headline-test.ts).
 * Shown only once a test is saved: a test being typed has nothing to show yet.
 */
function TestResults({ productId, running }: { productId: string; running: boolean }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    if (!running) return;
    let live = true;
    fetch(`/api/store/ab?id=${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; counts?: Counts }) => {
        if (live && data.ok && data.counts) setCounts(data.counts);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [productId, running]);
  if (!running) return <p className="text-xs text-ink-soft">Save the page and the test starts with the next visitor.</p>;
  if (!counts) return null;
  const won = winner(counts);
  return (
    <div className="text-sm text-ink">
      <p>{`First headline: seen ${counts.va.toLocaleString("en-US")} times, ${counts.ca.toLocaleString("en-US")} checkouts (${rate(counts.ca, counts.va)}%).`}</p>
      <p>{`Second headline: seen ${counts.vb.toLocaleString("en-US")} times, ${counts.cb.toLocaleString("en-US")} checkouts (${rate(counts.cb, counts.vb)}%).`}</p>
      <p className="mt-1 font-semibold">
        {won === "b"
          ? "The second headline wins. Your page now shows it to everybody. Make it the hero's own headline and switch the test off to keep it."
          : won === "a"
            ? "The first headline wins. Your page now shows it to everybody. Switch the test off, or try another second headline."
            : `Still running: no clear winner yet. Each needs at least ${MIN_VIEWS} views and a real difference.`}
      </p>
      <p className="mt-1 text-xs text-ink-soft">Visitors asked for consent before a cookie, as in the EU and UK, see the first headline and are not counted.</p>
    </div>
  );
}

const PICTURE_PROBLEMS: Record<string, string> = {
  unreadable: "That picture could not be opened. Try a JPEG, PNG or WebP.",
  source: "That picture is over 30 MB. Pick a smaller one, or a screenshot of it.",
  too_big: "That picture is still over 1 MB after shrinking. Try a simpler one.",
  failed: "That picture could not be sent. Check your connection and try again.",
};

/** The long side a page's picture is shrunk to: sharp across the page's column on any screen. */
const PAGE_PICTURE_SIDE = 1400;

/**
 * The pictures of one block: chosen from the creator's device, shrunk in the
 * browser and sent straight to the store's own picture folder, exactly as a
 * product's picture is (components/product-image-editor.tsx). They join the
 * page when it is saved; a picture taken off a saved page is deleted then.
 */
function PicturesEditor({
  base,
  productId,
  folder,
  items,
  room,
  onChange,
}: {
  base: string;
  productId: string;
  folder: string;
  items: Picture[];
  /** How many pictures this block may hold, given what the rest of the page holds. */
  room: number;
  onChange: (items: Picture[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const left = Math.max(0, room - items.length);

  async function choose(files: FileList | null) {
    if (!files || busy) return;
    const chosen = [...files].slice(0, left);
    if (chosen.length === 0) return;
    setError(null);
    setBusy(chosen.length);
    const added: Picture[] = [];
    try {
      for (const file of chosen) {
        if (file.size > MAX_SOURCE_BYTES) {
          setError(PICTURE_PROBLEMS.source);
          continue;
        }
        let shrunk: Awaited<ReturnType<typeof shrink>>;
        try {
          shrunk = await shrink(file, PAGE_PICTURE_SIDE);
        } catch (thrown) {
          setError(thrown instanceof Error && thrown.message === "too_big" ? PICTURE_PROBLEMS.too_big : PICTURE_PROBLEMS.unreadable);
          continue;
        }
        const path = imagePath(folder, crypto.randomUUID().replace(/-/g, ""), shrunk.blob.type);
        try {
          await uploadPresigned(path, shrunk.blob, {
            access: "private",
            handleUploadUrl: "/api/store/image/upload",
            clientPayload: JSON.stringify({ productId }),
            contentType: shrunk.blob.type,
          });
          added.push({ path, width: shrunk.width, height: shrunk.height, alt: "", caption: "" });
        } catch {
          setError(PICTURE_PROBLEMS.failed);
        }
        setBusy((n) => Math.max(0, n - 1));
      }
    } finally {
      if (added.length) onChange([...items, ...added]);
      setBusy(0);
      if (input.current) input.current.value = "";
    }
  }

  const set = (i: number, patch: Partial<Picture>) => onChange(items.map((picture, j) => (j === i ? { ...picture, ...patch } : picture)));
  const swap = (i: number, by: -1 | 1) => {
    const to = i + by;
    if (to < 0 || to >= items.length) return;
    const copy = [...items];
    [copy[i], copy[to]] = [copy[to], copy[i]];
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept={IMAGE_ACCEPT} multiple className="hidden" aria-hidden="true" tabIndex={-1} onChange={(event) => choose(event.target.files)} />
      {items.map((picture, i) => (
        <div key={picture.path} className="flex gap-3 rounded-xl bg-paper p-3 ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(picture)} alt="" width={picture.width} height={picture.height} className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-line" />
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor={`${base}-pc${i}`} className="sr-only">{`A line under picture ${i + 1}`}</label>
            <input id={`${base}-pc${i}`} className="field" maxLength={MAX_PICTURE_CAPTION} value={picture.caption} placeholder="A line under it (optional)" onChange={(e) => set(i, { caption: e.target.value })} />
            <label htmlFor={`${base}-pa${i}`} className="sr-only">{`What picture ${i + 1} shows`}</label>
            <input id={`${base}-pa${i}`} className="field" maxLength={MAX_ALT_LENGTH} value={picture.alt} placeholder="What it shows, for someone who cannot see it" onChange={(e) => set(i, { alt: e.target.value })} />
          </div>
          <div className="flex shrink-0 flex-col items-center">
            <button type="button" onClick={() => swap(i, -1)} disabled={i === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-white hover:text-ink disabled:opacity-30" aria-label={`Move picture ${i + 1} earlier`}>
              <Icon name="chevron-down" size={16} className="rotate-180" />
            </button>
            <button type="button" onClick={() => swap(i, 1)} disabled={i === items.length - 1} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-white hover:text-ink disabled:opacity-30" aria-label={`Move picture ${i + 1} later`}>
              <Icon name="chevron-down" size={16} />
            </button>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger" aria-label={`Remove picture ${i + 1}`}>
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
      ))}
      {left > 0 ? (
        <button type="button" onClick={() => input.current?.click()} disabled={busy > 0} aria-busy={busy > 0} className="btn btn-secondary btn-sm">
          <Icon name="camera" size={15} />
          {busy > 0 ? `Sending ${busy} ${busy === 1 ? "picture" : "pictures"}…` : `Add pictures (${items.length} of ${room})`}
        </button>
      ) : (
        <p className="text-xs text-ink-soft">{`This block is full. A block holds ${MAX_PICTURES} pictures and a page ${MAX_PAGE_PICTURES}.`}</p>
      )}
      {error ? (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-ink-soft">Your own pictures: pages of the book, a screen of the course, the finished result. Each is shrunk before it is sent, shown once, and opens full size when a visitor presses it.</p>
      )}
    </div>
  );
}
