"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from "@/lib/store";

const MESSAGES: Record<string, string> = {
  name: "Give the store a name before saving.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type State =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

/** Changes the name and the line under it on the public page. */
export function DetailsForm({
  name: current,
  bio: currentBio,
}: {
  name: string;
  bio: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(current);
  const [bio, setBio] = useState(currentBio);
  const [state, setState] = useState<State>({ kind: "closed" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "saving") return;
    setState({ kind: "saving" });

    try {
      const response = await fetch("/api/store/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setState({ kind: "closed" });
        toast("Name and description saved.");
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

  if (state.kind === "closed") {
    return (
      <button
        type="button"
        onClick={() => {
          setName(current);
          setBio(currentBio);
          setState({ kind: "open" });
        }}
        className="text-sm font-bold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
      >
        Edit name and description
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-4" noValidate>
      <div>
        <label
          htmlFor="store-name"
          className="field-label"
        >
          Store name
        </label>
        <input
          id="store-name"
          name="name"
          type="text"
          required
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field mt-2"
        />
      </div>

      <div>
        <label htmlFor="store-bio" className="field-label">
          One line about it
        </label>
        <textarea
          id="store-bio"
          name="bio"
          rows={2}
          maxLength={MAX_BIO_LENGTH}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="field mt-2"
        />
        <p className="mt-1 text-sm text-ink-soft">
          {MAX_BIO_LENGTH - bio.length} characters left. It sits under the name
          on your page.
        </p>
      </div>

      {state.kind === "error" ? (
        <p
          className="notice notice-error "
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={state.kind === "saving"}
          className="btn btn-primary"
        >
          {state.kind === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setState({ kind: "closed" })}
          className="btn btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
