import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { readMembers } from "@/lib/community";
import { communityViewer } from "@/lib/community-access";
import { LEVELS, type Period, board, levelOf, pointsOf, readRewards, toNextLevel } from "@/lib/community-points";
import { readListings } from "@/lib/catalog";
import { CommunityBar, Face, LevelBadge } from "@/components/community-parts";

type Params = { params: Promise<{ handle: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export const metadata: Metadata = {
  title: "Leaderboard — Marktmorgen",
  robots: { index: false, follow: false },
};

const PERIODS: { id: Period; label: string }[] = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "all", label: "All time" },
];

/**
 * Who helped most, and exactly how it is counted (lib/community-points.ts):
 * the board for 7 days, 30 days and all time, this member's own place and
 * level, and what every level opens, written out in full.
 */
export default async function CommunityLeaderboardPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityViewer(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  if (viewer.state !== "in") redirect(home);
  const id = store.community.id;
  const query = await searchParams;
  const period: Period = query.period === "7" || query.period === "30" ? query.period : "all";
  const { config, owner, key } = viewer;

  const [standing, rewards, mineAll] = await Promise.all([
    board(id, period, owner ? null : key),
    readRewards(id),
    owner ? Promise.resolve(new Map<string, number>()) : pointsOf(id, [key]),
  ]);
  const [members, allTime, courses] = await Promise.all([
    readMembers(id, standing.top.map((s) => s.key)),
    pointsOf(id, standing.top.map((s) => s.key)),
    rewards.length ? readListings(store, rewards.map((r) => r.product)) : Promise.resolve([]),
  ]);
  const myPoints = mineAll.get(key) ?? 0;
  const myLevel = levelOf(myPoints);
  const toNext = toNextLevel(myPoints);
  const opens = (level: number): { text: string; href?: string }[] => [
    ...config.spaces.filter((s) => s.level === level && !s.creatorOnly).map((s) => ({ text: `Starting posts in ${s.name}` })),
    ...rewards
      .filter((r) => r.level === level)
      .map((r) => courses.find((c) => c.id === r.product))
      .filter((c): c is NonNullable<typeof c> => Boolean(c?.course))
      .map((c) => ({
        text: `${c.title}, free`,
        // Somebody at this level already has it: the way in, from here.
        href: owner || myLevel >= level ? `/@${store.handle}/course/${c.id}` : undefined,
      })),
  ];

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <CommunityBar store={store} config={config} tab="leaderboard" signedIn messages={config.dm.on} room={config.chat.on} />
      <main id="content" className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Leaderboard</h1>
        <p className="st-muted mt-2">
          Every like your posts and comments get from somebody else is one point. Taking a like back takes the point back, your
          own likes earn you nothing, and {store.name} collects no points.
        </p>

        {!owner ? (
          <section aria-labelledby="me-title" className="st-card mt-6 p-5 sm:p-6">
            <h2 id="me-title" className="flex flex-wrap items-center gap-2 text-lg font-bold">
              <span>{`You are at Level ${myLevel}`}</span>
            </h2>
            <p className="st-muted mt-1 text-sm">
              {`${myPoints} ${myPoints === 1 ? "point" : "points"} in all.`}
              {toNext !== null ? ` ${toNext} more ${toNext === 1 ? "point reaches" : "points reach"} Level ${myLevel + 1}.` : " That is the top level."}
              {standing.mine ? ` Number ${standing.mine.rank} on this board, with ${standing.mine.points} ${standing.mine.points === 1 ? "point" : "points"}.` : ""}
            </p>
            {toNext !== null ? (
              <div className="cm-progress mt-3" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.min(100, Math.round(((myPoints - LEVELS[myLevel - 1]) / (LEVELS[myLevel] - LEVELS[myLevel - 1])) * 100))}%`,
                  }}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <nav aria-label="Period" className="cm-tabs mt-6">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={p.id === "all" ? `${home}/leaderboard` : `${home}/leaderboard?period=${p.id}`}
              aria-current={period === p.id ? "page" : undefined}
              className="cm-tab"
            >
              {p.label}
            </Link>
          ))}
        </nav>

        {standing.top.length === 0 ? (
          <p className="st-muted mt-6">
            {period === "all" ? "Nobody has a point yet. The first like on somebody else's post makes one." : "No points made in this period yet."}
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {standing.top.map((s, i) => {
              const member = members.get(s.key);
              const name = member?.n || "A member";
              return (
                <li key={s.key} className={`st-card flex items-center gap-3 px-4 py-3 ${s.key === key ? "cm-me" : ""}`}>
                  <span className="w-7 shrink-0 text-center font-bold tabular-nums">{i + 1}</span>
                  <Face store={store} author={s.key} name={name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-bold">
                      <span className="break-words">{s.key === key ? `${name} (you)` : name}</span>
                      <LevelBadge level={levelOf(allTime.get(s.key) ?? 0)} />
                    </span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{`${s.points} ${s.points === 1 ? "pt" : "pts"}`}</span>
                </li>
              );
            })}
          </ol>
        )}

        <section aria-labelledby="levels-title" className="st-card mt-8 p-5 sm:p-6">
          <h2 id="levels-title" className="text-lg font-bold">Levels, and what each opens</h2>
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--st-line)" }}>
            {LEVELS.map((at, i) => {
              const level = i + 1;
              const here = opens(level);
              return (
                <li key={level} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5" style={{ borderColor: "var(--st-line)" }}>
                  <span className="font-semibold">{`Level ${level}`}</span>
                  <span className="st-muted text-right text-sm">
                    {`${at.toLocaleString("en-US")} points`}
                    {here.length ? " · Opens: " : ""}
                    {here.map((one, n) => (
                      <span key={one.text}>
                        {n > 0 ? "; " : ""}
                        {one.href ? (
                          <Link href={one.href} className="font-semibold underline underline-offset-4" style={{ color: "var(--st-text)" }}>
                            {one.text}
                          </Link>
                        ) : (
                          one.text
                        )}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          {rewards.length ? (
            <p className="st-muted mt-3 text-sm">
              A course a level opens is yours from the day you reach it, and stays yours if your points go down later.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
