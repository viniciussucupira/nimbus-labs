"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { toast } from "@/components/toast";
import { type BlockContext, BlockView, HeroView } from "@/components/sales-blocks";
import { RatingLine, ReviewsSection } from "@/components/review-list";
import { type StoreLook, lookStyle } from "@/lib/store-look";
import type { Review, Summary } from "@/lib/review-summary";
import {
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
  PROVIDER_NAMES,
  type PageBlock,
  type SalesPage,
  emptyBlock,
  newBlockId,
  readVideo,
  videoAddress,
} from "@/lib/sales-page";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  too_many: `A page can have up to ${MAX_BLOCKS} blocks.`,
  hero_first: "The hero can only be the first block: it carries the page's main headline.",
  two_reviews: "Reviews can sit in one place on the page. Remove the second block of them.",
  video: "That video address is not one we can play. Paste a YouTube, Vimeo or Loom link.",
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
};

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
    video: block.kind === "hero" && block.video ? videoAddress(block.video) : "",
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
}: {
  product: EditorProduct;
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
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(initial));
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [next, setNext] = useState(initial.next ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"build" | "preview">("build");
  const [wide, setWide] = useState(false);
  const [adding, setAdding] = useState<BlockKind>("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const saved = JSON.stringify({ d: toDrafts(initial), t: initial.seoTitle, s: initial.seoDescription, n: initial.next ?? "" });
  const dirty = JSON.stringify({ d: drafts, t: seoTitle, s: seoDescription, n: next }) !== saved;
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
      all.map((d, i) => (i === index && d.block.kind === "hero" ? { video: typed, block: { ...d.block, video } } : d)),
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

  function remove(index: number) {
    setDrafts((all) => all.filter((_, i) => i !== index));
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
    };
  }

  async function send(page: SalesPage | null, confirmation: string) {
    setBusy(true);
    setError(null);
    const badVideo = page?.blocks.find((b) => b.kind === "hero" && b.media === "video" && !b.video);
    if (badVideo) {
      setError(MESSAGES.video);
      setBusy(false);
      setOpen(badVideo.id);
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
            </div>
          ) : null}

          <ol className="mt-6 space-y-3">
            {drafts.map((draft, index) => {
              const block = draft.block;
              const isOpen = open === block.id;
              const locked = block.kind === "hero";
              return (
                <li key={block.id} className="rounded-2xl border border-line bg-white">
                  <div className="flex items-center gap-2 p-2 pl-3 sm:gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lilac text-violet-deep">
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
                      <span className="w-full truncate text-xs text-ink-soft">{summaryLine(block)}</span>
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
