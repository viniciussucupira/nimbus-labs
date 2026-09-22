import type { Metadata } from "next";
import Link from "next/link";
import { Icon, iconFor } from "@/components/icons";
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
    tint: "bg-mint-brand/15 text-mint-deep",
  },
];

export default function CreatorsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteNav />

      <main id="content" className="flex-1">
        <section className="surface-night nb-grid-lines on-dark overflow-hidden">
          <div className="container-narrow py-16 sm:py-24">
            <p className="eyebrow">Creator research</p>
            <h1 className="t-h1 balance mt-5 text-white">
              Selling digital products?{" "}
              <span className="serif font-normal text-[#cfc4ff]">Tell me what&apos;s broken.</span>
            </h1>
            <div className="t-lead mt-6 max-w-2xl space-y-4 text-white/75">
              <p>
                I&apos;m Vinicius, the founder of Nimbus Labs. Before we build our next tool, I&apos;m talking to creators
                who sell guides, courses, templates and paid calls from their link in bio.
              </p>
              <p>
                This is not a sales page. There is nothing to buy. I want to know what is hard about selling online today,
                in your own words.
              </p>
            </div>
            <p className="mt-8 flex items-center gap-2 text-[0.9375rem] text-white/70">
              <Icon name="clock" size={18} className="text-[#b9a8ff]" />
              Two minutes, eight questions, four of them optional
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container-narrow">
            <div className="card p-6 sm:p-10">
              <CreatorResearchForm />
            </div>
          </div>
        </section>

        <section className="surface-sand section-tight">
          <div className="container-page">
            <h2 className="t-h2 text-center">What happens with your answers</h2>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
              {PROMISES.map((item) => (
                <article key={item.title} className="card-flat flex gap-4 p-6">
                  <span className="icon-tile">
                    <Icon name={iconFor(item.emoji)} size={22} />
                  </span>
                  <span className="min-w-0">
                    <h3 className="font-semibold text-ink">{item.title}</h3>
                    <p className="mt-1 [overflow-wrap:anywhere] text-[0.9375rem] text-ink-soft">{item.body}</p>
                  </span>
                </article>
              ))}
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Link href="/demo" className="btn btn-primary btn-lg">
                See the live demo store
              </Link>
              <Link href="/" className="link-arrow">
                Back to the home page
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
