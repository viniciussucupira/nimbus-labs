import { Children, isValidElement } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

/** An anchor for a section, from its title: "3. Selling through a store" → "selling-through-a-store". */
function sectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
  // The sections, read from the page itself, so the index can never list one
  // that is not there.
  const sections = Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === LegalSection)
    .map((child) => (child as React.ReactElement<{ title: string }>).props.title);
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
            {sections.length > 2 ? (
              <nav aria-labelledby="legal-contents" className="mb-12 rounded-[var(--r-md)] border border-line bg-white p-5 sm:p-6">
                <p id="legal-contents" className="text-sm font-bold uppercase tracking-[0.08em] text-ink-mute">
                  On this page
                </p>
                <ol className="mt-3 grid gap-x-8 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
                  {sections.map((t) => (
                    <li key={t}>
                      <a href={`#${sectionId(t)}`} className="text-ink-soft underline-offset-4 hover:text-violet-deep hover:underline">
                        {t}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
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
    <section id={sectionId(title)} className="scroll-mt-24 space-y-4">
      <h2 className="text-[1.3rem] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  );
}
