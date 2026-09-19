"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

const MESSAGES: Record<string, string> = {
  shape:
    "Use 3 to 24 letters, numbers, dots, hyphens or underscores, starting and ending with a letter or number.",
  reserved: "That name belongs to the site itself. Pick another one.",
  taken: "Someone already has that address. Pick another one.",
  same: "That is already your address.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

export function RenameForm({ current }: { current: string }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [state, setState] = useState<State>({ kind: "closed" });

  const preview = handle.trim().replace(/^@+/, "").toLowerCase();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "saving") return;
    setState({ kind: "saving" });

    try {
      const response = await fetch("/api/store/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        limit?: number;
      };
      if (data.ok) {
        setState({ kind: "closed" });
        setHandle("");
        router.refresh();
        return;
      }
      setState({
        kind: "error",
        message:
          data.error === "too_many"
            ? `A store keeps up to ${data.limit ?? 5} addresses, and yours is full. Going back to one you already had still works.`
            : (MESSAGES[data.error ?? ""] ?? MESSAGES.server_error),
      });
    } catch {
      setState({ kind: "error", message: MESSAGES.server_error });
    }
  }

  if (state.kind === "closed") {
    return (
      <button
        type="button"
        onClick={() => setState({ kind: "open" })}
        className="mt-4 text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
      >
        Change my address
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
      <label htmlFor="new-handle" className="block text-sm font-bold text-ink">
        New address
      </label>
      <div className="flex items-center rounded-2xl border-2 border-ink/10 bg-white pl-4 transition focus-within:border-violet-brand">
        <span className="text-ink-soft">nimbuslabsai.com/@</span>
        <input
          id="new-handle"
          name="handle"
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder={current}
          className="w-full rounded-r-2xl bg-transparent px-1 py-3 text-ink outline-none placeholder:text-ink-soft/50"
        />
      </div>

      <p className="text-sm text-ink-soft">
        {preview && preview !== current
          ? `Everything stays as it is — the same store, the same page. @${current} keeps working and sends people to @${preview}.`
          : "Your store, your page and everything on it stay exactly as they are. Only the address changes, and the old one keeps working for good."}
      </p>

      {state.kind === "error" ? (
        <p
          className="rounded-2xl bg-pink-brand/10 px-4 py-3 text-sm font-semibold text-pink-brand"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={state.kind === "saving"}
          className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {state.kind === "saving" ? "Changing…" : "Change it"}
        </button>
        <button
          type="button"
          onClick={() => setState({ kind: "closed" })}
          className="rounded-full px-5 py-3 text-sm font-bold text-ink-soft transition hover:text-violet-deep"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
