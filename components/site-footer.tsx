import Link from "next/link";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Live demo store", href: "/demo" },
      { label: "How the money works", href: "/#money" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Compared with Stan", href: "/#compare" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Our mission", href: "/mission" },
      { label: "Blog", href: "/blog" },
      { label: "Help centre", href: "/help" },
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
    <footer className="relative overflow-hidden bg-ink px-4 py-16 text-white/80">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-24 -top-16 h-64 w-64 bg-violet-brand/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-0 h-64 w-64 bg-pink-brand/25 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Link
            href="/"
            className="font-display flex items-center gap-2 text-xl font-extrabold text-white"
          >
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-brand via-pink-brand to-amber-brand text-lg"
            >
              ☁️
            </span>
            Nimbus Labs
          </Link>
          <p className="mt-3 text-sm">
            A store page for creators, built in public by Vinicius Sucupira.
          </p>
          <Link
            href="/creators"
            className="mt-5 inline-block rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Get early access
          </Link>

          <div className="mt-6">
            <p className="text-sm font-semibold text-white">
              Follow the build
            </p>
            <a
              href="https://x.com/vinicius26108"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @vinicius26108
            </a>
            <p className="mt-2 text-xs text-white/50">
              The founder&apos;s account. Nimbus has no others yet.
            </p>
          </div>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="font-semibold text-white">{column.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  {"external" in link && link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition hover:text-white"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="transition hover:text-white">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-xs text-white/50">
        <p>© 2026 Nimbus Labs. Early access, not a finished product.</p>
        <p className="mt-2">
          Photographs from Unsplash, used for illustration. The people in them
          are not Nimbus Labs customers, and nothing on this site is a
          testimonial.
        </p>
      </div>
    </footer>
  );
}
