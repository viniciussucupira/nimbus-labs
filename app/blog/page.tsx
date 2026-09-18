import type { Metadata } from "next";
import Link from "next/link";
import { BlogBrowser } from "@/components/blog-browser";
import { RevealOnScroll } from "@/components/home-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import {
  BLOG_CATEGORIES,
  featuredPost,
  formatPostDate,
  postsSorted,
} from "@/lib/blog";

export const metadata: Metadata = {
  title: "The Nimbus Journal — selling digital products without the guesswork",
  description:
    "Plain guides on selling files, plans and calls from a link in your bio: what to charge, what the page has to say, where the money lands, and what every platform costs you per sale.",
};

export default function BlogIndexPage() {
  const featured = featuredPost();
  const rest = postsSorted().filter((post) => post.slug !== featured.slug);

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content" className="flex-1">
        {/* ---------------- header ---------------- */}
        <section className="nb-mesh nb-grain relative overflow-hidden text-white">
          <div
            aria-hidden="true"
            className="nb-blob absolute -left-24 top-0 h-72 w-72 bg-amber-brand/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="nb-blob absolute -right-20 bottom-0 h-72 w-72 bg-mint-brand/25 blur-3xl"
          />
          <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:py-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <span aria-hidden="true">📓</span> The Nimbus Journal
            </p>
            <h1 className="font-display mt-5 text-4xl font-black leading-[1.05] sm:text-6xl">
              Everything we learn about{" "}
              <span className="nb-gradient-text">selling your own work</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
              No hacks, no invented case studies. What to charge, what the page
              has to say, where the money lands, and what each platform really
              costs you on a sale.
            </p>
          </div>
        </section>

        {/* ---------------- featured ---------------- */}
        {featured ? (
          <section className="mx-auto max-w-6xl px-4 py-14">
            <article className="reveal relative overflow-hidden rounded-[2rem] shadow-[0_30px_70px_rgba(20,15,61,0.18)]">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `linear-gradient(130deg, ${featured.from}, ${featured.to})`,
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.28),transparent_55%)]"
              />
              <div className="relative grid gap-8 p-8 text-white sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
                <div>
                  <p className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur">
                    Start here
                  </p>
                  <h2 className="font-display mt-4 text-3xl font-black leading-tight sm:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 max-w-xl text-white/90">
                    {featured.excerpt}
                  </p>
                  <p className="mt-5 text-sm font-semibold text-white/75">
                    {featured.category} · {formatPostDate(featured.date)} ·{" "}
                    {featured.readMinutes} min read
                  </p>
                  <Link
                    href={`/blog/${featured.slug}`}
                    className="mt-7 inline-block rounded-full bg-white px-7 py-3.5 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5"
                  >
                    Read the article →
                  </Link>
                </div>

                <ul className="space-y-3 rounded-3xl bg-white/12 p-6 backdrop-blur">
                  {[
                    "What to sell when you have never sold anything",
                    "The price that makes the decision easy",
                    "The six lines a product page needs",
                    "What has to happen the second someone pays",
                  ].map((line) => (
                    <li key={line} className="flex gap-3 text-sm font-semibold">
                      <span aria-hidden="true">→</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </section>
        ) : null}

        {/* ---------------- all articles ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="font-display text-3xl font-black text-ink sm:text-4xl">
            More to explore
          </h2>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Pick a subject or search for a word. Every article is written by us
            and says where its facts come from.
          </p>

          <div className="mt-8">
            <BlogBrowser posts={rest} categories={[...BLOG_CATEGORIES]} />
          </div>
        </section>

        {/* ---------------- newsletter ---------------- */}
        <section className="px-4 pb-20">
          <div className="reveal relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-ink p-8 text-white sm:p-12">
            <div
              aria-hidden="true"
              className="nb-blob absolute -left-16 -top-16 h-56 w-56 bg-violet-brand/40 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="nb-blob absolute -bottom-20 right-0 h-56 w-56 bg-pink-brand/35 blur-3xl"
            />
            <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <h2 className="font-display text-3xl font-black sm:text-4xl">
                  Want an email when Nimbus opens?
                </h2>
                <p className="mt-4 text-white/80">
                  Leave your address on the early access page. We write when
                  there is something real to say — a page you can use, a feature
                  that shipped, a number we measured. Nothing else, and you can
                  leave at any time.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/creators"
                    className="rounded-full bg-white px-7 py-3.5 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5"
                  >
                    Get early access
                  </Link>
                  <Link
                    href="/demo"
                    className="rounded-full border-2 border-white/70 px-7 py-3.5 font-bold text-white transition hover:bg-white hover:text-violet-deep"
                  >
                    Open the live demo store
                  </Link>
                </div>
              </div>

              <ul className="space-y-3 rounded-3xl bg-white/10 p-6 text-sm font-semibold backdrop-blur">
                {[
                  "We only email you if you tick the box.",
                  "No sharing your address with anyone.",
                  "One link in every email to stop them for good.",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <span aria-hidden="true">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
