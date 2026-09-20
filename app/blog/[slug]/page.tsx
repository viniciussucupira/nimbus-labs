import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCard } from "@/components/blog-browser";
import { RevealOnScroll } from "@/components/home-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import {
  BLOG_POSTS,
  type BlogBlock,
  formatPostDate,
  postBySlug,
  postsSorted,
} from "@/lib/blog";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return {};
  // Both blocks are spelled out, and that is deliberate. Setting only
  // `openGraph` here replaces the layout's copy of it and drops the image and
  // the address with it, while `twitter` quietly keeps inheriting the home
  // page's title — so an article used to share as the whole site. The picture
  // itself comes from opengraph-image.tsx beside this file.
  return {
    title: `${post.title} — The Nimbus Journal`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url: `/blog/${post.slug}`,
      siteName: "Nimbus Labs",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="font-display mt-12 text-2xl font-black text-ink sm:text-3xl">
          {block.text}
        </h2>
      );

    case "p":
      return (
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          {block.text}
        </p>
      );

    case "ul":
      return (
        <ul className="mt-6 space-y-3">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-2xl bg-lilac px-5 py-4 text-ink-soft"
            >
              <span aria-hidden="true" className="font-bold text-violet-deep">
                →
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "steps":
      return (
        <ol className="mt-6 space-y-4">
          {block.items.map((item, index) => (
            <li
              key={item.title}
              className="flex gap-4 rounded-2xl border-2 border-ink/5 bg-white p-5 shadow-sm"
            >
              <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-brand text-sm font-black text-white">
                {index + 1}
              </span>
              <span>
                <span className="font-display block font-black text-ink">
                  {item.title}
                </span>
                <span className="mt-1 block text-ink-soft">{item.text}</span>
              </span>
            </li>
          ))}
        </ol>
      );

    case "note":
      return (
        <aside className="mt-8 rounded-3xl border-l-8 border-amber-brand bg-cream p-6 text-ink-soft">
          <p className="font-display mb-2 font-black text-ink">Worth knowing</p>
          <p>{block.text}</p>
        </aside>
      );
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();

  const more = postsSorted()
    .filter((other) => other.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content" className="flex-1">
        <section
          className="relative overflow-hidden text-white"
          style={{
            backgroundImage: `linear-gradient(135deg, ${post.from}, ${post.to})`,
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(255,255,255,0.3),transparent_55%)]"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-16 sm:py-20">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
            >
              <span aria-hidden="true">←</span> The Nimbus Journal
            </Link>
            <h1 className="font-display mt-6 text-4xl font-black leading-[1.08] sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-5 text-lg text-white/90">{post.excerpt}</p>
            <p className="mt-6 text-sm font-semibold text-white/75">
              {post.category} · {formatPostDate(post.date)} ·{" "}
              {post.readMinutes} min read
            </p>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-4 py-14">
          {post.body.map((block, index) => (
            <Block key={index} block={block} />
          ))}

          <div className="mt-14 rounded-3xl bg-gradient-to-br from-violet-brand to-pink-brand p-8 text-center text-white shadow-xl">
            <h2 className="font-display text-2xl font-black sm:text-3xl">
              See it working before you believe us
            </h2>
            <p className="mt-3 text-white/90">
              The demo store is a real Stripe checkout with a test card. Buy the
              file, watch it arrive, then decide.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/demo"
                className="rounded-full bg-white px-7 py-3.5 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5"
              >
                Open the live demo store
              </Link>
              <Link
                href="/signin"
                className="rounded-full border-2 border-white/70 px-7 py-3.5 font-bold text-white transition hover:bg-white hover:text-violet-deep"
              >
                Start your store
              </Link>
            </div>
          </div>
        </article>

        {more.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 pb-20">
            <h2 className="font-display text-3xl font-black text-ink">
              Read next
            </h2>
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((other) => (
                <BlogCard key={other.slug} post={other} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
