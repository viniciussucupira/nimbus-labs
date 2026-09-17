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
    title: "Other products",
    links: [
      { label: "Retone", href: "https://retoneai.net", external: true },
      { label: "NativeApply", href: "https://nativeapply.net", external: true },
      { label: "NativeReply", href: "https://nativereply.net", external: true },
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

      <div className="relative mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
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
