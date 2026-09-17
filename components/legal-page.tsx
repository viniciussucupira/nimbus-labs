import Link from "next/link";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteNav />

      <main className="flex-1">
        <section className="nb-mesh nb-grain relative overflow-hidden text-white">
          <div
            aria-hidden="true"
            className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-sky-brand/35 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="nb-blob absolute -right-16 bottom-0 h-56 w-56 bg-amber-brand/30 blur-3xl"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-14 sm:py-16">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <span aria-hidden="true">📄</span> The small print, in plain words
            </p>
            <h1 className="font-display mt-5 text-4xl font-black sm:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-white/75">
              Effective date: August 15, 2026
              {lastUpdated ? ` · Last updated: ${lastUpdated}` : ""}
            </p>
          </div>
        </section>

        <section className="bg-cream py-14">
          <div className="mx-auto max-w-3xl px-4">
            <div className="space-y-10 rounded-3xl border-2 border-ink/10 bg-white p-6 text-[17px] leading-8 text-ink-soft shadow-xl shadow-ink/5 sm:p-10">
              {children}
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-7 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
              >
                Back to the home page
              </Link>
              <Link
                href="/demo"
                className="rounded-full border-2 border-ink/15 px-7 py-3.5 font-bold text-ink transition hover:border-violet-brand hover:text-violet-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
              >
                See the live demo store
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-display flex items-center gap-3 text-xl font-extrabold text-ink">
        <span
          aria-hidden="true"
          className="h-6 w-1.5 rounded-full bg-gradient-to-b from-violet-brand to-pink-brand"
        />
        {title}
      </h2>
      {children}
    </section>
  );
}
