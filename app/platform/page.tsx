import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { RevealOnScroll } from "@/components/home-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { PAGES, type TopicPage } from "@/lib/site-pages";
import { PLAN_PRICES, TRIAL_DAYS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Every feature — Nimbus Labs",
  description:
    "Everything a Nimbus store does today — selling, getting paid, delivering and growing — each with its own page, what it does not do yet, and the plan it is on.",
};

const GROUPS: { key: NonNullable<TopicPage["group"]>; title: string; line: string }[] = [
  { key: "sell", title: "Sell", line: "Files, courses, memberships and calls, from one page." },
  { key: "paid", title: "Get paid", line: "On your own Stripe account, with the tools that raise each sale." },
  { key: "deliver", title: "Deliver", line: "The second Stripe confirms, and again whenever it is lost." },
  { key: "grow", title: "Grow", line: "Your list, your numbers and your own domain." },
];

const dollars = (cents: number) => `$${cents / 100}`;

/** Every feature page, grouped the way a creator thinks about a store. */
export default function PlatformIndex() {
  const features = PAGES.filter((p) => p.section === "platform" && p.menu && p.group);
  const creators = PAGES.filter((p) => p.section === "for");

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <RevealOnScroll />
      <SiteNav />
      <main id="content" className="flex-1">
        <section className="surface-night nb-grid-lines overflow-hidden">
          <div className="container-page on-dark py-16 sm:py-24">
            <p className="eyebrow nb-fade-up">Every feature</p>
            <h1 className="t-h1 balance nb-fade-up nb-delay-1 mt-5 max-w-3xl text-white">
              Everything your store does <span className="serif font-normal text-[#cfc4ff]">today</span>
            </h1>
            <p className="t-lead nb-fade-up nb-delay-2 mt-6 max-w-2xl text-white/75">
              {`Each feature has its own page: how it works, who it is for, what it does not do yet, and the plan it comes with. Everything on the ${dollars(PLAN_PRICES.creator.month)} plan is on Pro too.`}
            </p>
            <div className="nb-fade-up nb-delay-3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/signin" className="btn btn-light btn-lg">
                {`Try it free for ${TRIAL_DAYS} days`}
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link href="/mission" className="link-arrow">
                What is not built yet
                <Icon name="arrow-right" size={18} className="arrow" />
              </Link>
            </div>
          </div>
        </section>

        <div className="container-page space-y-16 py-16 sm:py-20">
          {GROUPS.map((group) => {
            const items = features.filter((p) => p.group === group.key);
            if (items.length === 0) return null;
            return (
              <section key={group.key} className="reveal" aria-labelledby={`group-${group.key}`}>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <h2 id={`group-${group.key}`} className="t-h2">{group.title}</h2>
                  <p className="text-ink-soft">{group.line}</p>
                </div>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/platform/${p.slug}`}
                        className="card group flex h-full flex-col p-6 transition-shadow hover:shadow-[var(--shadow-md)]"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="icon-tile">
                            <Icon name={p.menu!.icon} size={22} />
                          </span>
                          <span className={p.plan === "pro" ? "tag tag-brand" : "tag"}>
                            {p.plan === "pro" ? `Pro, ${dollars(PLAN_PRICES.pro.month)}` : `${dollars(PLAN_PRICES.creator.month)} plan`}
                          </span>
                        </span>
                        <span className="mt-5 block text-[1.125rem] font-semibold text-ink">{p.menu!.label}</span>
                        <span className="mt-1.5 block flex-1 text-[0.9375rem] text-ink-soft">{p.menu!.description}</span>
                        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-violet-deep">
                          How it works
                          <Icon name="arrow-right" size={15} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section className="reveal" aria-labelledby="group-creators">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="group-creators" className="t-h2">By kind of creator</h2>
              <p className="text-ink-soft">The same features, put together for what you sell.</p>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {creators.map((p) => (
                <li key={p.slug}>
                  <Link href={`/for/${p.slug}`} className="flex h-full items-center justify-between gap-3 rounded-[var(--r-md)] border border-line bg-white px-5 py-4 font-semibold text-ink transition-colors hover:bg-sand">
                    {p.eyebrow.replace(/^For /, "").replace(/^./, (c) => c.toUpperCase())}
                    <Icon name="arrow-right" size={16} className="text-violet-deep" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
