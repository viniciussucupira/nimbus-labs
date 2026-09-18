import type { Metadata } from "next";
import Link from "next/link";
import { RecoverForm } from "@/components/recover-form";

export const metadata: Metadata = {
  title: "Lost your download? — Harbor Kitchen demo store",
  description:
    "Type the email you paid with and the download link is sent again. No account, no password.",
  robots: { index: false, follow: false },
};

export default function DemoRecoverPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-violet-brand/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-0 h-64 w-64 bg-amber-brand/25 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft shadow-sm">
          <span aria-hidden="true">📩</span> Harbor Kitchen
        </p>

        <h1 className="font-display mt-5 text-4xl font-black leading-tight sm:text-5xl">
          Lost your download?
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Type the address you paid with. If the download is still open, we send
          the link there again — no account to create, no password to invent.
        </p>

        <div className="mt-8 rounded-[2rem] border-2 border-ink/5 bg-white p-6 shadow-xl shadow-ink/5 sm:p-8">
          <RecoverForm />
        </div>

        <div className="mt-8 rounded-3xl bg-white/70 p-6 text-sm leading-relaxed text-ink-soft">
          <p className="font-bold text-ink">Why the link expires at all</p>
          <p className="mt-2">
            A link that never dies is a link that can be pasted anywhere and
            turn one sale into a hundred free copies. So it lasts three days and
            belongs to one order. This page is how you get it back without
            paying for it twice.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"
          >
            Back to the store
          </Link>
          <Link
            href="/help"
            className="rounded-full border-2 border-ink/15 px-6 py-3 text-sm font-bold text-ink transition hover:border-violet-brand hover:text-violet-deep"
          >
            Help centre
          </Link>
        </div>
      </main>
    </div>
  );
}
