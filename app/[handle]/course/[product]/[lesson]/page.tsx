import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { linkHost } from "@/lib/product-link";
import { readableSize } from "@/lib/product-file";
import { findLesson, isOpen, lessonsInOrder, readBody, readCourse } from "@/lib/course";
import { VIDEO_URL_SECONDS, courseAccess, doneLessons, signedMedia } from "@/lib/learn";
import { CourseOutline } from "@/components/course-outline";
import { LessonText } from "@/components/lesson-text";

type Params = {
  params: Promise<{ handle: string; product: string; lesson: string }>;
};

export const metadata: Metadata = {
  title: "Lesson — Nimbus Labs",
  robots: { index: false, follow: false },
};

/** One lesson: its video, its text, its downloads, and the way on. */
export default async function LessonPage({ params }: Params) {
  const { handle: raw, product: productId, lesson: lessonId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();
  const product = store.products.find((item) => item.id === productId);
  if (!product?.course) redirect(`/@${store.handle}`);
  const course = await readCourse(product.course.id);
  const base = `/@${store.handle}/course/${product.id}`;
  const found = course ? findLesson(course, lessonId) : null;
  if (!course || !found) redirect(base);

  const access = await courseAccess(store, product, await cookies());
  const open = access.state === "open" && isOpen(found.unit, access.start);
  // A free preview is open to anyone; everything else to a student whose
  // module has opened.
  if (!open && !found.lesson.preview) redirect(base);

  const { lesson, unit } = found;
  const start = access.state === "open" ? access.start : null;
  const student = access.state === "open" && !access.learner.owner ? access.learner : null;
  const done = student ? await doneLessons(course.id, student.email) : new Set<string>();
  const [body, video] = await Promise.all([
    lesson.hasBody ? readBody(course.id, lesson.id) : Promise.resolve(""),
    lesson.video ? signedMedia(lesson.video, VIDEO_URL_SECONDS) : Promise.resolve(null),
  ]);

  const order = lessonsInOrder(course);
  const at = order.findIndex((entry) => entry.lesson.id === lesson.id);
  const reachable = (entry: (typeof order)[number]) =>
    entry.lesson.preview || (start !== null && isOpen(entry.unit, start));
  const previous = order.slice(0, at).reverse().find(reachable) ?? null;
  const next = order.slice(at + 1).find(reachable) ?? null;
  const isDone = done.has(lesson.id);
  const moduleNumber = course.modules.findIndex((m) => m.id === unit.id) + 1;

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <p className="text-sm">
          <Link href={base} className="st-footer-link font-semibold">{product.title}</Link>
          <span className="st-muted">{` · Module ${moduleNumber}: ${unit.title}`}</span>
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="st-card min-w-0 p-5 sm:p-8">
            <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">{lesson.title}</h1>
            {!open ? (
              <p className="st-muted mt-2 text-sm font-semibold">Free preview</p>
            ) : null}

            {lesson.video ? (
              video ? (
                <div className="mt-6 overflow-hidden rounded-2xl bg-black">
                  {/* Vertical videos stay vertical: the player takes the
                      shape of the video instead of forcing it wide. */}
                  <video
                    src={video}
                    controls
                    playsInline
                    preload="metadata"
                    controlsList="nodownload"
                    className="mx-auto block max-h-[75vh] w-full object-contain"
                  />
                </div>
              ) : (
                <p className="st-note mt-6">The video could not be loaded just now. Refresh the page in a moment.</p>
              )
            ) : null}

            {body ? (
              <div className="mt-6" style={{ color: "var(--st-text)" }}>
                <LessonText text={body} />
              </div>
            ) : null}

            {lesson.link ? (
              <a href={lesson.link} target="_blank" rel="noopener noreferrer nofollow" className="btn st-btn mt-6">
                {`Open ${linkHost(lesson.link)}`}
              </a>
            ) : null}

            {lesson.files.length ? (
              <div className="mt-6 rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line)" }}>
                <p className="st-label">Downloads</p>
                <ul className="mt-2 space-y-2">
                  {lesson.files.map((file, i) => (
                    <li key={file.pathname} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <a
                        href={`/api/store/course/file?h=${encodeURIComponent(store.handle)}&p=${product.id}&l=${lesson.id}&i=${i}`}
                        className="min-w-0 break-all font-semibold underline underline-offset-2"
                        style={{ color: "var(--st-text)" }}
                      >
                        {file.name}
                      </a>
                      <span className="st-muted">{readableSize(file.bytes)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!lesson.video && !body && !lesson.link && lesson.files.length === 0 ? (
              <p className="st-muted mt-6">This lesson has nothing in it yet.</p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6" style={{ borderColor: "var(--st-line)" }}>
              {student && open ? (
                <form action="/api/store/course/progress" method="post" className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="handle" value={store.handle} />
                  <input type="hidden" name="product" value={product.id} />
                  <input type="hidden" name="lesson" value={lesson.id} />
                  {isDone ? (
                    <>
                      <span className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>✓ Done</span>
                      <input type="hidden" name="done" value="0" />
                      <button type="submit" className="st-footer-link text-sm font-semibold">Mark as not done</button>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="done" value="1" />
                      <input type="hidden" name="next" value={next?.lesson.id ?? ""} />
                      <button type="submit" className="btn st-btn">{next ? "Mark as done and continue" : "Mark as done"}</button>
                    </>
                  )}
                </form>
              ) : null}
              {next && (isDone || !student || !open) ? (
                <Link href={`${base}/${next.lesson.id}`} className="btn st-btn">Next lesson</Link>
              ) : null}
              {previous ? (
                <Link href={`${base}/${previous.lesson.id}`} className="st-footer-link text-sm font-semibold">Previous lesson</Link>
              ) : null}
            </div>
          </article>

          <aside className="st-card h-fit p-5 sm:p-6">
            <p className="st-label">In this course</p>
            <div className="mt-3">
              <CourseOutline course={course} base={base} start={start} done={done} current={lesson.id} />
            </div>
            {!open ? (
              <Link href={base} className="btn st-btn btn-block mt-5">Get the whole course</Link>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
