"use client";

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

const MESSAGES: Record<string, string> = {
  invalid_email: "That does not look like an email address.",
  rate_limited:
    "That is a lot of tries from one place. Wait an hour and try again.",
  unavailable:
    "Sending is not switched on for this store yet, so nothing was sent. Write to the store owner and they will send the file by hand.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });

    try {
      const response = await fetch("/api/demo/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (data.ok) {
        setState({ kind: "sent" });
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

  if (state.kind === "sent") {
    return (
      <div
        className="notice notice-success "
        role="status"
      >
        <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
          Check that inbox
        </p>
        <p className="mt-3 text-ink-soft">
          If that address bought from this store and the download is still open,
          the link is on its way. If nothing arrives, the purchase was made with
          a different address, or the window has closed.
        </p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="recover-email"
          className="field-label"
        >
          The email you paid with
        </label>
        <input
          id="recover-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="field mt-2"
        />
      </div>

      {/* Honeypot: hidden from people, irresistible to robots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="recover-website">Website</label>
        <input
          id="recover-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
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
        disabled={state.kind === "sending"}
        className="btn btn-primary btn-lg btn-block"
      >
        {state.kind === "sending" ? "Sending…" : "Send the link again"}
      </button>

      <p className="text-sm text-ink-soft">
        No account, no password. We answer the same way whether or not that
        address bought anything — only the inbox learns the difference.
      </p>
    </form>
  );
}
