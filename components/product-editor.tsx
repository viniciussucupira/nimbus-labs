"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CallEditor } from "@/components/call-editor";
import { uploadPresigned } from "@vercel/blob/client";
import {
  MAX_PRODUCTS,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  centsToPrice,
  isFree,
  type Product,
} from "@/lib/store";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  MULTIPART_ABOVE_BYTES,
  maxFileLabel,
  fileFolder,
  readableSize,
  safeFileName,
  type ProductFile,
} from "@/lib/product-file";
import {
  MAX_OPTIONS,
  MAX_OPTION_LABEL_LENGTH,
} from "@/lib/product-option";
import { LINK_PROBLEMS, type LinkProblem, linkHost } from "@/lib/product-link";
import {
  INTERVALS,
  type Interval,
  everyLabel,
  intervalName,
} from "@/lib/product-recurring";

/** What to say when a price option is refused, over and above the shared set. */
const OPTION_MESSAGES: Record<string, string> = {
  price: "Type an amount between 1 and 5000, like 39 or 39.50.",
  free: "This one is free, so it has no prices to add. Give it a price first.",
  unknown: "That price is no longer on this product.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
};

const MESSAGES: Record<string, string> = {
  title: "Give it a name before saving.",
  price: "Type 0 to give it away, or an amount between 1 and 5000, like 27 or 27.50.",
  free: "Something free is given once, for an email address, so it cannot be a membership or have several prices. Take those off first.",
  unknown: "That is no longer on your store.",
  call: "This is a paid call, so it has one price, charged once, and delivers a time rather than a file. Stop selling it as a call first to change that.",
  too_big: `That file is over ${maxFileLabel()}, which is the most a store can hold.`,
  wrong_type: "That kind of file is not one a store can sell here.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Draft = {
  title: string;
  summary: string;
  price: string;
  /** "" means a single sale. Anything else is how often it charges. */
  every: "" | Interval;
};

const EMPTY: Draft = { title: "", summary: "", price: "", every: "" };

/** Whether what was typed in the price field means free. */
function typedFree(price: string): boolean {
  return /^0+(\.0{1,2})?$/.test(price.trim());
}

async function send(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const response = await fetch("/api/store/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      limit?: number;
      reason?: string;
    };
    if (data.ok) return null;
    if (data.error === "link") {
      // The server says which way the link was wrong; the creator gets that
      // sentence rather than a generic failure they cannot act on.
      return (
        LINK_PROBLEMS[data.reason as LinkProblem] ?? LINK_PROBLEMS.shape
      );
    }
    if (data.error === "too_many") {
      return `A store lists up to ${data.limit ?? MAX_PRODUCTS} things, and yours is full. Remove one to add another.`;
    }
    return MESSAGES[data.error ?? ""] ?? MESSAGES.server_error;
  } catch {
    return MESSAGES.server_error;
  }
}

