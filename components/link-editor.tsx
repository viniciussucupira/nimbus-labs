"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LINK_PROBLEMS, type LinkProblem, linkHost } from "@/lib/product-link";
import {
  MAX_LINK_TITLE_LENGTH,
  MAX_STORE_LINKS,
  type StoreLink,
} from "@/lib/store-link";

const MESSAGES: Record<string, string> = {
  title: "Give the button a name before saving.",
  unknown: "That is no longer on your page.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Draft = { title: string; url: string };

const EMPTY: Draft = { title: "", url: "" };

async function send(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const response = await fetch("/api/store/links", {
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
      // The server says which way the address was wrong; the creator gets
      // that sentence rather than a failure they cannot act on.
      return LINK_PROBLEMS[data.reason as LinkProblem] ?? LINK_PROBLEMS.shape;
    }
    if (data.error === "too_many") {
      return `A page holds up to ${data.limit ?? MAX_STORE_LINKS} links, and yours is full. Remove one to add another.`;
    }
    return MESSAGES[data.error ?? ""] ?? MESSAGES.server_error;
  } catch {
    return MESSAGES.server_error;
  }
}

/** The form used both for adding a link and for changing one. */
function LinkForm({
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
        <label htmlFor="link-title" className="field-label">
          What the button says
        </label>
        <input
          id="link-title"
          name="title"
          type="text"
          required
          maxLength={MAX_LINK_TITLE_LENGTH}
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="Watch on YouTube"
          className="field mt-2"
        />
      </div>

      <div>
        <label htmlFor="link-url" className="field-label">
          Where it goes
        </label>
        <input
          id="link-url"
          name="url"
          type="url"
          required
          value={draft.url}
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
          placeholder="https://"
          className="field mt-2"
        />
        <p className="mt-1 text-sm text-ink-soft">
          Anything of yours that already lives somewhere else. Nothing is sold
          through a link and nothing is charged for it.
        </p>
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
          className="btn btn-primary"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The links on the page that are not for sale.
 *
 * Kept apart from the products on purpose, in the studio as well as on the
 * page: a creator deciding what to charge for and a creator deciding where to
 * send people are doing two different things, and mixing them into one list
 * makes both harder to read.
 */
export function LinkEditor({ links }: { links: StoreLink[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function startEditing(link: StoreLink) {
    setDraft({ title: link.title, url: link.url });
    setError(null);
    setAdding(false);
    setEditingId(link.id);
  }

  return (
    <div className="card mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
          Your links
        </p>
        <p className="text-sm text-ink-soft">
          {links.length} of {MAX_STORE_LINKS}
        </p>
      </div>

      {links.length === 0 ? (
        <p className="mt-2 text-ink-soft">
          Where else you can be found: the channel, the podcast, the profile,
          the booking page. These sit under what you sell, and they cost
          nothing and charge nothing.
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {links.map((link, index) => (
          <li
            key={link.id}
            className="rounded-2xl border border-line bg-paper p-4"
          >
            {editingId === link.id ? (
              <LinkForm
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                error={error}
                submitLabel="Save"
                onSubmit={() =>
                  run(
                    {
                      action: "edit",
                      id: link.id,
                      title: draft.title,
                      url: draft.url,
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
                <p className="font-bold text-ink">{link.title}</p>
                <p className="mt-1 break-all font-mono text-xs text-ink-soft">
                  {link.url}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
                  >
                    Open it to check
                  </a>
                  <button
                    type="button"
                    onClick={() => startEditing(link)}
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() =>
                      run({ action: "move", id: link.id, direction: "up" }, () => {})
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === links.length - 1}
                    onClick={() =>
                      run(
                        { action: "move", id: link.id, direction: "down" },
                        () => {},
                      )
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move down
                  </button>
                  {removingId === link.id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovingId(link.id);
                        setError(null);
                      }}
                      className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {removingId === link.id ? (
                  <div className="mt-3 rounded-2xl border-2 border-pink-brand/30 bg-white p-4">
                    <p className="text-sm text-ink-soft">
                      Take{" "}
                      <strong className="text-ink">{link.title}</strong> off
                      your page. It only stops being listed here — whatever it
                      points at on {linkHost(link.url)} is untouched.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "remove", id: link.id }, () =>
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
                    {error ? (
                      <p
                        role="alert"
                        className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-ink"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-5">
          <LinkForm
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            error={error}
            submitLabel="Add it"
            onSubmit={() =>
              run(
                { action: "add", title: draft.title, url: draft.url },
                () => setAdding(false),
              )
            }
            onCancel={() => {
              setAdding(false);
              setError(null);
            }}
          />
        </div>
      ) : links.length >= MAX_STORE_LINKS ? (
        <p className="mt-5 text-sm text-ink-soft">
          {`Your page holds ${MAX_STORE_LINKS} links and they are all used. Remove one to add another.`}
        </p>
      ) : (
        <button
          type="button"
          onClick={startAdding}
          className="btn btn-primary mt-5"
        >
          Add a link
        </button>
      )}
    </div>
  );
}
