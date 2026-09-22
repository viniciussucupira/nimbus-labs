import Link from "next/link";
import { RevealOnScroll } from "@/components/home-parts";
import { Icon, iconFor } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Block, TopicPage } from "@/lib/site-pages";
import { PRICE_CENTS, TRIAL_DAYS } from "@/lib/plan";

const PHOTO = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=160&h=160&q=72`;

const BADGE_CLASS = {
  live: "tag tag-live",
  building: "tag tag-next",
  proof: "tag tag-brand",
} as const;

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "lead":
      return <p className="reveal t-lead measure-wide text-ink-soft">{block.text}</p>;

    case "cards":
      return (
        <section className="reveal">
          <h2 className="t-h3 text-[1.5rem]">{block.title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {block.items.map((item) => (
              <article key={item.title} className="card p-6">
                <span className="icon-tile">
                  <Icon name={iconFor(item.emoji)} size={22} />
                </span>
                <h3 className="mt-5 text-[1.0625rem] font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-[0.9375rem] text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      );

    case "steps":
      return (
        <section className="reveal">
          <h2 className="t-h3 text-[1.5rem]">{block.title}</h2>
          <ol className="mt-6 grid gap-3">
            {block.items.map((item, i) => (
              <li key={item.title} className="card-flat flex gap-4 p-5 sm:p-6">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lilac text-sm font-semibold text-violet-deep">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold text-ink">{item.title}</span>
                  <span className="mt-1 block text-[0.9375rem] text-ink-soft">{item.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      );

    case "facts":
      return (
        <section className="reveal">
          <h2 className="t-h3 text-[1.5rem]">{block.title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {block.items.map((item, i) => (
              <div key={item.label} className={i === 0 ? "rounded-[var(--r-lg)] bg-night p-6 text-white" : "card-flat p-6"}>
                <p className={`text-[2.5rem] font-semibold leading-none tracking-[-0.04em] ${i === 0 ? "text-white" : "text-ink"}`}>
                  {item.value}
                </p>
                <p className={`mt-3 text-[0.9375rem] ${i === 0 ? "text-white/70" : "text-ink-soft"}`}>{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "table":
      return (
        <section className="reveal">
          <h2 className="t-h3 text-[1.5rem]">{block.title}</h2>
          <div className="mt-6 hidden overflow-hidden rounded-[var(--r-lg)] border border-line bg-white shadow-[var(--shadow-sm)] sm:block">
            <table className="table-clean text-[0.9375rem]">
              <thead>
                <tr>
                  {block.head.map((cell, i) => (
                    <th key={cell + i} scope="col" className={i === 2 ? "!text-violet-deep" : ""}>
                      {cell || <span className="sr-only">Row</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row[0]}>
                    <th scope="row" className="w-[34%] font-semibold text-ink">
                      {row[0]}
                    </th>
                    <td className="text-ink-soft">{row[1]}</td>
                    <td className="bg-lilac/40 font-medium text-ink">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-6 grid gap-3 sm:hidden">
            {block.rows.map((row) => (
              <li key={row[0]} className="card-flat p-5">
                <p className="font-semibold text-ink">{row[0]}</p>
                <dl className="mt-3 grid gap-2 text-[0.9375rem]">
                  <div className="flex gap-3">
                    <dt className="w-20 shrink-0 text-ink-mute">{block.head[1]}</dt>
                    <dd className="text-ink-soft">{row[1]}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-20 shrink-0 font-semibold text-violet-deep">{block.head[2]}</dt>
                    <dd className="font-medium text-ink">{row[2]}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          {block.note && <p className="mt-3 text-sm text-ink-mute">{block.note}</p>}
        </section>
      );

    case "quote":
      return (
        <figure className="reveal border-l-[3px] border-violet-brand py-1 pl-6">
          <blockquote className="text-[1.35rem] font-medium leading-snug tracking-[-0.02em] text-ink">
            {block.text}
          </blockquote>
          <figcaption className="mt-3 text-[0.9375rem] text-ink-mute">{block.source}</figcaption>
        </figure>
      );

    case "note":
      return (
        <section className="reveal rounded-[var(--r-lg)] border border-line bg-sand p-6">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <Icon name="info" size={18} className="text-violet-deep" />
            {block.title}
          </h2>
          <p className="mt-2 text-[0.9375rem] text-ink-soft">{block.body}</p>
        </section>
      );

    case "storecard":
      return (
        <section className="reveal">
          <h2 className="t-h3 text-[1.5rem]">{block.title}</h2>
          <div className="mt-6 overflow-hidden rounded-[var(--r-xl)] border border-line bg-white shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-4 border-b border-line bg-paper p-6">
              <img
                src={PHOTO(block.photo)}
                alt={block.alt}
                width={64}
                height={64}
                loading="lazy"
                className="h-16 w-16 rounded-full bg-sand-deep object-cover"
              />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-ink">{block.creator}</p>
                <p className="text-ink-soft">{block.tagline}</p>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {block.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4 px-6 py-4">
                  <span>
                    <span className="block font-medium text-ink">{item.label}</span>
                    <span className="block text-sm text-ink-mute">{item.detail}</span>
                  </span>
                  <span className="rounded-[8px] bg-lilac px-2.5 py-1 font-semibold text-violet-deep">{item.price}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 border-t border-line bg-paper px-6 py-3 text-sm text-ink-mute">
              <Icon name="info" size={16} />
              Example layout.{" "}
              {block.creator === "Harbor Kitchen"
                ? "Harbor Kitchen is the live demo store and Jenny is a fictional cook."
                : `${block.creator} is an invented creator, used to show the shape of the page.`}
            </p>
          </div>
        </section>
      );
  }
}

export function TopicPageView({ page }: { page: TopicPage }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content" className="flex-1">
        <section className="surface-night nb-grid-lines on-dark overflow-hidden">
          <div className="container-narrow py-16 sm:py-24">
            <p className="eyebrow nb-fade-up">{page.eyebrow}</p>
            <h1 className="t-h1 balance nb-fade-up nb-delay-1 mt-5 text-white">
              {page.title} <span className="serif font-normal text-[#cfc4ff]">{page.highlight}</span>
            </h1>
            <p className="t-lead nb-fade-up nb-delay-2 mt-6 max-w-2xl text-white/75">{page.intro}</p>
            <p className="nb-fade-up nb-delay-3 mt-7">
              <span className={BADGE_CLASS[page.badge.tone]}>{page.badge.label}</span>
            </p>
          </div>
        </section>

        <div className="container-narrow space-y-14 py-16 sm:py-20">
          {page.blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </div>

        <section className="surface-sand">
          <div className="container-narrow py-16 text-center sm:py-20">
            <h2 className="t-h2 balance">Want this on your own store?</h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-soft">
              {`Take your address, connect your own Stripe account and put your first product up. $${PRICE_CENTS / 100} a month, with ${TRIAL_DAYS} days to try it.`}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Link href="/signin" className="btn btn-primary btn-lg">
                Start your store
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link href="/demo" className="link-arrow">
                Open the live demo store
                <Icon name="arrow-right" size={18} className="arrow" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
