import Link from "next/link";
import type { Course } from "@/lib/course";
import { isCohort, isOpen, opensAt } from "@/lib/course";
import { LocalDay } from "@/components/local-day";

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
  held,
}: {
  course: Course;
  /** The course page's path, lessons hang under it. */
  base: string;
  /** When this student joined; null for a visitor who has not bought it. */
  start: number | null;
  done: Set<string>;
  current?: string;
  /** Lessons a quiz that must be passed still holds shut, for this student. */
  held?: Map<string, string>;
}) {
  return (
    <ol className="space-y-5">
      {course.modules.map((unit, mi) => {
        const open = start !== null && isOpen(course, unit, start);
        return (
          <li key={unit.id}>
            <p className="st-label">{`Module ${mi + 1}`}</p>
            <p className="font-semibold" style={{ color: "var(--st-text)" }}>{unit.title}</p>
            {/*
              When this module opens, and said to somebody who has not bought
              it yet as well.

              On a cohort the whole schedule is known before anyone joins,
              because it hangs off one date rather than off each student's
              own. So a visitor reading the outline sees real dates, which is
              the thing worth knowing before paying for a course that runs to
              a timetable — and a module with no wait is still a date there,
              not "at once", because day one of a cohort is a day.
            */}
            {!open && (unit.dripDays > 0 || isCohort(course)) ? (
              <p className="st-muted mt-0.5 text-sm">
                {isCohort(course) ? (
                  <>
                    {unit.dripDays === 0 ? "Starts on " : "Opens on "}
                    <LocalDay seconds={opensAt(course, unit, 0)} />
                  </>
                ) : start !== null ? (
                  <>
                    Opens on <LocalDay seconds={opensAt(course, unit, start)} />
                  </>
                ) : (
                  `Opens ${unit.dripDays} ${unit.dripDays === 1 ? "day" : "days"} after you enroll`
                )}
              </p>
            ) : null}
            {unit.lessons.length === 0 ? (
              <p className="st-muted mt-1 text-sm">No lessons yet.</p>
            ) : (
              <ol className="mt-2 space-y-1">
                {unit.lessons.map((lesson) => {
                  const waiting = open && Boolean(held?.has(lesson.id));
                  const reachable = (open && !waiting) || lesson.preview;
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
                        {lesson.quiz ? (
                          <span className="st-muted ml-2 text-xs font-semibold">{lesson.quiz.required ? "Quiz to pass" : "Quiz"}</span>
                        ) : null}
                        {waiting && !lesson.preview ? (
                          <span className="st-muted block text-xs">Opens when you pass the quiz before it</span>
                        ) : null}
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
