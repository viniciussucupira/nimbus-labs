import type { Metadata } from "next";
import Link from "next/link";
import { CreatorResearchForm } from "@/components/creator-research-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { SUPPORT_EMAIL } from "@/lib/creator-research";

export const metadata: Metadata = {
  title: "Selling digital products? Tell me what's broken — Nimbus Labs",
  description:
    "Nimbus Labs is talking to creators who sell guides, courses, templates and paid calls before building its next tool. Share what's hard about selling online.",
};

const PROMISES = [
  {
    emoji: "🔒",
    title: "Only to decide what gets built",
    body: "Your answers are used for that and nothing else.",
    tint: "bg-violet-brand/10 text-violet-deep",
  },
  {
    emoji: "🙅",
    title: "Never sold, never shared",
    body: "They do not go to anyone else's marketing list. Ever.",
    tint: "bg-pink-brand/10 text-pink-brand",
  },
  {
    emoji: "✉️",
    title: "E-mail only if you ticked a box",
    body: "And only about what that box says.",
    tint: "bg-amber-brand/15 text-amber-brand",
  },
  {
    emoji: "🗑️",
    title: "Deleted whenever you ask",
    body: `Write to ${SUPPORT_EMAIL} and they are gone.`,
    tint: "bg-mint-brand/15 text-mint-brand",
  },
];

export default function CreatorsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteNav />

      <main className="flex-1">
        <section className="nb-mesh nb-grain relative overflow-hidden text-white">
          <div
            aria-hidden="true"
            className="nb-blob absolute -left-20 top-0 h-64 w-64 bg-pink-brand/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="nb-blob absolute -right-16 bottom-0 h-72 w-72 bg-sky-brand/30 blur-3xl"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-16 sm:py-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <span aria-hidden="true">🎤</span> Creator research
            </p>
            <h1 className="font-display mt-5 text-4xl font-black leading-[1.08] sm:text-5xl">
              Selling digital products?{" "}
              <span className="nb-gradient-text">Tell me what&apos;s broken.</span>
            </h1>
            <div className="mt-6 space-y-4 text-lg text-white/85">
              <p>
                I&apos;m Vinicius, the founder of Nimbus Labs. Before we build
                our next tool, I&apos;m talking to creators who sell guides,
                courses, templates and paid calls from their link in bio.
              </p>
              <p>
                This is not a sales page. There is nothing to buy. I want to
                know what is hard about selling online today, in your own words.
              </p>
            </div>
            <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur">
              <span aria-hidden="true">⏱️</span> Two minutes, eight questions,
              four of them optional
            </p>
          </div>
        </section>

        <section className="bg-cream py-14">
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-xl shadow-ink/5 sm:p-10">
              <CreatorResearchForm />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="font-display text-center text-3xl font-black">
            What happens with your answers
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PROMISES.map((item) => (
              <article
                key={item.title}
                className="nb-lift rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-lg shadow-ink/5"
              >
                <span
                  aria-hidden="true"
                  className={`grid h-12 w-12 place-items-center rounded-2xl text-xl ${item.tint}`}
                >
                  {item.emoji}
                </span>
                <h3 className="font-display mt-4 text-lg font-extrabold">
                  {item.title}
                </h3>
                <p className="mt-1 break-words text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link
              href="/demo"
              className="rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-7 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            >
              See the live demo store
            </Link>
            <Link
              href="/"
              className="rounded-full border-2 border-ink/15 px-7 py-3.5 font-bold text-ink transition hover:border-violet-brand hover:text-violet-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            >
              Back to the home page
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
