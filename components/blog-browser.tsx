"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BlogPost } from "@/lib/blog";
import { formatPostDate } from "@/lib/blog";

/**
 * The search box and the category picker for the blog index. Everything is
 * filtered in the browser over a list that is already on the page, so nothing
 * is fetched and the results appear as the reader types.
 */
export function BlogBrowser({
  posts,
  categories,
}: {
  posts: BlogPost[];
  categories: string[];
}) {
  const [category, setCategory] = useState("All articles");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (category !== "All articles" && post.category !== category) {
        return false;
      }
      if (!needle) return true;
      return (
        post.title.toLowerCase().includes(needle) ||
        post.excerpt.toLowerCase().includes(needle) ||
        post.category.toLowerCase().includes(needle)
      );
    });
  }, [posts, category, query]);

  const options = ["All articles", ...categories];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter articles by category"
        >
          {options.map((option) => {
            const active = option === category;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                aria-pressed={active}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-ink text-white shadow-md"
                    : "bg-lilac text-ink-soft hover:bg-violet-brand/15 hover:text-violet-deep"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search the articles</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search something…"
            className="w-full rounded-full border-2 border-ink/10 bg-white py-3 pl-11 pr-4 text-sm font-medium text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-violet-brand"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </label>
      </div>

      <p className="mt-6 text-sm font-semibold text-ink-soft" aria-live="polite">
        {shown.length === posts.length
          ? `${posts.length} articles`
          : `${shown.length} of ${posts.length} articles`}
      </p>

      {shown.length === 0 ? (
        <p className="mt-10 rounded-3xl bg-lilac p-10 text-center font-semibold text-ink-soft">
          Nothing matches that yet. Try another word, or read everything.
        </p>
      ) : (
        <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ink/5 bg-white shadow-[0_18px_40px_rgba(20,15,61,0.08)] transition hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(20,15,61,0.16)]">
      <div
        className="relative h-36 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, ${post.from}, ${post.to})`,
        }}
      >
        <span className="absolute left-5 top-5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
          {post.kicker}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-deep">
          {post.category}{" "}
          <span className="text-ink-soft">· {formatPostDate(post.date)}</span>
        </p>
        <h3 className="font-display mt-3 text-xl font-black leading-snug text-ink">
          <Link
            href={`/blog/${post.slug}`}
            className="outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {post.title}
          </Link>
        </h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">
          {post.excerpt}
        </p>
        <p className="mt-5 text-sm font-bold text-violet-deep">
          Read more{" "}
          <span
            aria-hidden="true"
            className="inline-block transition group-hover:translate-x-1"
          >
            →
          </span>
        </p>
      </div>
    </article>
  );
}
