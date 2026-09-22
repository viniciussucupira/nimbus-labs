import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { storeFolder, storeForEmail } from "@/lib/store";
import { lessonCount, readCourse } from "@/lib/course";
import { studentsOf } from "@/lib/learn";
import { canSellProduct } from "@/lib/store-checkout";
import { CourseEditor, StudentAccess } from "@/components/course-editor";

export const metadata: Metadata = {
  title: "Your course — Nimbus Labs",
  robots: { index: false, follow: false },
};

function day(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Where a creator builds a course: modules, lessons, and who is taking it. */
export default async function StudioCoursePage({ params }: { params: Promise<{ product: string }> }) {
  const { product: productId } = await params;
  const cookieStore = await cookies();
  const email = await emailForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect("/signin");
  const store = await storeForEmail(email);
  const product = store?.products.find((p) => p.id === productId);
  if (!store || !product?.course) redirect("/studio");
  const course = await readCourse(product.course.id);
  if (!course) redirect("/studio");
  const folder = await storeFolder(email);
  const { students, total } = await studentsOf(course, 500);
  const lessons = lessonCount(course);
  const finished = students.filter((s) => lessons > 0 && s.done >= lessons).length;
  const started = students.filter((s) => s.done > 0).length;
  const selling = canSellProduct(store, product);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-3">
          <Link href="/" className="shrink-0 rounded-[10px]" aria-label="Nimbus Labs, home">
            <Logo />
          </Link>
          <Link href="/studio" className="btn btn-secondary btn-sm">Back to the studio</Link>
        </div>
      </header>

      <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
        <p className="eyebrow">Course</p>
        <h1 className="t-h2 mt-3 break-words">{product.title}</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Modules hold lessons. A lesson can have a video, text, downloads and a link, and any lesson can be a free
          preview on your store. A module can open a number of days after each student joins, and they get an email
          the day it does.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-bold">
          <Link href={`/@${store.handle}/course/${product.id}`} className="text-ink-soft underline underline-offset-4 hover:text-violet-deep">
            See it as a student does
          </Link>
          <span className="text-ink-mute">
            {selling
              ? "On sale on your store."
              : lessons === 0
                ? "Add the first lesson and it can go on sale."
                : "Not on sale yet: your store needs Stripe connected and a running subscription."}
          </span>
        </div>

        <CourseEditor productId={product.id} initial={course} folder={folder} />

        <section className="card mt-8 p-6 sm:p-8" aria-labelledby="students-title">
          <h2 id="students-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">Students</h2>
          <p className="mt-2 text-ink-soft">
            Everyone who has opened the course since buying it, with how many lessons they marked done. Buyers are
            read from your own Stripe account; this list is what they did here.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-[var(--r-sm)] bg-sand p-4">
              <p className="text-2xl font-semibold tabular-nums">{total}</p>
              <p className="text-sm text-ink-soft">opened it</p>
            </div>
            <div className="rounded-[var(--r-sm)] bg-sand p-4">
              <p className="text-2xl font-semibold tabular-nums">{started}</p>
              <p className="text-sm text-ink-soft">finished a lesson</p>
            </div>
            <div className="rounded-[var(--r-sm)] bg-sand p-4">
              <p className="text-2xl font-semibold tabular-nums">{finished}</p>
              <p className="text-sm text-ink-soft">finished it all</p>
            </div>
          </div>
          {students.length === 0 ? (
            <p className="mt-5 rounded-[var(--r-md)] bg-sand p-5 text-sm text-ink-soft">Nobody has opened it yet.</p>
          ) : (
            <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Students, one row each">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-ink-mute">
                    <th scope="col" className="py-2 pr-3 font-semibold">Student</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Joined</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Done</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Last here</th>
                    <th scope="col" className="py-2 font-semibold"><span className="sr-only">Access</span></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.email} className="border-t border-line align-top">
                      <td className="max-w-[14rem] break-all py-2 pr-3">{student.email}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{day(student.since)}</td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{`${Math.min(student.done, lessons)} of ${lessons}`}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{day(student.lastSeen)}</td>
                      <td className="py-2">
                        <StudentAccess productId={product.id} email={student.email} blocked={student.blocked} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
