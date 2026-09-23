import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
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

const UNSPLASH = "https://images.unsplash.com/";

/*
 * Pages lifted straight out of the PDF a buyer receives.
 *
 * They are the only proof on this page that the file is a real file, so they
 * are shown large enough to read a heading off, with the page named under
 * each one. A thumbnail too small to make out proves nothing.
 */
const PREVIEWS = [
  { src: "/demo/week1-1.webp", label: "1 week — the plan", alt: "Page one: the weekly table and the grocery list" },
  { src: "/demo/five-1.webp", label: "5 weeks — week one", alt: "Week one of the five-week planner" },
  { src: "/demo/five-2.webp", label: "5 weeks — week two", alt: "Week two of the five-week planner" },
  { src: "/demo/five-3.webp", label: "5 weeks — week three", alt: "Week three of the five-week planner" },
];

const LINKS = [
  {
    label: "Free recipe of the week",
    href: "#free-recipe",
    icon: "utensils" as const,
  },
  {
    label: "About Jenny",
    href: "#about",
    icon: "user" as const,
  },
];

export default function DemoStorePage() {
  const p = DEMO_PRODUCT;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <p className="flex flex-col items-center justify-center gap-0.5 bg-night px-4 py-2.5 text-center text-[0.8125rem] leading-5 text-white/80 sm:flex-row sm:gap-2">
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="rounded-[5px] bg-white/12 px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white">
            Demo
          </span>
          Stripe test mode, no real money moves.
        </span>
        <span>
          Pay with <span className="font-mono font-semibold text-white">4242 4242 4242 4242</span>, any date, any CVC.
        </span>
      </p>

      <div className="relative mx-auto w-full max-w-md">
        <img
          src={`${UNSPLASH}photo-1543352632-5a4b24e4d2a6?auto=format&fit=crop&w=700&h=360&q=65`}
          alt="Glass containers filled with rice, corn, olives and tomato, prepared for the week"
          width={700}
          height={360}
          className="h-40 w-full bg-sand-deep object-cover sm:rounded-b-[var(--r-lg)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper via-paper/10 to-transparent sm:rounded-b-[var(--r-lg)]"
        />
      </div>

      <main id="content" className="relative mx-auto w-full max-w-md px-4 pb-12">
        <header className="relative -mt-14 overflow-hidden pb-8 pt-1 text-center">
          <div className="relative flex flex-col items-center">
            <img
              src={`${UNSPLASH}photo-1543871595-e11129e271cc?auto=format&fit=crop&crop=faces&w=224&h=224&q=70`}
              alt="Jenny, the fictional cook behind this demo store: a woman with long dark hair, smiling"
              width={224}
              height={224}
              className="h-28 w-28 rounded-full bg-sand-deep object-cover shadow-[var(--shadow-md)] ring-4 ring-paper"
            />
            <h1 className="mt-4 text-[1.9rem] font-semibold tracking-[-0.035em]">
              Harbor Kitchen
            </h1>
            <p className="mt-1 text-ink-soft">
              Simple family meals by Jenny. Plans, grocery lists and recipes.
            </p>
            <p className="tag tag-live mt-4">Files delivered the second you pay</p>
          </div>
        </header>

        <nav aria-label="Creator links" className="-mt-2">
          <ul className="space-y-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="card card-hover flex min-h-[60px] items-center gap-3 px-4 py-3 font-medium"
                >
                  <span className="icon-tile icon-tile-sm">
                    <Icon name={link.icon} size={18} />
                  </span>
                  <span className="flex-1">{link.label}</span>
                  <Icon name="chevron-right" size={18} className="text-ink-mute" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section
          aria-labelledby="product-title"
          className="card mt-8 overflow-hidden"
        >
          <div className="relative flex aspect-[16/9] flex-col justify-end overflow-hidden p-6 text-white">
            <img
              src={`${UNSPLASH}photo-1535473895227-bdecb20fb157?auto=format&fit=crop&w=700&h=394&q=65`}
              alt="A table seen from above, covered with prepared dishes and vegetables"
              width={700}
              height={394}
              className="absolute inset-0 h-full w-full bg-sand-deep object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/35 to-transparent"
            />
            <span className="relative text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-white/80">
              Printable PDF
            </span>
            <span className="relative text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.035em]">
              Weekly
              <br />
              Meal Planner
            </span>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 id="product-title" className="text-xl font-semibold tracking-[-0.02em]">
                {p.name}
              </h2>
              <p className="text-right text-2xl font-semibold tracking-[-0.03em] text-ink">
                <span className="block text-sm font-normal text-ink-mute">
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
                <legend className="font-semibold">
                  Choose your plan
                </legend>
                <div className="mt-3 space-y-3">
                  {p.options.map((option, index) => (
                    <label
                      key={option.id}
                      className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-[var(--r-md)] border border-line-strong bg-white px-4 py-3 transition-colors hover:border-violet-brand/60 has-[:checked]:border-violet-brand has-[:checked]:bg-lilac has-[:checked]:shadow-[0_0_0_3px_rgba(90,54,238,0.12)] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-brand"
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
                      <span className="font-semibold">
                        {formatPrice(option.priceCents)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                className="btn btn-primary btn-lg mt-5 btn-block"
              >
                Continue to checkout
              </button>
            </form>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-ink-mute">
              <Icon name="lock" size={14} /> Secure checkout by Stripe. The money goes straight to the creator.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="inside-title"
          className="card mt-8 p-6"
        >
          <h2
            id="inside-title"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            What is inside
          </h2>
          <p className="mt-2 flex items-center justify-between gap-3 text-sm text-ink-soft">
            <span>Real pages from the file you receive, not a mock-up.</span>
            <span className="shrink-0 text-ink-mute">{`Swipe · ${PREVIEWS.length} pages`}</span>
          </p>
          <ul tabIndex={0} aria-label="Pages from the file" className="nb-no-scrollbar -mx-2 mt-4 flex snap-x gap-4 overflow-x-auto px-2 pb-1">
            {PREVIEWS.map((preview) => (
              <li key={preview.src} className="shrink-0 snap-start">
                <figure className="m-0">
                  <img
                    src={preview.src}
                    alt={preview.alt}
                    width={420}
                    height={544}
                    loading="lazy"
                    decoding="async"
                    className="h-64 w-auto rounded-[10px] border border-line bg-white shadow-[var(--shadow-sm)] sm:h-72"
                  />
                  <figcaption className="mt-2 text-[0.8125rem] text-ink-mute">{preview.label}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="free-recipe"
          aria-labelledby="free-recipe-title"
          className="card mt-8 p-6"
        >
          <h2
            id="free-recipe-title"
            className="text-lg font-semibold"
          >
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
          className="mt-8 rounded-[var(--r-lg)] border border-line bg-sand p-6"
        >
          <h2
            id="about-title"
            className="text-lg font-semibold"
          >
            About Jenny
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
              className="link inline-block py-2"
            >
              Nimbus Labs
            </Link>
          </p>
          <p className="mt-1">
            <Link
              href="/demo/recover"
              className="link inline-block py-2"
            >
              Bought this already and lost the file?
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
