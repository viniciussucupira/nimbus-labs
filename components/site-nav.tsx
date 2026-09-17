"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type MenuItem = {
  label: string;
  description: string;
  href: string;
  emoji: string;
  tint: string;
};

type Menu = {
  id: string;
  label: string;
  blurb: string;
  items: MenuItem[];
};

export const MENUS: Menu[] = [
  {
    id: "platform",
    label: "Platform",
    blurb: "Everything a link-in-bio store needs, one page at a time.",
    items: [
      {
        label: "Store page",
        description: "Your links, your products, your face. One address.",
        href: "/platform/store-page",
        emoji: "🏪",
        tint: "bg-violet-brand/10 text-violet-deep",
      },
      {
        label: "Price options",
        description: "One product, several prices. Live in the demo store.",
        href: "/platform/price-options",
        emoji: "🏷️",
        tint: "bg-pink-brand/10 text-pink-brand",
      },
      {
        label: "Instant delivery",
        description: "The file is released the second Stripe confirms.",
        href: "/platform/instant-delivery",
        emoji: "⚡",
        tint: "bg-amber-brand/15 text-amber-brand",
      },
      {
        label: "Your own Stripe",
        description: "The money lands in your account, not in ours.",
        href: "/platform/your-stripe",
        emoji: "🏦",
        tint: "bg-mint-brand/15 text-mint-deep",
      },
    ],
  },
  {
    id: "creators",
    label: "For creators",
    blurb: "Built for people who sell what they know.",
    items: [
      {
        label: "Coaches and teachers",
        description: "Worksheets, programmes, paid calls.",
        href: "/for/coaches",
        emoji: "🎓",
        tint: "bg-sky-brand/15 text-sky-brand",
      },
      {
        label: "Cooks and nutritionists",
        description: "Meal plans, grocery lists, recipe packs.",
        href: "/for/cooks",
        emoji: "🥗",
        tint: "bg-mint-brand/15 text-mint-deep",
      },
      {
        label: "Fitness creators",
        description: "Programmes, challenges, form checks.",
        href: "/for/fitness",
        emoji: "🏋️",
        tint: "bg-pink-brand/10 text-pink-brand",
      },
      {
        label: "Designers and photographers",
        description: "Presets, templates, brush packs.",
        href: "/for/designers",
        emoji: "🎨",
        tint: "bg-violet-brand/10 text-violet-deep",
      },
    ],
  },
  {
    id: "proof",
    label: "Proof",
    blurb: "See it working before you believe a word of it.",
    items: [
      {
        label: "Live demo store",
        description: "Buy with a test card and get the file.",
        href: "/demo",
        emoji: "🧪",
        tint: "bg-amber-brand/15 text-amber-brand",
      },
      {
        label: "How we compare",
        description: "Side by side with Stan, with the date we checked.",
        href: "/proof/compare",
        emoji: "📊",
        tint: "bg-violet-brand/10 text-violet-deep",
      },
      {
        label: "Speed test",
        description: "Why a slow store costs you sales.",
        href: "/proof/speed",
        emoji: "🚀",
        tint: "bg-sky-brand/15 text-sky-brand",
      },
      {
        label: "What we never do",
        description: "Our answer to what creators complain about.",
        href: "/proof/promises",
        emoji: "🤝",
        tint: "bg-mint-brand/15 text-mint-deep",
      },
      {
        label: "Questions",
        description: "Straight answers, including the awkward ones.",
        href: "/proof/questions",
        emoji: "💬",
        tint: "bg-pink-brand/10 text-pink-brand",
      },
    ],
  },
];

