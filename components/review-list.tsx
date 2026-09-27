import Link from "next/link";
import { Stars } from "@/components/review-stars";
import { type Review, type Summary, average, averageText, hiddenLine, showsRating } from "@/lib/review-summary";

const DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "12 verified reviews". */
export function countWords(count: number): string {
  return `${count.toLocaleString("en-US")} verified ${count === 1 ? "review" : "reviews"}`;
}

/**
 * The small line a store card and the top of a product's page carry: the
 * stars, the average and how many — only when lib/reviews.ts says a page may
 * show them.
 */
export function RatingLine({ summary, href, className = "" }: { summary: Summary; href?: string; className?: string }) {
  if (!showsRating(summary)) return null;
  const body = (
    <>
      <Stars value={average(summary)} size={15} label={`Rated ${averageText(summary)} out of 5 from ${countWords(summary.count)}`} />
      <span className="font-bold tabular-nums" aria-hidden="true">
        {averageText(summary)}
      </span>
      <span className="st-muted" aria-hidden="true">
        {`(${summary.count.toLocaleString("en-US")})`}
      </span>
    </>
  );
  return href ? (
    <a href={href} className={`rv-line ${className}`}>
      {body}
    </a>
  ) : (
    <span className={`rv-line ${className}`}>{body}</span>
  );
}

/** One review as the page shows it: stars, the name the buyer chose, what they wrote, and any answer. */
export function ReviewItem({ review, storeName }: { review: Review; storeName: string }) {
  return (
    <li className="rv-item">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size={16} label={`${review.rating} out of 5 stars`} />
        <span className="font-semibold">{review.name || "Verified buyer"}</span>
        <span className="rv-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Verified purchase
        </span>
        {review.refunded ? <span className="rv-badge rv-badge-muted">Refunded, not counted</span> : null}
      </div>
      <p className="st-muted mt-1 text-xs">
        {DATE.format(new Date(review.createdAt))}
        {review.editedAt ? ` · edited ${DATE.format(new Date(review.editedAt))}` : ""}
      </p>
      {review.text ? <p className="mt-3 whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">{review.text}</p> : null}
      {review.reply ? (
        <div className="rv-reply">
          <p className="text-sm font-bold">{`Reply from ${storeName}`}</p>
          <p className="mt-1 whitespace-pre-line text-[0.9375rem] leading-relaxed [overflow-wrap:anywhere]">{review.reply.text}</p>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The reviews part of a product's page: the average and how the stars fall,
 * the rules in a sentence, how many the creator hid, and the newest reviews.
 */
export function ReviewsSection({
  heading,
  summary,
  reviews,
  storeName,
  productTitle,
  moreHref,
  preview = false,
}: {
  heading: string;
  summary: Summary;
  reviews: Review[];
  storeName: string;
  productTitle: string;
  /** Where the rest are, when there are more than these. */
  moreHref: string | null;
  preview?: boolean;
}) {
  const rated = showsRating(summary);
  const hidden = hiddenLine(summary);
  return (
    <div id="reviews" className="scroll-mt-6">
      <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-[1.75rem]">{heading || "Reviews"}</h2>
      {rated ? (
        <div className="rv-summary mt-5">
          <div>
            <p className="font-display text-5xl font-semibold leading-none tabular-nums">{averageText(summary)}</p>
            <div className="mt-2">
              <Stars value={average(summary)} size={18} />
            </div>
            <p className="st-muted mt-2 text-sm font-semibold">{countWords(summary.count)}</p>
          </div>
          <ul className="rv-dist" aria-label="How the stars are spread">
            {[5, 4, 3, 2, 1].map((stars) => {
              const n = summary.dist[stars - 1];
              const share = summary.count ? Math.round((n / summary.count) * 100) : 0;
              return (
                <li key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-12 shrink-0 tabular-nums">{`${stars} star${stars === 1 ? "" : "s"}`}</span>
                  <span className="rv-bar" aria-hidden="true">
                    <span style={{ width: `${share}%` }} />
                  </span>
                  <span className="st-muted w-10 shrink-0 text-right tabular-nums">{`${share}%`}</span>
                  <span className="sr-only">{`${n} ${n === 1 ? "review" : "reviews"}`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <p className="st-muted mt-4 text-sm">
        {`Only people who bought ${productTitle} here can review it, and every review is checked against its order. ${storeName} can reply and can hide a review, but cannot change one; hidden reviews still count in the average.`}
      </p>
      {hidden || summary.refunded ? (
        <p className="mt-2 text-sm font-semibold">
          {[hidden, summary.refunded ? `${summary.refunded} from refunded ${summary.refunded === 1 ? "order" : "orders"}, not counted` : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {reviews.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} storeName={storeName} />
          ))}
        </ul>
      ) : preview ? (
        <p className="st-note mt-6 text-sm">Buyers&apos; reviews appear here once somebody who paid writes one.</p>
      ) : null}
      {moreHref ? (
        <p className="mt-5">
          <Link prefetch={false} href={moreHref} className="st-footer-link text-sm font-semibold underline underline-offset-4">
            {`See all ${summary.visible.toLocaleString("en-US")} reviews`}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
