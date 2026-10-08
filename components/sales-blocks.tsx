import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { VideoEmbed } from "@/components/video-embed";
import { Countdown } from "@/components/countdown";
import { wordsIn } from "@/lib/buyer-words";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from "@/lib/store-language";
import { imageUrl } from "@/lib/product-image";
import { type Piece, aboutBlocks } from "@/lib/product-about";
import type { CtaBlock, HeroBlock, PageBlock } from "@/lib/sales-page";

/**
 * The blocks of a product's page, drawn (lib/sales-page.ts says what each is).
 *
 * The same components draw the page a buyer sees and the preview in the
 * studio, so what the creator previews is what goes live. Every word is
 * rendered as text; paragraphs, lists and links are built here from the
 * plain-text rules of the long description, and nothing a creator typed is
 * ever put on the page as markup.
 *
 * Colours come from the store's look (the st-* properties), so a page
 * follows its store's theme without choosing a colour of its own.
 */

/** Where a button on the page leads: straight to the checkout, to a place on the page, or nowhere yet. */
export type PageAction =
  | { kind: "checkout"; handle: string; product: string }
  | { kind: "link"; href: string }
  | { kind: "none"; text: string };

/** What the blocks need to know about the product and its store. */
export type BlockContext = {
  storeName: string;
  productTitle: string;
  /** The product's picture, when it has one. */
  picture: { src: string; alt: string; width: number; height: number } | null;
  /** The creator's photo, when they have one. */
  photo: string | null;
  action: PageAction;
  /** The label a button uses when the creator left it empty. */
  defaultLabel: string;
  /** Drawn in the studio: buttons and links do nothing. */
  preview?: boolean;
  /**
   * The clock when the page was drawn, in seconds, for a countdown's first
   * numbers. Left out in the studio, where the browser's own clock is used.
   */
  now?: number;
  /** The store's language (lib/store-language.ts), for the words the blocks add themselves. */
  lang?: LanguageCode;
};

function Line({ pieces, preview }: { pieces: Piece[]; preview?: boolean }) {
  return (
    <>
      {pieces.map((piece, i) =>
        piece.href && !preview ? (
          <a key={i} href={piece.href} target="_blank" rel="noopener noreferrer nofollow ugc">
            {piece.text}
          </a>
        ) : (
          <span key={i}>{piece.text}</span>
        ),
      )}
    </>
  );
}

