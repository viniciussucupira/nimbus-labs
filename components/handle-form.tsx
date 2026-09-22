"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

const MESSAGES: Record<string, string> = {
  shape:
    "Use 3 to 24 letters, numbers, dots, hyphens or underscores, starting and ending with a letter or number.",
  reserved: "That name belongs to the site itself. Pick another one.",
  taken: "Someone already has that address. Pick another one.",
  already: "This account already has a store.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

export function HandleForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const preview = handle.trim().replace(/^@+/, "").toLowerCase();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "saving") return;
    setState({ kind: "saving" });

    try {
      const response = await fetch("/api/store/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, name, bio }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.refresh();
        return;
      }
      setState({
        kind: "error",
        message: MESSAGES[data.error ?? ""] ?? MESSAGES.server_error,
      });
    } catch {
      setState({ kind: "error", message: MESSAGES.server_error });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="store-handle" className="field-label">
          Your address
        </label>
        <div className="card mt-2 flex items-center pl-4 transition focus-within:border-violet-brand">
          <span className="text-ink-soft">nimbuslabsai.com/@</span>
          <input
            id="store-handle"
            name="handle"
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="yourname"
            className="w-full rounded-r-2xl bg-transparent px-1 py-3.5 text-ink outline-none placeholder:text-ink-soft/60"
          />
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {preview
            ? `Your store will live at nimbuslabsai.com/@${preview}`
            : "This is the address you give people. You can change it later, and the old one keeps working."}
        </p>
      </div>

      <div>
        <label htmlFor="store-name" className="field-label">
          Store name
        </label>
        <input
          id="store-name"
          name="name"
          type="text"
          required
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="What people should see at the top"
          className="field mt-2"
        />
      </div>

      <div>
        <label htmlFor="store-bio" className="field-label">
          One line about it <span className="font-semibold text-ink-soft">(optional)</span>
        </label>
        <input
          id="store-bio"
          name="bio"
          type="text"
          maxLength={160}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Who it is for, in one sentence"
          className="field mt-2"
        />
      </div>

      {state.kind === "error" ? (
        <p
          className="notice notice-error "
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.kind === "saving"}
        className="btn btn-primary btn-lg btn-block"
      >
        {state.kind === "saving" ? "Creating…" : "Create my store"}
      </button>
    </form>
  );
}
