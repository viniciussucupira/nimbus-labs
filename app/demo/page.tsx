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
  { label: "Free recipe of the week", href: "#free-recipe" },
  { label: "About Jenny", href: "#about" },
];

export default function DemoStorePage() {
  const p = DEMO_PRODUCT;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <p className="bg-amber-200 px-4 py-2 text-center text-sm text-stone-900">
        Demo store in test mode. No real money moves. Pay with card{" "}
        <span className="font-mono font-semibold whitespace-nowrap">
          4242 4242 4242 4242
        </span>
        , any future date, any CVC.
      </p>

      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-10">
        <header className="flex flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-teal-800 text-3xl font-bold text-white shadow-sm"
          >
            HK
          </div>
          <h1 className="mt-4 text-2xl font-bold">Harbor Kitchen</h1>
          <p className="mt-1 text-stone-700">
            Simple family meals by Jenny. Plans, grocery lists and recipes.
          </p>
        </header>

        <nav aria-label="Creator links" className="mt-8">
          <ul className="space-y-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block rounded-2xl border border-stone-300 bg-white px-5 py-4 text-center font-medium shadow-sm transition hover:border-stone-500 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section
          aria-labelledby="product-title"
          className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200"
        >
          <div
            aria-hidden="true"
            className="flex aspect-[16/9] flex-col justify-end bg-gradient-to-br from-teal-800 to-teal-950 p-6 text-white"
          >
            <span className="text-sm uppercase tracking-wider text-teal-100">
              Printable PDF
            </span>
            <span className="text-3xl font-bold leading-tight">
              Weekly
              <br />
              Meal Planner
            </span>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 id="product-title" className="text-xl font-bold">
                {p.name}
              </h2>
              <p className="text-right text-xl font-bold">
                <span className="block text-sm font-medium text-stone-600">
                  from
                </span>
                {formatPrice(LOWEST_PRICE_CENTS)}
              </p>
            </div>
            <p className="mt-2 text-stone-700">{p.description}</p>

            <ul className="mt-4 space-y-2 text-stone-800">
              {p.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="mt-1 h-4 w-4 flex-none fill-teal-700"
                  >
                    <path d="M8.1 14.3 3.8 10l1.4-1.4 2.9 2.9 6.7-6.7 1.4 1.4z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <form action="/api/demo/checkout" method="post" className="mt-6">
              <fieldset>
                <legend className="font-semibold">Choose your plan</legend>
                <div className="mt-3 space-y-3">
                  {p.options.map((option, index) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 transition hover:border-stone-500 has-[:checked]:border-teal-800 has-[:checked]:bg-teal-50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-800"
                    >
                      <input
                        type="radio"
                        name="option"
                        value={option.id}
                        defaultChecked={index === 0}
                        className="h-5 w-5 flex-none accent-teal-800"
                      />
                      <span className="flex-1">
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-sm text-stone-600">
                          {option.detail}
                        </span>
                      </span>
                      <span className="font-bold">
                        {formatPrice(option.priceCents)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                className="mt-5 w-full rounded-full bg-teal-800 px-6 py-4 text-lg font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                Continue to checkout
              </button>
            </form>
            <p className="mt-3 text-center text-sm text-stone-600">
              Secure checkout by Stripe. Money goes straight to the creator.
            </p>
          </div>
        </section>

        <section
          id="free-recipe"
          aria-labelledby="free-recipe-title"
          className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
        >
          <h2 id="free-recipe-title" className="text-lg font-bold">
            Free recipe of the week: 10-minute tomato soup
          </h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-stone-800">
            <li>Warm 1 can of crushed tomatoes with 1 cup of broth.</li>
            <li>Add garlic powder, salt and a splash of cream.</li>
            <li>Blend, then serve with grilled cheese.</li>
          </ol>
        </section>

        <section
          id="about"
          aria-labelledby="about-title"
          className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
        >
          <h2 id="about-title" className="text-lg font-bold">
            About Jenny
          </h2>
          <p className="mt-3 text-stone-800">
            Jenny is a fictional creator made up for this demo. Harbor Kitchen
            shows how a creator store on Nimbus Labs looks and works.
          </p>
        </section>

        <footer className="mt-10 text-center text-sm text-stone-600">
          <p>
            Store built with{" "}
            <Link
              href="/creators"
              className="inline-block py-2 font-medium text-stone-900 underline underline-offset-2"
            >
              Nimbus Labs
            </Link>
          </p>
          <p className="mt-1 flex justify-center gap-5">
            <Link href="/terms" className="inline-block py-2 underline underline-offset-2">
              Terms
            </Link>
            <Link href="/privacy" className="inline-block py-2 underline underline-offset-2">
              Privacy
            </Link>
            <Link href="/refunds" className="inline-block py-2 underline underline-offset-2">
              Refunds
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
