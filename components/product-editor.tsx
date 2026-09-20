"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import {
  MAX_PRODUCTS,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  centsToPrice,
  type Product,
} from "@/lib/store";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  fileFolder,
  readableSize,
  safeFileName,
} from "@/lib/product-file";
import { LINK_PROBLEMS, type LinkProblem, linkHost } from "@/lib/product-link";

const MESSAGES: Record<string, string> = {
  title: "Give it a name before saving.",
  price: "Type an amount between 1 and 5000, like 27 or 27.50.",
  unknown: "That is no longer on your store.",
  too_big: `That file is over ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB, which is the most a store can hold.`,
  wrong_type: "That kind of file is not one a store can sell here.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Draft = { title: string; summary: string; price: string };

const EMPTY: Draft = { title: "", summary: "", price: "" };

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
          className="block text-sm font-bold text-ink"
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
          className="mt-2 w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-violet-brand placeholder:text-ink-soft/50"
        />
      </div>

      <div>
        <label
          htmlFor="product-summary"
          className="block text-sm font-bold text-ink"
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
          className="mt-2 w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-violet-brand placeholder:text-ink-soft/50"
        />
        <p className="mt-1 text-sm text-ink-soft">
          {MAX_SUMMARY_LENGTH - draft.summary.length} characters left.
        </p>
      </div>

      <div>
        <label
          htmlFor="product-price"
          className="block text-sm font-bold text-ink"
        >
          Price
        </label>
        <div className="mt-2 flex items-center rounded-2xl border-2 border-ink/10 bg-white pl-4 transition focus-within:border-violet-brand">
          <span className="text-ink-soft">USD $</span>
          <input
            id="product-price"
            name="price"
            type="text"
            inputMode="decimal"
            required
            value={draft.price}
            onChange={(event) =>
              setDraft({ ...draft, price: event.target.value })
            }
            placeholder="27"
            className="w-full rounded-r-2xl bg-transparent px-2 py-3 text-ink outline-none placeholder:text-ink-soft/50"
          />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Every store here charges in US dollars. No other currency is handled
          yet.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-2xl bg-pink-brand/10 px-4 py-3 text-sm font-semibold text-pink-brand"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-3 text-sm font-bold text-ink-soft transition hover:text-violet-deep"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The file a product delivers: what is there, and how to change it. */
function FileBlock({
  product,
  busy,
  percent,
  error,
  onPick,
  onDetach,
  onLink,
  onUnlink,
}: {
  product: Product;
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
  const file = product.file;
  const link = product.link;

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
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-brand to-pink-brand transition-all"
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
              href={`/api/store/file/download?id=${encodeURIComponent(product.id)}`}
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
              className="text-ink-soft underline underline-offset-4 transition hover:text-pink-brand"
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
              className="text-ink-soft underline underline-offset-4 transition hover:text-pink-brand"
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
            {`Upload the file the buyer downloads, up to ${Math.round(
              MAX_FILE_BYTES / (1024 * 1024),
            )} MB \u2014 or point at where it already lives, if it is bigger than that or is not a file at all.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-full border-2 border-ink/15 px-5 py-2.5 text-sm font-bold text-ink transition hover:border-violet-brand hover:text-violet-deep"
            >
              Choose the file
            </button>
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="rounded-full border-2 border-ink/15 px-5 py-2.5 text-sm font-bold text-ink transition hover:border-violet-brand hover:text-violet-deep"
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
            htmlFor={`link-${product.id}`}
            className="block text-sm font-bold text-ink"
          >
            Where the buyer should be sent
          </label>
          <input
            id={`link-${product.id}`}
            type="url"
            value={url}
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            className="mt-1 w-full rounded-2xl border-2 border-ink/10 px-4 py-2.5 text-sm outline-none focus:border-violet-brand"
          />
          <p className="mt-1 text-sm text-ink-soft">
            A Google Drive folder, a private video page, a Notion page — anything
            with an https address. Check that anyone with the link can open it.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
            >
              Save the link
            </button>
            <button
              type="button"
              onClick={() => setTyping(false)}
              className="rounded-full border-2 border-ink/15 px-5 py-2.5 text-sm font-bold text-ink transition hover:border-ink/30"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p
          className="mt-2 rounded-2xl bg-pink-brand/10 px-4 py-3 text-sm font-semibold text-pink-brand"
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
}: {
  products: Product[];
  folder: string;
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
  async function upload(product: Product, chosen: File) {
    setFileError(null);
    if (chosen.size > MAX_FILE_BYTES) {
      setFileError({ id: product.id, message: MESSAGES.too_big });
      return;
    }

    setFileBusyId(product.id);
    setPercent(0);
    try {
      const pathname =
        fileFolder(folder, product.id) + safeFileName(chosen.name);
      const result = await uploadPresigned(pathname, chosen, {
        access: "private",
        handleUploadUrl: "/api/store/file",
        clientPayload: JSON.stringify({ productId: product.id }),
        onUploadProgress: (progress) => setPercent(progress.percentage),
      });

      const problem = await attach({
        id: product.id,
        pathname: result.pathname,
        name: chosen.name,
      });
      if (problem) {
        setFileError({ id: product.id, message: problem });
        return;
      }
      router.refresh();
    } catch (thrown) {
      const message =
        thrown instanceof Error && /content type|not allowed/i.test(thrown.message)
          ? MESSAGES.wrong_type
          : MESSAGES.server_error;
      setFileError({ id: product.id, message });
    } finally {
      setFileBusyId(null);
      setPercent(0);
    }
  }

  async function detach(product: Product) {
    setFileError(null);
    setFileBusyId(product.id);
    const problem = await attach({ id: product.id, detach: true });
    setFileBusyId(null);
    if (problem) {
      setFileError({ id: product.id, message: problem });
      return;
    }
    router.refresh();
  }

  async function linkTo(product: Product, url: string) {
    setFileError(null);
    setFileBusyId(product.id);
    const problem = await send({ action: "link", id: product.id, link: url });
    setFileBusyId(null);
    if (problem) {
      setFileError({ id: product.id, message: problem });
      return;
    }
    router.refresh();
  }

  async function unlink(product: Product) {
    setFileError(null);
    setFileBusyId(product.id);
    const problem = await send({ action: "unlink", id: product.id });
    setFileBusyId(null);
    if (problem) {
      setFileError({ id: product.id, message: problem });
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
    });
    setError(null);
    setAdding(false);
    setEditingId(product.id);
  }

  return (
    <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-xl font-black text-ink">
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
            className="rounded-2xl border-2 border-ink/5 bg-cream p-4"
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
                  <p className="font-mono font-bold text-violet-deep">
                    {`$${centsToPrice(product.priceCents)}`}
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
                      className="text-ink-soft underline underline-offset-4 transition hover:text-pink-brand"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <FileBlock
                  product={product}
                  busy={fileBusyId === product.id}
                  percent={percent}
                  error={
                    fileError && fileError.id === product.id
                      ? fileError.message
                      : null
                  }
                  onPick={(chosen) => upload(product, chosen)}
                  onDetach={() => detach(product)}
                  onLink={(url) => linkTo(product, url)}
                  onUnlink={() => unlink(product)}
                />

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
                        className="rounded-full bg-pink-brand px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                      >
                        {busy ? "Removing…" : "Yes, remove it"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingId(null)}
                        className="rounded-full px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:text-violet-deep"
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
          className="mt-5 rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
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
          className="mt-3 rounded-2xl bg-pink-brand/10 px-4 py-3 text-sm font-semibold text-pink-brand"
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
      <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-sm text-ink-soft">
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
