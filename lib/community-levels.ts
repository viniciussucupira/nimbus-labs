/**
 * The levels of a community, and what a level can hand over, as plain rules:
 * no Redis, no secrets, so the studio's own page can import them. What is
 * kept and read lives in lib/community-points.ts.
 */

/** The points each level starts at: Level 1 at 0, Level 9 at 33,015. Skool's own curve, which members already know. */
export const LEVELS = [0, 5, 20, 65, 155, 515, 2015, 8015, 33015] as const;
export const MAX_LEVEL = LEVELS.length;
/** How many levels may hand over a course. One per level at most. */
export const MAX_REWARDS = MAX_LEVEL - 1;

const PRODUCT = /^[a-z0-9]{6,40}$/;

/** The level a number of points is at, from 1 to MAX_LEVEL. */
export function levelOf(points: number): number {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i += 1) if (points >= LEVELS[i]) level = i + 1;
  return level;
}

/** How many more points the next level needs, or null at the top. */
export function toNextLevel(points: number): number | null {
  const level = levelOf(points);
  return level >= MAX_LEVEL ? null : LEVELS[level] - points;
}

/** A level that hands over one of the creator's courses. */
export type Reward = { level: number; product: string };

/** What was stored or sent, made safe: levels 2 to MAX_LEVEL, one course per level, lowest first. */
export function parseRewards(raw: unknown): Reward[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out: Reward[] = [];
  const levels = new Set<number>();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const { level, product } = entry as Record<string, unknown>;
    if (typeof level !== "number" || !Number.isInteger(level) || level < 2 || level > MAX_LEVEL) continue;
    if (typeof product !== "string" || !PRODUCT.test(product) || levels.has(level)) continue;
    levels.add(level);
    out.push({ level, product });
    if (out.length >= MAX_REWARDS) break;
  }
  return out.sort((a, b) => a.level - b.level);
}
