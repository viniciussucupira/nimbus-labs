import type { Metadata } from "next";
import Link from "next/link";
import {
  DEMO_PRODUCT,
  LOWEST_PRICE_CENTS,
  formatPrice,
} from "@/lib/demo-store";

export const metadata: Metadata = {
  title: "Harbor Kitchen — demo creator store by Nimbus Labs",
  description:
    "A demo link-in-bio store. Buy a sample PDF in Stripe test mode and download it right after payment.",
};

const LINKS = [
  {
    label: "Free recipe of the week",
    href: "#free-recipe",
    emoji: "🍅",
    tint: "bg-amber-brand/15 text-amber-brand",
  },
  {
    label: "About Jenny",
    href: "#about",
    emoji: "🙋",
    tint: "bg-pink-brand/10 text-pink-brand",
  },
];

export default function DemoStorePage() {
  const p = DEMO_PRODUCT;

  return (
    <div className="min-h-screen bg-cream text-ink">
      <p className="nb-mesh px-4 py-2.5 text-center text-sm text-white">
        Demo store in test mode. No real money moves. Pay with card{" "}
        <span className="font-mono font-semibold whitespace-nowrap">
          4242 4242 4242 4242
        </span>
        , any future date, any CVC.
      </p>

      <main className="relative mx-auto w-full max-w-md px-4 pb-12">
        <header className="relative -mx-4 overflow-hidden px-4 pb-10 pt-10 text-center">
          <div
            aria-hidden="true"
            className="nb-blob absolute -left-10 top-0 h-40 w-40 bg-mint-brand/30 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="nb-blob absolute -right-8 top-10 h-40 w-40 bg-violet-brand/25 blur-2xl"
          />
          <div className="relative flex flex-col items-center">
            <div
              aria-hidden="true"
              className="nb-float grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-mint-brand via-sky-brand to-violet-brand text-3xl font-bold text-white shadow-xl shadow-violet-brand/20"
            >
              HK
            </div>
            <h1 className="font-display mt-4 text-3xl font-black">
              Harbor Kitchen
            </h1>
            <p className="mt-1 text-ink-soft">
              Simple family meals by Jenny. Plans, grocery lists and recipes.
            </p>
          </div>
        </header>

        <nav aria-label="Creator links" className="-mt-2">
          <ul className="space-y-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="nb-lift flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white px-5 py-4 font-semibold shadow-sm transition hover:border-violet-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${link.tint}`}
                  >
                    {link.emoji}
                  </span>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section
          aria-labelledby="product-title"
          className="mt-8 overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-xl shadow-ink/5"
        >
          <div
            aria-hidden="true"
            className="relative flex aspect-[16/9] flex-col justify-end overflow-hidden bg-gradient-to-br from-violet-brand via-pink-brand to-amber-brand p-6 text-white"
          >
            <div className="nb-blob absolute -right-6 -top-8 h-32 w-32 bg-white/25 blur-xl" />
            <span className="relative text-sm font-semibold uppercase tracking-wider text-white/85">
              Printable PDF
            </span>
            <span className="font-display relative text-3xl font-black leading-tight">
              Weekly
              <br />
              Meal Planner
            </span>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 id="product-title" className="font-display text-xl font-extrabold">
                {p.name}
              </h2>
              <p className="text-right font-display text-2xl font-black text-violet-deep">
                <span className="block text-sm font-semibold text-ink-soft">
                  from
                </span>
                {formatPrice(LOWEST_PRICE_CENTS)}
              </p>
            </div>
            <p className="mt-2 text-ink-soft">{p.description}</p>

            <ul className="mt-4 space-y-2">
              {p.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="mt-1 h-4 w-4 flex-none fill-mint-brand"
                  >
                    <path d="M8.1 14.3 3.8 10l1.4-1.4 2.9 2.9 6.7-6.7 1.4 1.4z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <form action="/api/demo/checkout" method="post" className="mt-6">
              <fieldset>
                <legend className="font-display font-extrabold">
                  Choose your plan
                </legend>
                <div className="mt-3 space-y-3">
                  {p.options.map((option, index) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink/10 px-4 py-3 transition hover:border-violet-brand/60 has-[:checked]:border-violet-brand has-[:checked]:bg-lilac has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-brand"
                    >
                      <input
                        type="radio"
                        name="option"
                        value={option.id}
                        defaultChecked={index === 0}
                        className="h-5 w-5 flex-none accent-[color:var(--violet)]"
                      />
                      <span className="flex-1">
                        <span className="block font-semibold">{option.label}</span>
                        <span className="block text-sm text-ink-soft">
                          {option.detail}
                        </span>
                      </span>
                      <span className="font-display font-black">
                        {formatPrice(option.priceCents)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                className="mt-5 w-full rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-6 py-4 text-lg font-bold text-white shadow-lg shadow-violet-brand/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
              >
                Continue to checkout
              </button>
            </form>
            <p className="mt-3 text-center text-sm text-ink-soft">
              Secure checkout by Stripe. Money goes straight to the creator.
            </p>
          </div>
        </section>

        <section
          id="free-recipe"
          aria-labelledby="free-recipe-title"
          className="mt-8 rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-lg shadow-ink/5"
        >
          <h2
            id="free-recipe-title"
            className="font-display flex items-center gap-2 text-lg font-extrabold"
          >
            <span aria-hidden="true">🍅</span>
            Free recipe of the week: 10-minute tomato soup
          </h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-soft">
            <li>Warm 1 can of crushed tomatoes with 1 cup of broth.</li>
            <li>Add garlic powder, salt and a splash of cream.</li>
            <li>Blend, then serve with grilled cheese.</li>
          </ol>
        </section>

        <section
          id="about"
          aria-labelledby="about-title"
          className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-mint-brand/20 via-sky-brand/15 to-violet-brand/15 p-6"
        >
          <h2
            id="about-title"
            className="font-display flex items-center gap-2 text-lg font-extrabold"
          >
            <span aria-hidden="true">🙋</span> About Jenny
          </h2>
          <p className="mt-3 text-ink-soft">
            Jenny is a fictional creator made up for this demo. Harbor Kitchen
            shows how a creator store on Nimbus Labs looks and works.
          </p>
        </section>

        <footer className="mt-10 text-center text-sm text-ink-soft">
          <p>
            Store built with{" "}
            <Link
              href="/"
              className="inline-block py-2 font-bold text-violet-deep underline underline-offset-2"
            >
              Nimbus Labs
            </Link>
          </p>
          <p className="mt-1 flex justify-center gap-5">
            <Link
              href="/terms"
              className="inline-block py-2 underline underline-offset-2 hover:text-violet-deep"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="inline-block py-2 underline underline-offset-2 hover:text-violet-deep"
            >
              Privacy
            </Link>
            <Link
              href="/refunds"
              className="inline-block py-2 underline underline-offset-2 hover:text-violet-deep"
            >
              Refunds
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
