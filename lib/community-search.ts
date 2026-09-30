/**
 * Searching a community: the words in its posts and in the comments under
 * them, back to the thread they were written in.
 *
 * This is the one thing a community needs more of the longer it runs. A feed
 * answers "what is new"; nothing in a feed answers "has this been asked
 * before", and that question is the whole reason an archive is worth paying
 * for. Without it the same question is answered again every week, by hand, by
 * the creator.
 *
 * How it is kept, all under the community's own id:
 *
 *   nl:cm:<id>:w:<token>   posts containing that word, scored by post number
 *   nl:cm:<id>:wi:<post>   the words that post is indexed under
 *   nl:cm:<id>:q:<nonce>   one search's working set, gone within the minute
 *
 * A hit is a POST, never a comment on its own: the thread is what somebody is
 * looking for, and a comment away from its thread answers nothing. A post is
 * found by the words in its title, in its text, and in every comment under
 * it, so an answer given in the comments is findable by the words of the
 * answer.
 *
 * Scored by post number, which only ever grows, so results read newest first
 * and page exactly as the feed does — a page never repeats or skips while
 * somebody writes.
 *
 * Kept true by reindexing the whole post whenever anything in it changes. A
 * post's words are the union of its own and all its comments', so a deleted
 * comment cannot simply have its words removed — another comment may use the
 * same ones. Reading the post and its comments back is one GET and one
 * HGETALL, bounded by MAX_COMMENTS_PER_POST, and the difference against
 * `wi:<post>` is written. Correct beats clever here: an index that quietly
 * drifts out of step with the posts is worse than no index, because nobody
 * can tell it has.
 *
 * Two bounds worth knowing, both deliberate:
 *
 *   - At most MAX_INDEXED_WORDS distinct words per post are indexed. A post
 *     with 300 long comments under it can run past that; the words after it
 *     are not searchable. The cap is what keeps one community's index from
 *     growing without limit, and it is set high enough that ordinary writing
 *     never reaches it.
 *   - Words are matched whole, not by prefix. "pay" does not find "payment".
 *
 * Nothing here decides who may see what. The caller filters the posts that
 * come back through the same space gate the feed uses, so a space kept for
 * the buyers of one product stays out of everybody else's results.
 */
import { randomBytes } from "node:crypto";
import { redisPipeline } from "@/lib/redis";
import { MAX_COMMENTS_PER_POST } from "@/lib/community-text";

const base = (id: string) => `nl:cm:${id}`;
const wordKey = (id: string, word: string) => `${base(id)}:w:${word}`;
const indexKey = (id: string, post: string) => `${base(id)}:wi:${post}`;

/** As many distinct words as one post and its comments may be indexed under. */
export const MAX_INDEXED_WORDS = 600;
/** Shorter than this and a word carries no meaning of its own. */
const MIN_WORD = 2;
/** Longer than this and it is a URL or a hash, not a word. */
const MAX_WORD = 24;
/** Words a query may hold: past this it is not a search. */
export const MAX_QUERY_WORDS = 8;
export const MAX_QUERY_LENGTH = 120;
/** How many posts one page of results holds. */
export const SEARCH_PAGE = 20;
/** How long a search's working set lives. Seconds. */
const WORK_SECONDS = 60;

/**
 * Words too common to narrow anything down. Kept short on purpose: a longer
 * list starts throwing away words people genuinely search for, and "how to"
 * is a real query.
 */
const SKIP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have",
  "i", "in", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to", "was",
  "were", "will", "with", "you", "your",
]);

/**
 * Text as words to index or to search for: lower case, accents folded so
 * "café" and "cafe" are the same word, split on everything that is not a
 * letter or a number.
 */
export function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD && word.length <= MAX_WORD && !SKIP.has(word));
}

/** The distinct words a post is found by, capped, in the order they appear. */
function distinct(parts: string[]): string[] {
  const seen = new Set<string>();
  for (const part of parts) {
    for (const word of words(part)) {
      seen.add(word);
      if (seen.size >= MAX_INDEXED_WORDS) return [...seen];
    }
  }
  return [...seen];
}

/**
 * Writes what a post is findable by. `parts` is its title, its text and the
 * text of every comment under it; `n` is its feed number, which orders the
 * results. Only the difference is written, so a comment that adds no new word
 * costs one read and no write.
 */
