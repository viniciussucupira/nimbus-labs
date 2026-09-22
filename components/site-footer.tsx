import Link from "next/link";
import { Logo } from "@/components/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Live demo store", href: "/demo" },
      { label: "Every feature", href: "/platform" },
      { label: "Courses", href: "/platform/courses" },
      { label: "Memberships", href: "/platform/memberships" },
      { label: "Paid calls", href: "/platform/calls" },
      { label: "Your own Stripe", href: "/platform/your-stripe" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "Nimbus and Stan", href: "/proof/compare" },
      { label: "Feature by feature", href: "/proof/everything" },
      { label: "Nimbus and Gumroad", href: "/proof/gumroad" },
      { label: "Nimbus and Beacons", href: "/proof/beacons" },
      { label: "Speed test", href: "/proof/speed" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Our mission", href: "/mission" },
      { label: "What we never do", href: "/proof/promises" },
      { label: "Blog", href: "/blog" },
      { label: "Help centre", href: "/help" },
      { label: "Questions", href: "/proof/questions" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Refunds", href: "/refunds" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="surface-night on-dark overflow-hidden">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1.2fr_2.8fr] lg:py-20">
        <div className="max-w-xs">
          <Link href="/" className="inline-block rounded-[10px]" aria-label="Nimbus Labs, home">
            <Logo tone="light" />
          </Link>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/70">
            A store page for creators, built in public by Vinicius Sucupira. Your
            buyers pay into your own Stripe account.
          </p>
          <Link href="/signin" className="btn btn-light btn-sm mt-6">
            Start your store
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-white/50">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-[0.9375rem]">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-white/75 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="container-page border-t border-white/10 py-6 text-[0.8125rem] leading-relaxed text-white/55">
        <p>© 2026 Nimbus Labs. Payments are processed by Stripe on each creator&apos;s own account.</p>
        <p className="mt-1.5">
          Photographs from Unsplash, used for illustration. The people in them are
          not Nimbus Labs customers, and nothing on this site is a testimonial.
        </p>
      </div>
    </footer>
  );
}
