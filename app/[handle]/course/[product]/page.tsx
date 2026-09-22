import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { centsToPrice, normaliseHandle, storeForHandle } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { canSellProduct } from "@/lib/store-checkout";
import { everyLabel } from "@/lib/product-recurring";
import { isOpen, lessonCount, lessonsInOrder, readCourse } from "@/lib/course";
import { courseAccess, doneLessons, touchStudent } from "@/lib/learn";
import { CourseOutline } from "@/components/course-outline";

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Course — Nimbus Labs",
  robots: { index: false, follow: true },
};

const LINK_NOTICES: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Check your inbox",
    body: "If that address bought this course, a link to open it is on its way. It works for one hour.",
  },
  email: { title: "That address does not look right", body: "Check it and try again." },
  limited: { title: "Too many requests", body: "Wait a little, then ask again." },
  error: { title: "The email could not be sent", body: "Nothing is lost. Try again in a moment." },
  ask: {
    title: "One more step",
    body: "Type the address you paid with below and the way in is sent there.",
  },
};

/** The course's front door: its outline, and for a student, where they are. */
export default async function CoursePage({ params, searchParams }: Params) {
  const { handle: raw, product: productId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();
  const product = store.products.find((item) => item.id === productId);
  if (!product?.course) redirect(`/@${store.handle}`);
  const course = await readCourse(product.course.id);
  if (!course) redirect(`/@${store.handle}`);

  const query = await searchParams;
  const notice = LINK_NOTICES[typeof query.link === "string" ? query.link : ""] ?? null;
  const access = await courseAccess(store, product, await cookies());
  const open = access.state === "open";
  const start = open ? access.start : null;
  const done = open && !access.learner.owner ? await doneLessons(course.id, access.learner.email) : new Set<string>();
  if (open && !access.learner.owner) {
    const { email } = access.learner;
    after(() => touchStudent(course.id, email, access.start));
  }

  const all = lessonsInOrder(course);
  const total = lessonCount(course);
  const doneCount = all.filter(({ lesson }) => done.has(lesson.id)).length;
  const next = open
    ? all.find(({ lesson, unit }) => !done.has(lesson.id) && isOpen(unit, start!)) ?? all.find(({ unit }) => isOpen(unit, start!))
    : null;
  const preview = all.find(({ lesson }) => lesson.preview);
  const base = `/@${store.handle}/course/${product.id}`;
  const selling = canSellProduct(store, product);
  const price = product.recurring
    ? `$${centsToPrice(product.priceCents)} ${everyLabel(product.recurring.interval)}`
    : `$${centsToPrice(product.priceCents)}`;

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="flex items-center justify-center gap-3">
          {store.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(store.photoId)} alt="" width={48} height={48} className="st-avatar !mx-0" style={{ width: 48, height: 48 }} />
          ) : (
            <span aria-hidden="true" className="st-avatar st-avatar-initial !mx-0" style={{ width: 48, height: 48, fontSize: "1.25rem" }}>
              {store.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-semibold">{store.name}</span>
        </div>

        <div className="st-card mt-6 p-6 sm:p-8">
          <p className="st-label">Course</p>
          <h1 className="font-display mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl">{product.title}</h1>
          {product.summary ? <p className="st-muted mt-3 leading-relaxed">{product.summary}</p> : null}
          <p className="st-muted mt-3 text-sm font-semibold">
            {`${total} ${total === 1 ? "lesson" : "lessons"} in ${course.modules.length} ${course.modules.length === 1 ? "module" : "modules"}`}
          </p>

          {notice ? (
            <div className="st-note mt-6" role="status">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
              <p className="mt-1 text-sm">{notice.body}</p>
            </div>
          ) : null}

          {open && access.learner.owner ? (
            <div className="st-note mt-6">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>This is your own course</p>
              <p className="mt-1 text-sm">You see every lesson, as a student sees an open one. Nothing you do here is counted as progress.</p>
            </div>
          ) : null}

          {open ? (
            <div className="mt-6">
              {!access.learner.owner ? (
                <>
                  <p className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>
                    {`${doneCount} of ${total} done`}
                  </p>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full"
                    style={{ background: "var(--st-accent-soft)" }}
                    role="progressbar"
                    aria-label="Your progress"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={doneCount}
                  >
                    <div className="h-full rounded-full" style={{ width: `${total ? Math.round((doneCount / total) * 100) : 0}%`, background: "var(--st-accent)" }} />
                  </div>
                </>
              ) : null}
              {next ? (
                <Link href={`${base}/${next.lesson.id}`} className="btn st-btn btn-lg mt-5">
                  {doneCount === 0 ? "Start the first lesson" : doneCount >= total ? "Go back to the start" : "Continue where you left off"}
                </Link>
              ) : (
                <p className="st-muted mt-5 text-sm">The first lessons open soon: the dates are below.</p>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {selling ? (
                <form action="/api/store/checkout" method="post" data-checkout="">
                  <input type="hidden" name="handle" value={store.handle} />
                  <input type="hidden" name="product" value={product.id} />
                  <button type="submit" className="btn st-btn btn-lg btn-block">{`Buy the course · ${price}`}</button>
                </form>
              ) : (
                <p className="st-muted text-sm">{`${store.name}'s store is not taking payments right now.`}</p>
              )}
              {preview ? (
                <p className="text-sm">
                  <Link href={`${base}/${preview.lesson.id}`} className="font-semibold underline underline-offset-2" style={{ color: "var(--st-text)" }}>
                    {`Watch a free lesson first: ${preview.lesson.title}`}
                  </Link>
                </p>
              ) : null}
              <form action="/api/store/course/link" method="post" className="rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line)" }}>
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="product" value={product.id} />
                <label htmlFor="course-email" className="st-label">Already bought it?</label>
                <p className="st-muted mt-1 text-sm">Type the address you paid with and a link to open the course on this device is sent there. No password.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input id="course-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="st-field min-w-0 flex-1" />
                  <button type="submit" className="btn st-btn">Send me the link</button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="st-card mt-6 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">What is inside</h2>
          <div className="mt-4">
            <CourseOutline course={course} base={base} start={start} done={done} />
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Back to ${store.name}`}
          </Link>
        </div>
      </main>
    </div>
  );
}
