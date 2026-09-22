"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

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
      <div role="status" className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mint-soft text-mint-deep">
          <Icon name="mail" size={24} />
        </span>
        <p className="mt-4 text-xl font-semibold text-ink">Check that inbox</p>
        <p className="mt-2 text-ink-soft">
          If <span className="font-medium text-ink">{email}</span> can sign in, the link is on its way. It works once and
          stops working in 15 minutes.
        </p>
        <button type="button" onClick={() => setState({ kind: "idle" })} className="btn btn-ghost btn-sm mt-5">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="signin-email" className="field-label">
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
          aria-invalid={state.kind === "error" ? true : undefined}
          aria-describedby={state.kind === "error" ? "signin-error" : undefined}
          className="field mt-2"
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
        <p id="signin-error" className="notice notice-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="btn btn-primary btn-lg btn-block"
      >
        {state.kind === "sending" ? (
          <>
            <span className="spinner" aria-hidden="true" /> Sending
          </>
        ) : (
          "Email me a link"
        )}
      </button>

      <p className="text-sm text-ink-mute">
        No password. We send a link that works once, and we answer the same way
        whether or not that address has an account.
      </p>
    </form>
  );
}