/** Plain text as paragraphs, lists and links: the long description's rules. */
export function PlainText({ text, preview, className = "" }: { text: string; preview?: boolean; className?: string }) {
  const blocks = aboutBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <div className={`st-about leading-relaxed ${className}`}>
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Line pieces={item} preview={preview} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((row, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                <Line pieces={row} preview={preview} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

/** A button that does what the page's action says. */
export function ActionButton({ ctx, label, large = false }: { ctx: BlockContext; label: string; large?: boolean }) {
  const text = label || ctx.defaultLabel;
  const className = `btn st-btn ${large ? "btn-lg" : ""} sp-cta-btn`;
  if (ctx.action.kind === "none") return <p className="st-muted text-sm font-semibold">{ctx.action.text}</p>;
  if (ctx.preview) {
    return (
      <span className={className}>
        {text}
      </span>
    );
  }
  if (ctx.action.kind === "link") {
    return (
      <a href={ctx.action.href} className={className}>
        {text}
      </a>
    );
  }
  return (
    <form action="/api/store/checkout" method="post" target="_top" data-checkout="" className="contents">
      <input type="hidden" name="handle" value={ctx.action.handle} />
      <input type="hidden" name="product" value={ctx.action.product} />
      <button type="submit" className={className}>
        {text}
      </button>
    </form>
  );
}

/**
 * The top of the page. Its headline is the page's one main heading, so the
 * hero may only ever be the first block.
 */
export function HeroView({ block, ctx, pill, rating }: { block: HeroBlock; ctx: BlockContext; pill: ReactNode; rating: ReactNode }) {
  const video = block.media === "video" ? block.video : null;
  const picture = block.media === "picture" ? ctx.picture : null;
  const hasMedia = Boolean(video || picture);
  return (
    <header className={`sp-hero ${hasMedia ? "sp-hero-split" : ""}`}>
      <div className="sp-hero-words">
        <div className="flex flex-wrap items-center gap-2">
          {pill}
          {rating}
        </div>
        <h1 className="font-display mt-4 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-5xl">
          {block.headline || ctx.productTitle}
        </h1>
        {block.sub ? <p className="st-muted mt-4 whitespace-pre-line text-lg leading-relaxed sm:text-xl">{block.sub}</p> : null}
      </div>
      {video ? (
        <div className="sp-hero-media">
          <VideoEmbed video={video} title={block.headline || ctx.productTitle} poster={ctx.picture ? { src: ctx.picture.src, alt: ctx.picture.alt } : null} inert={ctx.preview} />
        </div>
      ) : picture ? (
        <div className="sp-hero-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={picture.src}
            alt={picture.alt}
            width={picture.width}
            height={picture.height}
            fetchPriority="high"
            className="st-hero-img"
            style={{ aspectRatio: `${picture.width} / ${picture.height}` }}
          />
        </div>
      ) : null}
    </header>
  );
}

function Heading({ text, id }: { text: string; id?: string }) {
  if (!text) return null;
  return (
    <h2 id={id} className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-[1.75rem]">
      {text}
    </h2>
  );
}

function CtaView({ block, ctx }: { block: CtaBlock; ctx: BlockContext }) {
  return (
    <div className="sp-cta">
      <ActionButton ctx={ctx} label={block.label} large />
      {block.note ? <p className="st-muted mt-3 text-sm">{block.note}</p> : null}
    </div>
  );
}

/**
 * Any block but the hero. `reviews` is what the page puts where the reviews
 * block stands: the reviews themselves, drawn by the page, which knows them.
 */
export function BlockView({ block, ctx, reviews }: { block: PageBlock; ctx: BlockContext; reviews: ReactNode }) {
  switch (block.kind) {
    case "hero":
      return null;
    case "text":
      if (!block.heading && !block.body) return null;
      return (
        <section className="sp-section">
          <Heading text={block.heading} />
          <PlainText text={block.body} preview={ctx.preview} className={block.heading ? "mt-4 text-[1.0625rem]" : "text-[1.0625rem]"} />
        </section>
      );
    case "benefits":
      if (block.items.length === 0) return null;
      return (
        <section className="sp-section">
          <Heading text={block.heading} />
          <ul className={`grid gap-3 sm:grid-cols-2 ${block.heading ? "mt-5" : ""}`}>
            {block.items.map((item, i) => (
              <li key={i} className="sp-benefit">
                <span className="sp-tick" aria-hidden="true">
                  <Icon name="check" size={16} strokeWidth={2.4} />
                </span>
                <span className="font-semibold leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "inside":
      if (block.items.length === 0) return null;
      return (
        <section className="sp-section">
          <Heading text={block.heading} />
          <ol className={`space-y-3 ${block.heading ? "mt-5" : ""}`}>
            {block.items.map((item, i) => (
              <li key={i} className="sp-inside">
                <span className="sp-number" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">{item.title}</span>
                  {item.detail ? <span className="st-muted mt-1 block whitespace-pre-line text-[0.9375rem] leading-relaxed">{item.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      );
    case "bio":
      if (!block.body) return null;
      return (
        <section className="sp-section">
          <div className="sp-bio">
            {block.photo && ctx.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ctx.photo} alt="" width={80} height={80} className="st-avatar !mx-0 shrink-0" style={{ width: 80, height: 80 }} loading="lazy" />
            ) : block.photo ? (
              <span aria-hidden="true" className="st-avatar st-avatar-initial !mx-0 shrink-0" style={{ width: 80, height: 80, fontSize: "2rem" }}>
                {ctx.storeName.slice(0, 1).toUpperCase()}
              </span>
            ) : null}
            <div className="min-w-0">
              <Heading text={block.heading || wordsIn(ctx.lang ?? DEFAULT_LANGUAGE).aboutStore(ctx.storeName)} />
              <PlainText text={block.body} preview={ctx.preview} className="mt-3" />
            </div>
          </div>
        </section>
      );
    case "faq":
      if (block.items.length === 0) return null;
      return (
        <section className="sp-section">
          <Heading text={block.heading} />
          <div className={`space-y-3 ${block.heading ? "mt-5" : ""}`}>
            {block.items.map((item, i) => (
              <details key={i} className="sp-faq">
                <summary>
                  <span>{item.q}</span>
                  <Icon name="chevron-down" size={20} className="sp-faq-chevron shrink-0" />
                </summary>
                <PlainText text={item.a} preview={ctx.preview} className="st-muted px-5 pb-5" />
              </details>
            ))}
          </div>
        </section>
      );
    case "guarantee":
      if (!block.body) return null;
      return (
        <section className="sp-section">
          <div className="sp-guarantee">
            <span className="sp-guarantee-icon" aria-hidden="true">
              <Icon name="shield" size={24} />
            </span>
            <div className="min-w-0">
              <Heading text={block.heading || wordsIn(ctx.lang ?? DEFAULT_LANGUAGE).guarantee} />
              <PlainText text={block.body} preview={ctx.preview} className="mt-2" />
            </div>
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="sp-section">
          <CtaView block={block} ctx={ctx} />
        </section>
      );
    case "reviews":
      return reviews ? <section className="sp-section">{reviews}</section> : null;
    case "video":
      if (!block.video) return null;
      return (
        <section className="sp-section">
          <Heading text={block.heading} />
          <div className={block.heading ? "mt-5" : ""}>
            <VideoEmbed video={block.video} title={block.heading || ctx.productTitle} poster={null} inert={ctx.preview} />
          </div>
          {block.caption ? <PlainText text={block.caption} preview={ctx.preview} className="st-muted mt-3" /> : null}
        </section>
      );
    case "pictures":
      if (block.items.length === 0) return null;
      return (
        <section className="sp-section">
          <Heading text={block.heading} />
          <div className={`sp-pictures sp-pictures-${Math.min(block.items.length, 3)} ${block.heading ? "mt-5" : ""}`}>
            {block.items.map((picture) => {
              const image = (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl(picture)} alt={picture.alt} width={picture.width} height={picture.height} loading="lazy" decoding="async" />
              );
              return (
                <figure key={picture.path} className="sp-picture">
                  {ctx.preview ? (
                    image
                  ) : (
                    /* The whole picture, in its own tab: a page of a book is read, not glanced at. */
                    <a href={imageUrl(picture)} target="_blank" rel="noopener noreferrer" aria-label={picture.alt ? wordsIn(ctx.lang ?? DEFAULT_LANGUAGE).fullSize(picture.alt) : wordsIn(ctx.lang ?? DEFAULT_LANGUAGE).openFullSize}>
                      {image}
                    </a>
                  )}
                  {picture.caption ? <figcaption className="st-muted mt-2 text-sm leading-snug">{picture.caption}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        </section>
      );
    case "countdown":
      // One that was never given its moment, or whose moment has passed, is not drawn.
      if (!block.until || (ctx.now !== undefined && block.until <= ctx.now)) return null;
      return (
        <section className="sp-section">
          <Countdown
            until={block.until}
            now={ctx.now}
            heading={block.heading}
            note={block.note}
            words={{
              units: wordsIn(ctx.lang ?? DEFAULT_LANGUAGE).countdownUnits,
              until: wordsIn(ctx.lang ?? DEFAULT_LANGUAGE).until("{when}"),
              locale: LANGUAGES[ctx.lang ?? DEFAULT_LANGUAGE].locale,
            }}
          />
        </section>
      );
  }
}
