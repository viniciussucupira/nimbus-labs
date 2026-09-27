import { Fragment } from "react";
import { MAX_REVIEW_NAME, MAX_REVIEW_TEXT, type Review } from "@/lib/review-summary";

/** What happened to the last thing sent, in the buyer's words. */
export const REVIEW_NOTICES: Record<string, { text: string; alert?: boolean }> = {
  saved: { text: "Thank you. Your review is on the page now." },
  updated: { text: "Your review is updated." },
  deleted: { text: "Your review is deleted. Its stars are out of the average." },
  rating: { text: "Pick from one to five stars.", alert: true },
  refunded: { text: "This order was refunded, so it cannot be reviewed.", alert: true },
  expired: { text: "This link has expired. Ask for your purchases again from the store and review from there.", alert: true },
  no: { text: "This order cannot be reviewed here.", alert: true },
  full: { text: "This product cannot take more reviews.", alert: true },
  slow: { text: "That was a lot of tries in a short time. Wait a few minutes and send it again.", alert: true },
  busy: { text: "Someone else was saving at the same moment. Send it again.", alert: true },
  error: { text: "Something went wrong on our side. Nothing was changed. Try again in a moment.", alert: true },
};

/**
 * The form a buyer reviews one product with: stars, a few words, the name
 * to show. Plain HTML that works without JavaScript, posting to
 * /api/store/review with whatever proves the order (lib/review-proof.ts) in
 * hidden fields; nothing sent here can say who the buyer is.
 *
 * The stars are five radio buttons, so a keyboard moves through them with
 * the arrow keys and a screen reader hears "4 stars, 4 of 5". Every star up
 * to the one chosen is coloured by CSS alone (app/globals.css, .rv-rate).
 */
export function ReviewForm({
  handle,
  door,
  product,
  existing,
  storeName,
  back,
  notice,
}: {
  handle: string;
  /** The hidden fields that prove the order. */
  door: Record<string, string>;
  product: { id: string; title: string };
  existing: Review | null;
  storeName: string;
  /** Which page the answer comes back to. */
  back: "thanks" | "review";
  notice: string | null;
}) {
  const base = `rv-${product.id}`;
  const said = notice ? REVIEW_NOTICES[notice] ?? null : null;
  const hidden = (
    <>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="product" value={product.id} />
      <input type="hidden" name="back" value={back} />
      {Object.entries(door).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
  return (
    <div id={`r-${product.id}`} className="scroll-mt-6">
      {said ? (
        <p className={said.alert ? "st-note mb-4 text-sm" : "rv-done mb-4 text-sm font-semibold"} role={said.alert ? "alert" : "status"}>
          {said.text}
        </p>
      ) : null}
      <form action="/api/store/review" method="post" className="space-y-4">
        {hidden}
        <input type="hidden" name="action" value="save" />
        <div aria-hidden="true" className="hidden">
          <label>
            Leave this empty
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <fieldset>
          <legend className="st-label">{`Your rating for ${product.title}`}</legend>
          <div className="rv-rate mt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Fragment key={n}>
                <input
                  id={`${base}-${n}`}
                  type="radio"
                  name="rating"
                  value={n}
                  required
                  defaultChecked={existing?.rating === n}
                  className="rv-rate-input"
                />
                <label htmlFor={`${base}-${n}`} className="rv-rate-star">
                  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="m12 3.8 2.5 5.1 5.6.8-4.05 3.95.96 5.6L12 16.6l-5.01 2.65.96-5.6L3.9 9.7l5.6-.8L12 3.8Z"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="sr-only">{`${n} ${n === 1 ? "star" : "stars"}`}</span>
                </label>
              </Fragment>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${base}-text`} className="st-label">
            What you think (optional)
          </label>
          <textarea
            id={`${base}-text`}
            name="text"
            rows={4}
            maxLength={MAX_REVIEW_TEXT}
            defaultValue={existing?.text ?? ""}
            className="st-field mt-1"
            aria-describedby={`${base}-text-hint`}
          />
          <p id={`${base}-text-hint`} className="st-muted mt-1 text-xs">{`Up to ${MAX_REVIEW_TEXT.toLocaleString("en-US")} characters.`}</p>
        </div>
        <div>
          <label htmlFor={`${base}-name`} className="st-label">
            Name to show (optional)
          </label>
          <input
            id={`${base}-name`}
            type="text"
            name="name"
            maxLength={MAX_REVIEW_NAME}
            autoComplete="given-name"
            placeholder="Verified buyer"
            defaultValue={existing?.name ?? ""}
            className="st-field mt-1"
          />
        </div>
        <button type="submit" className="btn st-btn">
          {existing ? "Update my review" : "Post my review"}
        </button>
        <p className="st-muted text-xs leading-relaxed">
          {`Your review is public on ${storeName}'s page, marked as a verified purchase. Your email address is never shown. ${storeName} can reply and can hide it, but cannot change it, and nothing is given in return for writing one.`}
        </p>
      </form>
      {existing ? (
        <form action="/api/store/review" method="post" className="mt-3">
          {hidden}
          <input type="hidden" name="action" value="delete" />
          <button type="submit" className="st-footer-link min-h-[44px] text-sm font-semibold underline underline-offset-4">
            Delete my review
          </button>
        </form>
      ) : null}
    </div>
  );
}