export async function indexPost(id: string, post: string, n: number, parts: string[]): Promise<void> {
  const next = distinct(parts);
  const [raw] = await redisPipeline([["SMEMBERS", indexKey(id, post)]]);
  const before = new Set(Array.isArray(raw) ? raw.map(String) : []);
  const after = new Set(next);
  const added = next.filter((word) => !before.has(word));
  const gone = [...before].filter((word) => !after.has(word));
  if (!added.length && !gone.length) return;
  await redisPipeline([
    ...added.map((word) => ["ZADD", wordKey(id, word), n, post]),
    ...gone.map((word) => ["ZREM", wordKey(id, word), post]),
    ...(added.length ? [["SADD", indexKey(id, post), ...added]] : []),
    ...(gone.length ? [["SREM", indexKey(id, post), ...gone]] : []),
  ]);
}

/** Takes a deleted post out of the index entirely. */
export async function unindexPost(id: string, post: string): Promise<void> {
  const [raw] = await redisPipeline([["SMEMBERS", indexKey(id, post)]]);
  const held = Array.isArray(raw) ? raw.map(String) : [];
  await redisPipeline([
    ...held.map((word) => ["ZREM", wordKey(id, word), post]),
    ["DEL", indexKey(id, post)],
  ]);
}

/** What a search is actually looking for: whole words, deduplicated, capped. */
export function queryWords(raw: string): string[] {
  return [...new Set(words(raw.slice(0, MAX_QUERY_LENGTH)))].slice(0, MAX_QUERY_WORDS);
}

export type SearchPage = {
  /** Post ids, newest first. */
  posts: string[];
  /** The number to ask for the next page with, or null at the end. */
  next: number | null;
  /** The words actually searched for, after the common ones were dropped. */
  used: string[];
};

const EMPTY: SearchPage = { posts: [], next: null, used: [] };

/**
 * The posts holding every one of these words, newest first.
 *
 * `before` pages exactly as the feed does: the number of the last post on the
 * page just read. Asking for a page never repeats or skips a post, however
 * many are written while somebody reads the results.
 */
export async function search(id: string, raw: string, before: number | null = null): Promise<SearchPage> {
  const used = queryWords(raw);
  if (!used.length) return EMPTY;
  const max = before === null ? "+inf" : `(${before}`;
  // One word needs no working set: its own list is already the answer.
  if (used.length === 1) {
    const [rows] = await redisPipeline([
      ["ZREVRANGEBYSCORE", wordKey(id, used[0]), max, "-inf", "WITHSCORES", "LIMIT", 0, SEARCH_PAGE],
    ]);
    return { ...readPage(rows), used };
  }
  // Several words: every one of them has to be there. The working set is this
  // one search's alone and lets go of itself within the minute.
  const work = `${base(id)}:q:${randomBytes(9).toString("hex")}`;
  try {
    const [count] = await redisPipeline([
      ["ZINTERSTORE", work, used.length, ...used.map((word) => wordKey(id, word)), "AGGREGATE", "MAX"],
      ["EXPIRE", work, WORK_SECONDS],
    ]);
    if (!Number(count)) return { ...EMPTY, used };
    const [rows] = await redisPipeline([
      ["ZREVRANGEBYSCORE", work, max, "-inf", "WITHSCORES", "LIMIT", 0, SEARCH_PAGE],
    ]);
    return { ...readPage(rows), used };
  } finally {
    await redisPipeline([["DEL", work]]).catch(() => {});
  }
}

/** A Redis reply of member, score, member, score… as ids and the next cursor. */
function readPage(rows: unknown): { posts: string[]; next: number | null } {
  const flat = Array.isArray(rows) ? rows.map(String) : [];
  const posts: string[] = [];
  let last = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    posts.push(flat[i]);
    last = Number(flat[i + 1]) || last;
  }
  return { posts, next: posts.length === SEARCH_PAGE && last > 0 ? last : null };
}

/** The text of a post and its comments, for indexing. Comments are bounded. */
export function partsOf(post: { title: string; text: string }, comments: { text: string }[]): string[] {
  return [post.title, post.text, ...comments.slice(0, MAX_COMMENTS_PER_POST).map((c) => c.text)];
}
