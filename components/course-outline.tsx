import Link from "next/link";
import type { Course } from "@/lib/course";
import { isOpen, opensAt } from "@/lib/course";

function day(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * The course as a list: modules, their lessons, and for this visitor what is
 * done, what is open, what opens when, and what can be watched for free.
 */
export function CourseOutline({
  course,
  base,
  start,
  done,
  current,
}: {
  course: Course;
  /** The course page's path, lessons hang under it. */
  base: string;
  /** When this student joined; null for a visitor who has not bought it. */
  start: number | null;
  done: Set<string>;
  current?: string;
}) {
  return (
    <ol className="space-y-5">
      {course.modules.map((unit, mi) => {
        const open = start !== null && isOpen(unit, start);
        return (
          <li key={unit.id}>
            <p className="st-label">{`Module ${mi + 1}`}</p>
            <p className="font-semibold" style={{ color: "var(--st-text)" }}>{unit.title}</p>
            {unit.dripDays > 0 && !open ? (
              <p className="st-muted mt-0.5 text-sm">
                {start !== null
                  ? `Opens on ${day(opensAt(unit, start))}`
                  : `Opens ${unit.dripDays} ${unit.dripDays === 1 ? "day" : "days"} after you join`}
              </p>
            ) : null}
            {unit.lessons.length === 0 ? (
              <p className="st-muted mt-1 text-sm">No lessons yet.</p>
            ) : (
              <ol className="mt-2 space-y-1">
                {unit.lessons.map((lesson) => {
                  const reachable = open || lesson.preview;
                  const isDone = done.has(lesson.id);
                  const here = lesson.id === current;
                  const mark = isDone ? "✓" : reachable ? "○" : "🔒";
                  const label = `${lesson.title}${lesson.video ? " · video" : ""}`;
                  return (
                    <li key={lesson.id} className="flex items-start gap-2 text-sm">
                      <span aria-hidden="true" className="w-5 shrink-0 text-center">{mark}</span>
                      <span className="min-w-0 flex-1">
                        {reachable ? (
                          <Link
                            href={`${base}/${lesson.id}`}
                            aria-current={here ? "page" : undefined}
                            className={`break-words underline-offset-2 hover:underline ${here ? "font-bold underline" : ""}`}
                            style={{ color: "var(--st-text)" }}
                          >
                            {label}
                          </Link>
                        ) : (
                          <span className="st-muted break-words">{label}</span>
                        )}
                        {isDone ? <span className="sr-only"> (done)</span> : null}
                        {!open && lesson.preview ? (
                          <span className="ml-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--st-accent-text)" }}>Free preview</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </li>
        );
      })}
    </ol>
  );
}