export function SiteNav() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("platform");
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeAll = useCallback(() => {
    setOpenMenu(null);
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, [closeAll]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const openedByClick = useRef(false);

  const hoverOpen = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (window.matchMedia("(hover: hover)").matches) {
      openedByClick.current = false;
      setOpenMenu(id);
    }
  };

  // A pointer that hovers already opened the panel, so the first click must
  // not close it again. Only a click on an open, click-opened panel closes it.
  const clickMenu = (id: string) => {
    setOpenMenu((cur) => {
      if (cur === id && openedByClick.current) {
        openedByClick.current = false;
        return null;
      }
      openedByClick.current = true;
      return id;
    });
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 160);
  };

  return (
    <div className="sticky top-0 z-50">
      <div className="nb-mesh relative overflow-hidden text-white">
        <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-medium">
          <span aria-hidden="true">✨</span>
          <span>
            Built in the open.{" "}
            <Link
              href="/demo"
              className="underline decoration-white/50 underline-offset-2 hover:decoration-white"
            >
              Try the live demo store
            </Link>{" "}
            — real Stripe checkout, test card, instant file.
          </span>
        </p>
      </div>

      <div
        ref={headerRef}
        className={`relative border-b transition-colors duration-300 ${
          scrolled
            ? "border-ink/10 bg-white/90 backdrop-blur-xl"
            : "border-transparent bg-white/70 backdrop-blur-md"
        }`}
        onMouseLeave={hoverClose}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-2xl px-1 py-1 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            onClick={closeAll}
          >
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-brand via-pink-brand to-amber-brand text-lg shadow-lg shadow-violet-brand/30"
            >
              <span className="nb-float block">☁️</span>
            </span>
            <span className="font-display text-xl font-extrabold text-ink">
              Nimbus
            </span>
          </Link>

          <nav
            aria-label="Main"
            className="hidden items-center gap-1 lg:flex"
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
            }}
          >
            {MENUS.map((menu) => (
              <button
                key={menu.id}
                type="button"
                aria-expanded={openMenu === menu.id}
                aria-controls={`menu-${menu.id}`}
                onMouseEnter={() => hoverOpen(menu.id)}
                onClick={() => clickMenu(menu.id)}
                className={`flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand ${
                  openMenu === menu.id
                    ? "bg-lilac text-violet-deep"
                    : "text-ink-soft hover:bg-lilac hover:text-violet-deep"
                }`}
              >
                {menu.label}
                <span
                  aria-hidden="true"
                  className={`text-[10px] transition-transform ${
                    openMenu === menu.id ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>
            ))}
            <a
              href="#pricing"
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-lilac hover:text-violet-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/demo"
              className="hidden rounded-full border-2 border-ink/10 px-4 py-2 text-sm font-semibold text-ink transition hover:border-violet-brand hover:text-violet-deep sm:inline-block focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            >
              Live demo
            </Link>
            <Link
              href="/creators"
              className="rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-violet-brand/30 transition hover:shadow-xl hover:shadow-pink-brand/30 sm:px-5 sm:text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            >
              <span className="sm:hidden">Early access</span>
              <span className="hidden sm:inline">Get early access</span>
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              className="grid h-10 w-10 place-items-center rounded-2xl border-2 border-ink/10 text-ink lg:hidden focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            >
              <span className="sr-only">Menu</span>
              <span aria-hidden="true" className="text-lg">
                {drawerOpen ? "✕" : "☰"}
              </span>
            </button>
          </div>
        </div>

        {/* Desktop mega menu: anchored to the header box, so it can never
            fall outside the screen, however narrow the window is. */}
        {MENUS.filter((menu) => openMenu === menu.id).map((menu) => (
          <div
            key={menu.id}
            id={`menu-${menu.id}`}
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
            }}
            className="absolute inset-x-0 top-full hidden px-4 lg:block"
          >
            <div className="nb-pop mx-auto max-w-6xl overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-2xl shadow-ink/10">
              <div className="grid gap-6 p-6 md:grid-cols-[1fr_2fr]">
                <div className="rounded-2xl bg-lilac p-5">
                  <p className="font-display text-lg font-extrabold text-ink">
                    {menu.label}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">{menu.blurb}</p>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {menu.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeAll}
                        className="flex h-full gap-3 rounded-2xl p-3 transition hover:bg-lilac focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${item.tint}`}
                        >
                          {item.emoji}
                        </span>
                        <span>
                          <span className="block font-semibold text-ink">
                            {item.label}
                          </span>
                          <span className="block text-sm text-ink-soft">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile drawer */}
      <div
        id="mobile-drawer"
        className={`fixed inset-x-0 bottom-0 top-[104px] z-50 overflow-y-auto bg-white px-4 pb-10 pt-4 lg:hidden ${
          drawerOpen ? "" : "hidden"
        }`}
      >
        <ul className="space-y-3">
          {MENUS.map((menu) => (
            <li
              key={menu.id}
              className="overflow-hidden rounded-3xl border-2 border-ink/10"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenSection((cur) => (cur === menu.id ? null : menu.id))
                }
                aria-expanded={openSection === menu.id}
                className="flex w-full items-center justify-between gap-3 bg-lilac px-5 py-4 text-left font-display text-lg font-extrabold text-ink"
              >
                {menu.label}
                <span aria-hidden="true">
                  {openSection === menu.id ? "−" : "+"}
                </span>
              </button>
              {openSection === menu.id && (
                <ul className="divide-y divide-ink/5 p-2">
                  {menu.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeAll}
                        className="flex gap-3 rounded-2xl p-3"
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${item.tint}`}
                        >
                          {item.emoji}
                        </span>
                        <span>
                          <span className="block font-semibold text-ink">
                            {item.label}
                          </span>
                          <span className="block text-sm text-ink-soft">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          <li>
            <a
              href="#pricing"
              onClick={closeAll}
              className="block rounded-3xl border-2 border-ink/10 px-5 py-4 font-display text-lg font-extrabold text-ink"
            >
              Pricing
            </a>
          </li>
          <li>
            <Link
              href="/creators"
              onClick={closeAll}
              className="block rounded-3xl bg-gradient-to-r from-violet-brand to-pink-brand px-5 py-4 text-center font-bold text-white"
            >
              Get early access
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