/** The form used both for adding something and for changing it. */
function ProductForm({
  draft,
  setDraft,
  busy,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit();
      }}
      className="space-y-4 rounded-2xl border-2 border-violet-brand/30 bg-white p-4"
    >
      <div>
        <label
          htmlFor="product-title"
          className="field-label"
        >
          What are you selling
        </label>
        <input
          id="product-title"
          name="title"
          type="text"
          required
          maxLength={MAX_TITLE_LENGTH}
          value={draft.title}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
          placeholder="The Weeknight Recipe Pack"
          className="field mt-2"
        />
      </div>

      <div>
        <label
          htmlFor="product-summary"
          className="field-label"
        >
          What the buyer gets
        </label>
        <textarea
          id="product-summary"
          name="summary"
          rows={3}
          maxLength={MAX_SUMMARY_LENGTH}
          value={draft.summary}
          onChange={(event) =>
            setDraft({ ...draft, summary: event.target.value })
          }
          placeholder="Forty recipes, each one on a single page, as a PDF."
          className="field mt-2"
        />
        <p className="mt-1 text-sm text-ink-soft">
          {MAX_SUMMARY_LENGTH - draft.summary.length} characters left.
        </p>
      </div>

      <div>
        <label
          htmlFor="product-price"
          className="field-label"
        >
          Price
        </label>
        <div className="card mt-2 flex items-center pl-4 transition focus-within:border-violet-brand">
          <span className="text-ink-soft">USD $</span>
          <input
            id="product-price"
            name="price"
            type="text"
            inputMode="decimal"
            required
            value={draft.price}
            onChange={(event) =>
              setDraft({
                ...draft,
                price: event.target.value,
                // Free is given once, so a schedule would be left behind
                // pointing at nothing. It goes when the price goes to zero.
                every: typedFree(event.target.value) ? "" : draft.every,
              })
            }
            placeholder="27"
            className="w-full rounded-r-2xl bg-transparent px-2 py-3 text-ink outline-none placeholder:text-ink-soft/50"
          />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {typedFree(draft.price)
            ? "Free. A visitor types their email and we send them a link to it; their address joins your list once they use that link, marked with whether they agreed to hear from you."
            : "Every store here charges in US dollars. No other currency is handled yet. Type 0 to give it away for an email address instead."}
        </p>
      </div>

      {typedFree(draft.price) ? null : (
      <div>
        <label
          htmlFor="product-every"
          className="field-label"
        >
          How often it charges
        </label>
        <select
          id="product-every"
          name="every"
          value={draft.every}
          onChange={(event) =>
            setDraft({ ...draft, every: event.target.value as "" | Interval })
          }
          className="field mt-2"
        >
          <option value="">Once — a single sale</option>
          {INTERVALS.map((interval) => (
            <option key={interval} value={interval}>
              {`${intervalName(interval)} \u2014 charged ${everyLabel(interval)}`}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-ink-soft">
          {draft.every
            ? `A membership. The member is charged ${everyLabel(
                draft.every,
              )} on your own Stripe account until it is cancelled. A member who wants to stop writes to you — a reply to the receipt Stripe sends them reaches you — and you cancel it in your Stripe dashboard. Taking access back when somebody stops paying is yours to do, wherever you keep the thing.`
            : "Most things are sold once. Pick a schedule to make this a membership instead."}
        </p>
      </div>
      )}

      {error ? (
        <p
          className="notice notice-error "
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The several prices one product may be sold at.
 *
 * Kept below the product rather than inside its form, because adding a price
 * is not editing the product: the title and the description stay as they are
 * while the creator works out what to charge. Each option carries its own
 * file or link, so the block that attaches one is the same block a product
 * without options uses.
 */
function OptionsBlock({
  product,
  fileBusyId,
  percent,
  fileError,
  onPick,
  onDetach,
  onLink,
  onUnlink,
}: {
  product: Product;
  fileBusyId: string | null;
  percent: number;
  fileError: { id: string; message: string } | null;
  onPick: (id: string, file: File) => void;
  onDetach: (id: string) => void;
  onLink: (id: string, url: string) => void;
  onUnlink: (id: string) => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(payload: Record<string, unknown>, done: () => void) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/option", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        limit?: number;
      };
      if (!data.ok) {
        setError(
          data.error === "too_many"
            ? `A product carries up to ${data.limit ?? MAX_OPTIONS} prices.`
            : data.error === "label"
              ? "Give this price a name the buyer will read, like “5 weeks”."
              : (OPTION_MESSAGES[data.error ?? ""] ?? MESSAGES.server_error),
        );
        return;
      }
      done();
      router.refresh();
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  const form = (submitLabel: string, onSubmit: () => void, onCancel: () => void) => (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit();
      }}
      className="mt-2 space-y-3 rounded-2xl border-2 border-violet-brand/30 bg-white p-4"
    >
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[10rem] flex-1">
          <label
            htmlFor={`option-label-${product.id}`}
            className="field-label"
          >
            What this one is
          </label>
          <input
            id={`option-label-${product.id}`}
            type="text"
            required
            maxLength={MAX_OPTION_LABEL_LENGTH}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="5 weeks"
            className="field mt-1"
          />
        </div>
        <div className="w-28">
          <label
            htmlFor={`option-price-${product.id}`}
            className="field-label"
          >
            Price
          </label>
          <input
            id={`option-price-${product.id}`}
            type="text"
            inputMode="decimal"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="39"
            className="field mt-1"
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-ink"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-ink/10 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-ink">
          {product.options.length === 0
            ? "One price, or several"
            : "What this is sold at"}
        </p>
        {product.options.length > 0 ? (
          <p className="text-sm text-ink-soft">
            {product.options.length} of {MAX_OPTIONS}
          </p>
        ) : null}
      </div>

      {product.options.length === 0 ? (
        <p className="mt-1 text-sm text-ink-soft">
          Right now this sells at the one price above. Add a second and the
          buyer picks — one week or five, personal or commercial — and each one
          hands over its own file.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">
          The buyer picks one of these. While they are here, the single price on
          the product above is not charged and not shown.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {product.options.map((option, index) => (
          <li key={option.id} className="rounded-2xl bg-sand p-3">
            {editingId === option.id ? (
              form(
                "Save",
                () =>
                  run({ action: "edit", id: option.id, label, price }, () =>
                    setEditingId(null),
                  ),
                () => {
                  setEditingId(null);
                  setError(null);
                },
              )
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold text-ink">{option.label}</p>
                  <p className="font-semibold tabular-nums text-ink">
                    {`$${centsToPrice(option.priceCents)}`}
                  </p>
                </div>

                {!option.file && !option.link ? (
                  /*
                    Said here rather than discovered by a buyer. An option with
                    nothing behind it is left off the store page entirely, and
                    the creator is the one who can fix that.
                  */
                  <p className="mt-1 text-sm font-semibold text-danger">
                    Nothing to hand over yet, so this one is hidden from your
                    page.
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setLabel(option.label);
                      setPrice(centsToPrice(option.priceCents));
                      setError(null);
                      setAdding(false);
                      setEditingId(option.id);
                    }}
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() =>
                      run({ action: "move", id: option.id, direction: "up" }, () => {})
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === product.options.length - 1}
                    onClick={() =>
                      run(
                        { action: "move", id: option.id, direction: "down" },
                        () => {},
                      )
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move down
                  </button>
                  {removingId === option.id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovingId(option.id);
                        setError(null);
                      }}
                      className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <FileBlock
                  target={option}
                  busy={fileBusyId === option.id}
                  percent={percent}
                  error={
                    fileError && fileError.id === option.id
                      ? fileError.message
                      : null
                  }
                  onPick={(chosen) => onPick(option.id, chosen)}
                  onDetach={() => onDetach(option.id)}
                  onLink={(url) => onLink(option.id, url)}
                  onUnlink={() => onUnlink(option.id)}
                />

                {removingId === option.id ? (
                  <div className="mt-2 rounded-2xl border-2 border-pink-brand/30 bg-white p-3">
                    <p className="text-sm text-ink-soft">
                      Remove <strong className="text-ink">{option.label}</strong>
                      {option.file
                        ? ". The file on it is deleted with it."
                        : ". Nothing else on the product changes."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "remove", id: option.id }, () =>
                            setRemovingId(null),
                          )
                        }
                        className="btn btn-danger-solid btn-sm"
                      >
                        {busy ? "Removing…" : "Remove it"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingId(null)}
                        className="btn btn-secondary btn-sm"
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      {adding
        ? form(
            "Add this price",
            () =>
              run({ action: "add", id: product.id, label, price }, () =>
                setAdding(false),
              ),
            () => {
              setAdding(false);
              setError(null);
            },
          )
        : product.options.length >= MAX_OPTIONS
          ? null
          : (
            <button
              type="button"
              onClick={() => {
                setLabel("");
                setPrice("");
                setError(null);
                setEditingId(null);
                setAdding(true);
              }}
              className="btn btn-secondary btn-sm mt-2"
            >
              {product.options.length === 0
                ? "Sell it at several prices"
                : "Add another price"}
            </button>
          )}

      {error && !adding && !editingId ? (
        <p
          role="alert"
          className="mt-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What something delivers: a product, or one price option of one.
 *
 * Both hold a file or a link the same way and under the same folder rule, so
 * they are edited by the same block rather than by two that drift apart.
 */
type Delivers = {
  id: string;
  file: ProductFile | null;
  link: string | null;
};

/** The file something delivers: what is there, and how to change it. */
function FileBlock({
  target,
  busy,
  percent,
  error,
  onPick,
  onDetach,
  onLink,
  onUnlink,
}: {
  target: Delivers;
  busy: boolean;
  percent: number;
  error: string | null;
  onPick: (file: File) => void;
  onDetach: () => void;
  onLink: (url: string) => void;
  onUnlink: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [typing, setTyping] = useState(false);
  const [url, setUrl] = useState("");
  const file = target.file;
  const link = target.link;

  return (
    <div className="mt-3 rounded-2xl bg-white p-3">
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (chosen) onPick(chosen);
        }}
      />

      {busy ? (
        <div>
          <p className="text-sm font-bold text-ink">Sending the file…</p>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sand"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-brand to-sky-brand transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-ink-soft">{percent}%</p>
        </div>
      ) : file ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-bold text-ink">{file.name}</p>
            <p className="font-mono text-sm text-ink-soft">
              {readableSize(file.bytes)}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
            <a
              href={`/api/store/file/download?id=${encodeURIComponent(target.id)}`}
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Open it to check
            </a>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Replace it
            </button>
            <button
              type="button"
              onClick={onDetach}
              className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
            >
              Take it off
            </button>
          </div>
        </>
      ) : link ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-bold text-ink">
              {`Delivered from ${linkHost(link)}`}
            </p>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-ink-soft">
            {link}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Open it to check
            </a>
            <button
              type="button"
              onClick={() => {
                setUrl(link);
                setTyping(true);
              }}
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Change it
            </button>
            <button
              type="button"
              onClick={onUnlink}
              className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
            >
              Take it off
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-ink">
            Nothing on this yet
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {`Upload the file the buyer downloads, up to ${maxFileLabel()} \u2014 or point at where it already lives, if it is bigger than that or is not a file at all.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="btn btn-secondary btn-sm"
            >
              Choose the file
            </button>
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="btn btn-secondary btn-sm"
            >
              Use a link instead
            </button>
          </div>
        </>
      )}

      {typing ? (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            onLink(url);
            setTyping(false);
          }}
        >
          <label
            htmlFor={`link-${target.id}`}
            className="field-label"
          >
            Where the buyer should be sent
          </label>
          <input
            id={`link-${target.id}`}
            type="url"
            value={url}
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            className="field mt-1"
          />
          <p className="mt-1 text-sm text-ink-soft">
            A Google Drive folder, a private video page, a Notion page — anything
            with an https address. Check that anyone with the link can open it.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
            >
              Save the link
            </button>
            <button
              type="button"
              onClick={() => setTyping(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p
          className="notice notice-error mt-2"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The list of what the store offers, and every way to change it. */
export function ProductEditor({
  products,
  folder,
  selling,
  testMode,
  email,
}: {
  products: Product[];
  folder: string;
  /** The creator's sign-in address, which booking replies go to. */
  email: string;
  /** Whether this store can actually take a card right now. */
  selling: boolean;
  /** Whether the platform is pointed at Stripe's test mode. */
  testMode: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileBusyId, setFileBusyId] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [fileError, setFileError] = useState<{ id: string; message: string } | null>(
    null,
  );

  const full = products.length >= MAX_PRODUCTS;

  /** Tells the store which file a product delivers, once it is really there. */
  async function attach(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const response = await fetch("/api/store/file/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (data.ok) return null;
      return MESSAGES[data.error ?? ""] ?? MESSAGES.server_error;
    } catch {
      return MESSAGES.server_error;
    }
  }

  /**
   * Sends one file straight from this browser to the private store.
   *
   * It never passes through our server, which is why a large file is possible
   * at all. The size and the kind are checked here so an impossible upload
   * fails in a second rather than after a long climb, and checked again by the
   * signature on the way in, because a check in a browser is a courtesy and
   * not a defence.
   */
  async function upload(id: string, chosen: File) {
    setFileError(null);
    if (chosen.size > MAX_FILE_BYTES) {
      setFileError({ id, message: MESSAGES.too_big });
      return;
    }

    setFileBusyId(id);
    setPercent(0);
    try {
      const pathname = fileFolder(folder, id) + safeFileName(chosen.name);
      const result = await uploadPresigned(pathname, chosen, {
        access: "private",
        handleUploadUrl: "/api/store/file",
        clientPayload: JSON.stringify({ productId: id }),
        // In parts once it is worth it, so a dropped connection costs one
        // part rather than the whole upload.
        multipart: chosen.size > MULTIPART_ABOVE_BYTES,
        onUploadProgress: (progress) => setPercent(progress.percentage),
      });

      const problem = await attach({
        id,
        pathname: result.pathname,
        name: chosen.name,
      });
      if (problem) {
        setFileError({ id, message: problem });
        return;
      }
      router.refresh();
    } catch (thrown) {
      const message =
        thrown instanceof Error && /content type|not allowed/i.test(thrown.message)
          ? MESSAGES.wrong_type
          : MESSAGES.server_error;
      setFileError({ id, message });
    } finally {
      setFileBusyId(null);
      setPercent(0);
    }
  }

  async function detach(id: string) {
    setFileError(null);
    setFileBusyId(id);
    const problem = await attach({ id, detach: true });
    setFileBusyId(null);
    if (problem) {
      setFileError({ id, message: problem });
      return;
    }
    router.refresh();
  }

  async function linkTo(id: string, url: string) {
    setFileError(null);
    setFileBusyId(id);
    const problem = await send({ action: "link", id, link: url });
    setFileBusyId(null);
    if (problem) {
      setFileError({ id, message: problem });
      return;
    }
    router.refresh();
  }

  async function unlink(id: string) {
    setFileError(null);
    setFileBusyId(id);
    const problem = await send({ action: "unlink", id });
    setFileBusyId(null);
    if (problem) {
      setFileError({ id, message: problem });
      return;
    }
    router.refresh();
  }

  async function run(payload: Record<string, unknown>, done: () => void) {
    setBusy(true);
    setError(null);
    const problem = await send(payload);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    done();
    router.refresh();
  }

  function startAdding() {
    setDraft(EMPTY);
    setError(null);
    setEditingId(null);
    setAdding(true);
  }

  function startEditing(product: Product) {
    setDraft({
      title: product.title,
      summary: product.summary,
      price: centsToPrice(product.priceCents),
      every: product.recurring ? product.recurring.interval : "",
    });
    setError(null);
    setAdding(false);
    setEditingId(product.id);
  }

  return (
    <div className="card mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
          What you are selling
        </p>
        <p className="text-sm text-ink-soft">
          {products.length} of {MAX_PRODUCTS}
        </p>
      </div>

      {products.length === 0 ? (
        <p className="mt-2 text-ink-soft">
          Your page is live and it is empty. Add the first thing and it shows up
          on it straight away.
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {products.map((product, index) => (
          <li
            key={product.id}
            className="rounded-2xl border border-line bg-paper p-4"
          >
            {editingId === product.id ? (
              <ProductForm
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                error={error}
                submitLabel="Save"
                onSubmit={() =>
                  run(
                    {
                      action: "edit",
                      id: product.id,
                      title: draft.title,
                      summary: draft.summary,
                      price: draft.price,
                      every: draft.every,
                    },
                    () => setEditingId(null),
                  )
                }
                onCancel={() => {
                  setEditingId(null);
                  setError(null);
                }}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold text-ink">{product.title}</p>
                  <p className="font-semibold tabular-nums text-ink">
                    {isFree(product)
                      ? "Free"
                      : product.recurring
                        ? `$${centsToPrice(product.priceCents)} ${everyLabel(
                            product.recurring.interval,
                          )}`
                        : `$${centsToPrice(product.priceCents)}`}
                  </p>
                </div>
                {product.summary ? (
                  <p className="mt-1 text-sm text-ink-soft">
                    {product.summary}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => startEditing(product)}
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() =>
                      run(
                        { action: "move", id: product.id, direction: "up" },
                        () => {},
                      )
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === products.length - 1}
                    onClick={() =>
                      run(
                        { action: "move", id: product.id, direction: "down" },
                        () => {},
                      )
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move down
                  </button>
                  {removingId === product.id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovingId(product.id);
                        setError(null);
                      }}
                      className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/*
                  With price options there is nothing to attach to the product
                  itself: each option delivers its own thing, and a file here
                  would be one nobody is ever sent. So the block moves inside
                  the options rather than sitting above them unused.
                */}
                <CallEditor product={product} email={email} />

                {product.call ? null : (
                <>
                {product.options.length === 0 ? (
                  <FileBlock
                    target={product}
                    busy={fileBusyId === product.id}
                    percent={percent}
                    error={
                      fileError && fileError.id === product.id
                        ? fileError.message
                        : null
                    }
                    onPick={(chosen) => upload(product.id, chosen)}
                    onDetach={() => detach(product.id)}
                    onLink={(url) => linkTo(product.id, url)}
                    onUnlink={() => unlink(product.id)}
                  />
                ) : null}

                {/* Several prices would put a price on something free. */}
                {isFree(product) && product.options.length === 0 ? null : (
                <OptionsBlock
                  product={product}
                  fileBusyId={fileBusyId}
                  percent={percent}
                  fileError={fileError}
                  onPick={upload}
                  onDetach={detach}
                  onLink={linkTo}
                  onUnlink={unlink}
                />
                )}
                </>
                )}

                {removingId === product.id ? (
                  <div className="mt-3 rounded-2xl border-2 border-pink-brand/30 bg-white p-4">
                    <p className="text-sm text-ink-soft">
                      Remove{" "}
                      <strong className="text-ink">{product.title}</strong> from
                      your page. Nothing else changes, and you can add it again
                      later.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "remove", id: product.id }, () =>
                            setRemovingId(null),
                          )
                        }
                        className="btn btn-danger-solid btn-sm"
                      >
                        {busy ? "Removing…" : "Yes, remove it"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingId(null)}
                        className="btn btn-ghost btn-sm"
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-5">
          <ProductForm
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            error={error}
            submitLabel="Add it"
            onSubmit={() =>
              run(
                {
                  action: "add",
                  title: draft.title,
                  summary: draft.summary,
                  price: draft.price,
                  every: draft.every,
                },
                () => {
                  setAdding(false);
                  setDraft(EMPTY);
                },
              )
            }
            onCancel={() => {
              setAdding(false);
              setError(null);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={startAdding}
          className="btn btn-primary mt-5"
        >
          Add something to sell
        </button>
      )}

      {full && !adding ? (
        <p className="mt-3 text-sm text-ink-soft">
          Your store is holding the most it can. Remove one to add another.
        </p>
      ) : null}

      {error && !adding && editingId === null && removingId === null ? (
        <p
          className="notice notice-error mt-3"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/*
        Three states, because there are three truths and the wrong one is a
        lie the moment the other becomes true. A line hard-coded to "nobody
        can pay you" goes stale the hour Stripe clears an account; a line
        hard-coded to "you can be paid" is worse, because somebody sets a
        price on it.
      */}
      <p className="mt-5 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
        {!selling ? (
          <>
            <strong className="text-ink">Nobody can pay you yet.</strong> What
            you write here is on your page the moment you save it, with the
            price, and the page says plainly that it cannot take a payment.
          </>
        ) : testMode ? (
          <>
            <strong className="text-ink">
              Your page can take a card, in Stripe&apos;s test mode.
            </strong>{" "}
            What you write here is on your page the moment you save it, and the
            checkout on it is real — but it is running against Stripe in test
            mode, so no real money moves and no real card is charged.
          </>
        ) : (
          <>
            <strong className="text-ink">
              Your page can take a card for this.
            </strong>{" "}
            What you write here is on your page the moment you save it, and a
            buyer can pay for it straight away, on your own Stripe account,
            with nothing taken on top.
          </>
        )}{" "}
        Your file is kept where only this account can reach it, and it is never
        named or linked on the public page.
      </p>
    </div>
  );
}
