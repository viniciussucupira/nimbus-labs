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
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <p className="tag">
          Harbor Kitchen
        </p>

        <h1 className="t-h1 mt-6">
          Lost your download?
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Type the address you paid with. If the download is still open, we send
          the link there again — no account to create, no password to invent.
        </p>

        <div className="card mt-8 p-6 sm:p-8">
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
            className="btn btn-primary"
          >
            Back to the store
          </Link>
          <Link
            href="/help"
            className="btn btn-secondary"
          >
            Help centre
          </Link>
        </div>
      </main>
    </div>
  );
}
