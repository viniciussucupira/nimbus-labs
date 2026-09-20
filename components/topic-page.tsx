import Link from "next/link";
import { RevealOnScroll } from "@/components/home-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import type { Block, TopicPage } from "@/lib/site-pages";

const PHOTO = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=128&h=128&q=70`;

const BADGE_TONE = {
  live: "bg-mint-brand text-ink",
  building: "bg-white/20 text-white",
  proof: "bg-amber-brand text-ink",
} as const;

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "lead":
      return (
        <p className="reveal mx-auto max-w-3xl text-xl leading-9 text-ink-soft">
          {block.text}
        </p>
      );

    case "cards":
      return (
        <section className="reveal">
          <h2 className="font-display text-2xl font-black">{block.title}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {block.items.map((item) => (
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
                <p className="mt-1 text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      );

    case "steps":
      return (
        <section className="reveal">
          <h2 className="font-display text-2xl font-black">{block.title}</h2>
          <ol className="mt-6 space-y-4">
            {block.items.map((item, i) => (
              <li
                key={item.title}
                className="flex gap-4 rounded-3xl border-2 border-ink/10 bg-white p-5 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="font-display grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-brand to-pink-brand text-sm font-black text-white"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="font-display block text-lg font-extrabold">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-ink-soft">{item.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      );

    case "facts":
      return (
        <section className="reveal">
          <h2 className="font-display text-2xl font-black">{block.title}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {block.items.map((item) => (
              <div
                key={item.label}
                className={`rounded-3xl p-6 shadow-lg ${item.tone}`}
              >
                <p className="font-display text-4xl font-black">{item.value}</p>
                <p className="mt-2 text-sm font-semibold opacity-85">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      );

    case "table":
      return (
        <section className="reveal">
          <h2 className="font-display text-2xl font-black">{block.title}</h2>
          <div className="mt-6 overflow-hidden rounded-3xl border-2 border-ink/10 shadow-xl shadow-ink/5">
            <table className="w-full border-collapse text-left text-sm sm:text-base">
              <thead>
                <tr className="bg-ink text-white">
                  {block.head.map((cell, i) => (
                    <th
                      key={cell + i}
                      scope="col"
                      className={`p-4 font-semibold ${i === 2 ? "bg-violet-brand" : ""}`}
                    >
                      {cell || " "}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={row[0]} className={i % 2 ? "bg-lilac/40" : "bg-white"}>
                    <th scope="row" className="p-4 text-left font-semibold text-ink">
                      {row[0]}
                    </th>
                    <td className="p-4 text-ink-soft">{row[1]}</td>
                    <td className="p-4 font-semibold text-violet-deep">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && (
            <p className="mt-3 text-sm text-ink-soft">{block.note}</p>
          )}
        </section>
      );

    case "quote":
      return (
        <section className="reveal rounded-3xl bg-gradient-to-br from-violet-brand to-pink-brand p-8 text-white shadow-xl">
          <p className="font-display text-xl font-extrabold">{block.text}</p>
          <p className="mt-3 text-white/80">{block.source}</p>
        </section>
      );

    case "note":
      return (
        <section className="reveal rounded-3xl border-2 border-dashed border-ink/20 bg-cream p-6">
          <h2 className="font-display flex items-center gap-2 text-lg font-extrabold">
            <span aria-hidden="true">📌</span> {block.title}
          </h2>
          <p className="mt-2 text-ink-soft">{block.body}</p>
        </section>
      );

    case "storecard":
      return (
        <section className="reveal">
          <h2 className="font-display text-2xl font-black">{block.title}</h2>
          <div className="mt-6 overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-xl shadow-ink/5">
            <div className="nb-mesh flex items-center gap-4 p-6 text-white">
              <img
                src={PHOTO(block.photo)}
                alt={block.alt}
                loading="lazy"
                className="h-16 w-16 rounded-full object-cover ring-4 ring-white/40"
              />
              <div>
                <p className="font-display text-xl font-extrabold">
                  {block.creator}
                </p>
                <p className="text-white/80">{block.tagline}</p>
              </div>
            </div>
            <ul className="divide-y divide-ink/5">
              {block.items.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <span>
                    <span className="block font-semibold text-ink">
                      {item.label}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {item.detail}
                    </span>
                  </span>
                  <span className="font-display text-lg font-black text-violet-deep">
                    {item.price}
                  </span>
                </li>
              ))}
            </ul>
            <p className="bg-lilac px-5 py-3 text-sm text-ink-soft">
              Example layout. {block.creator === "Harbor Kitchen"
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
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content" className="flex-1">
        <section className="nb-mesh nb-grain relative overflow-hidden text-white">
          <div
            aria-hidden="true"
            className="nb-blob absolute -left-20 top-0 h-64 w-64 bg-pink-brand/35 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="nb-blob absolute -right-16 bottom-0 h-72 w-72 bg-mint-brand/25 blur-3xl"
          />
          <div className="relative mx-auto max-w-4xl px-4 py-16 sm:py-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              {page.eyebrow}
            </p>
            <h1 className="font-display mt-5 text-4xl font-black leading-[1.08] sm:text-5xl">
              {page.title}{" "}
              <span className="nb-gradient-text">{page.highlight}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/85">{page.intro}</p>
            <p
              className={`mt-7 inline-block rounded-full px-4 py-2 text-sm font-bold ${BADGE_TONE[page.badge.tone]}`}
            >
              {page.badge.label}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-4xl space-y-12 px-4 py-16">
          {page.blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}

          <section
            className={`reveal rounded-3xl bg-gradient-to-br ${page.accent} p-8 text-center text-white shadow-xl`}
          >
            <h2 className="font-display text-2xl font-black sm:text-3xl">
              Want this for your own store?
            </h2>
            <p className="mt-3 text-white/90">
              Tell me what you sell and what is broken today. Two minutes, and
              nothing to buy.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/signin"
                className="rounded-full bg-white px-7 py-3.5 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5"
              >
                Start your store
              </Link>
              <Link
                href="/demo"
                className="rounded-full border-2 border-white/70 px-7 py-3.5 font-bold text-white transition hover:bg-white hover:text-violet-deep"
              >
                Open the live demo store
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
