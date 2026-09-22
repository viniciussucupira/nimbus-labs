import Link from "next/link";
import { Icon } from "./icons";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refunds", label: "Refund Policy" },
];

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
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteNav />

      <main id="content" className="flex-1">
        <section className="border-b border-line bg-white">
          <div className="container-narrow py-14 sm:py-20">
            <p className="eyebrow">The small print, in plain words</p>
            <h1 className="t-h1 mt-4">{title}</h1>
            <p className="mt-4 text-[0.9375rem] text-ink-mute">
              Effective date: August 15, 2026
              {lastUpdated ? ` · Last updated: ${lastUpdated}` : ""}
            </p>
            <nav aria-label="Legal pages" className="mt-8 flex flex-wrap gap-2">
              {LEGAL_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`tag h-9 px-3 text-[0.875rem] transition-colors hover:bg-sand-deep ${
                    l.label === title ? "tag-brand" : ""
                  }`}
                  aria-current={l.label === title ? "page" : undefined}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container-narrow">
            <div className="legal-body space-y-10 text-[1.0625rem] leading-[1.8] text-ink-soft">{children}</div>

            <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-line pt-8">
              <Link href="/" className="btn btn-secondary">
                Back to the home page
              </Link>
              <Link href="/help" className="link-arrow">
                Questions? The help centre
                <Icon name="arrow-right" size={16} className="arrow" />
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
      <h2 className="text-[1.3rem] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  );
}
