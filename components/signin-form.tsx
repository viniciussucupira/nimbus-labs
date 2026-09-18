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
    "Sign-in is not switched on yet, so nothing was sent. Write to us and we will tell you when it is.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });

    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
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
        className="rounded-3xl border-2 border-mint-brand/40 bg-mint-brand/10 p-6"
        role="status"
      >
        <p className="font-display text-xl font-black text-ink">
          Check that inbox
        </p>
        <p className="mt-3 text-ink-soft">
          If that address can sign in, the link is on its way. It works once and
          stops working in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="signin-email"
          className="block text-sm font-bold text-ink"
        >
          Your email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3.5 text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-violet-brand"
        />
      </div>

      {/* Honeypot: hidden from people, irresistible to robots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="signin-website">Website</label>
        <input
          id="signin-website"
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
          className="rounded-2xl bg-pink-brand/10 px-4 py-3 text-sm font-semibold text-pink-brand"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="w-full rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-7 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
      >
        {state.kind === "sending" ? "Sending…" : "Email me a link"}
      </button>

      <p className="text-sm text-ink-soft">
        No password. We send a link that works once, and we answer the same way
        whether or not that address has an account.
      </p>
    </form>
  );
}
