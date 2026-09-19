import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/signin-form";

export const metadata: Metadata = {
  title: "Sign in — Nimbus Labs",
  description:
    "Sign in to Nimbus Labs with a link sent to your email. No password to invent.",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, { title: string; body: string }> = {
  expired: {
    title: "That link no longer works",
    body: "A sign-in link works once and lasts 15 minutes. Ask for a fresh one below.",
  },
  out: {
    title: "You are signed out",
    body: "Your session is closed on this device.",
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const notice = NOTICES[status];

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-violet-brand/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-0 h-64 w-64 bg-mint-brand/25 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft shadow-sm">
          <span aria-hidden="true">☁️</span> Nimbus Labs
        </p>

        <h1 className="font-display mt-5 text-4xl font-black leading-tight sm:text-5xl">
          Sign in
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Type your email and we send a link. Clicking it signs you in — there is
          no password here, on purpose.
        </p>

        {notice ? (
          <div className="mt-6 rounded-3xl border-2 border-amber-brand/40 bg-amber-brand/10 p-5">
            <p className="font-bold text-ink">{notice.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{notice.body}</p>
          </div>
        ) : null}

        <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
          <SignInForm />
        </div>

        <div className="mt-8 rounded-3xl bg-white/70 p-6 text-sm leading-relaxed text-ink-soft">
          <p className="font-bold text-ink">Creator stores are not open yet</p>
          <p className="mt-2">
            Signing in works, and today there is little behind it: your account
            and nothing else. The store itself is being built in the open, and
            the mission page lists exactly what exists and what does not.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"
          >
            Back to the home page
          </Link>
          <Link
            href="/mission"
            className="rounded-full border-2 border-ink/15 px-6 py-3 text-sm font-bold text-ink transition hover:border-violet-brand hover:text-violet-deep"
          >
            What is built so far
          </Link>
        </div>
      </main>
    </div>
  );
}
