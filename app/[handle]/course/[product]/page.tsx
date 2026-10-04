import { paypalReady } from "@/lib/paypal-sales";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { canSellProduct } from "@/lib/store-checkout";
import { membershipPrice } from "@/lib/product-recurring";
import { activePwyw } from "@/lib/pay-what-you-want";
import { beforeStart, isCohort, isOpen, lessonCount, lessonsInOrder, readCourse } from "@/lib/course";
import { courseAccess, doneLessons, emailKey, touchStudent } from "@/lib/learn";
import { heldBack, passedQuizzes, requiredQuizLessons } from "@/lib/quiz";
import { MAX_CERT_NAME, MIN_CERT_NAME, certificateOf, hasFinished } from "@/lib/certificate";
import { canManage } from "@/lib/membership-manage";
import { CourseOutline } from "@/components/course-outline";
import { LocalDay } from "@/components/local-day";
import { readListing } from "@/lib/catalog";

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Course — Marktmorgen",
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
    body: "Type the address you paid with below, and a link to open the course is sent there.",
  },
};

const CERT_NOTICES: Record<string, string> = {
  name: `Type your name as it should appear, between ${MIN_CERT_NAME} and ${MAX_CERT_NAME} characters.`,
  unfinished: "Finish every lesson first, and pass the quizzes that have to be passed.",
};

/** The course's front door: its outline, and for a student, where they are. */
export default async function CoursePage({ params, searchParams }: Params) {
  const { handle: raw, product: productId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const product = await readListing(store, productId);
  if (!product?.course) redirect(`/@${store.handle}`);
  const course = await readCourse(product.course.id);
  if (!course) redirect(`/@${store.handle}`);

  const query = await searchParams;
  const notice = LINK_NOTICES[typeof query.link === "string" ? query.link : ""] ?? null;
  const access = await courseAccess(store, product, await cookies());
  const open = access.state === "open";
  const start = open ? access.start : null;
  const studying = open && !access.learner.owner;
  const who = studying ? emailKey(access.learner.email) : "";
  const [done, passed, certificate] = studying
    ? await Promise.all([
        doneLessons(course.id, access.learner.email),
        passedQuizzes(course.id, who),
        course.certificate ? certificateOf(course.id, who) : Promise.resolve(null),
      ])
    : [new Set<string>(), new Set<string>(), null];
  if (open && !access.learner.owner) {
    const { email } = access.learner;
    after(() => touchStudent(course.id, email, access.start));
  }
  // Lessons a quiz that has to be passed still holds shut, for this student.
  const held = studying ? heldBack(course, passed) : new Map<string, string>();
  const finished = studying && hasFinished(course, done, passed);
  const mustPass = requiredQuizLessons(course).length;
  const certNotice = CERT_NOTICES[typeof query.cert === "string" ? query.cert : ""] ?? null;

  const all = lessonsInOrder(course);
  const total = lessonCount(course);
  const doneCount = all.filter(({ lesson }) => done.has(lesson.id)).length;
  const reachable = (entry: (typeof all)[number]) => isOpen(course, entry.unit, start!) && !held.has(entry.lesson.id);
  const next = open
    ? all.find((entry) => !done.has(entry.lesson.id) && reachable(entry)) ?? all.find(reachable)
    : null;
  const preview = all.find(({ lesson }) => lesson.preview);
  const base = `/@${store.handle}/course/${product.id}`;
  const selling = canSellProduct(store, product);
  // Said with every term the checkout will apply: a trial, a set number of
  // payments, a price the buyer chooses.
  const price = product.recurring
    ? membershipPrice(product.recurring, `${formatMoney(product.priceCents, store.currency)}`)
    : activePwyw(product)
      ? `${formatMoney(product.priceCents, store.currency)} or more, you choose`
      : `${formatMoney(product.priceCents, store.currency)}`;

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
            {[
              `${total} ${total === 1 ? "lesson" : "lessons"} in ${course.modules.length} ${course.modules.length === 1 ? "module" : "modules"}`,
              course.certificate ? "certificate of completion" : null,
            ]
              .filter(Boolean)
              .join(" \u00b7 ")}
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
              {course.certificate ? (
                <p className="mt-2 text-sm">
                  <Link href={`/@${store.handle}/certificate/sample?product=${product.id}`} className="font-semibold underline underline-offset-4" style={{ color: "var(--st-text)" }}>
                    See the certificate students get
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          {access.state === "ended" ? (
            <div className="st-note mt-6" role="status">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>Your membership has ended</p>
              <p className="mt-1 text-sm">
                {`This course came with your membership, which is no longer running, so its lessons are closed now. Renew and it opens right away, with your progress where you left it.`}
              </p>
              {canManage(store) ? (
                <p className="mt-2 text-sm">
                  {"Did it end because a payment failed, not because you canceled? Updating the card may bring it back: "}
                  <Link href={`/@${store.handle}/manage`} className="font-semibold underline underline-offset-4" style={{ color: "var(--st-text)" }}>
                    manage your membership
                  </Link>
                  .
                </p>
              ) : null}
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

              {studying && course.certificate ? (
                <div id="certificate" className="mt-6 scroll-mt-6 rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line-strong)" }}>
                  <p className="st-label">Certificate of completion</p>
                  {certificate ? (
                    <>
                      <p className="st-muted mt-1 text-sm">{`Issued to ${certificate.name}. Anyone you share the link with can check it is real.`}</p>
                      <Link href={`/@${store.handle}/certificate/${certificate.id}`} className="btn st-btn mt-3">
                        Open your certificate
                      </Link>
                    </>
                  ) : finished ? (
                    <form action="/api/store/course/certificate" method="post" className="mt-2">
                      <input type="hidden" name="handle" value={store.handle} />
                      <input type="hidden" name="product" value={product.id} />
                      <label htmlFor="cert-name" className="st-muted block text-sm">
                        You finished the course. Type your name exactly as it should be printed; it cannot be changed afterward.
                      </label>
                      {certNotice ? (
                        <p className="mt-2 text-sm font-semibold" role="alert" style={{ color: "var(--st-text)" }}>
                          {certNotice}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          id="cert-name"
                          name="name"
                          required
                          minLength={MIN_CERT_NAME}
                          maxLength={MAX_CERT_NAME}
                          autoComplete="name"
                          placeholder="Your full name"
                          className="st-field min-w-0 flex-1"
                        />
                        <button type="submit" className="btn st-btn">Get my certificate</button>
                      </div>
                    </form>
                  ) : (
                    <p className="st-muted mt-1 text-sm">
                      {mustPass > 0
                        ? `Finish every lesson and pass ${mustPass === 1 ? "the quiz that has" : `the ${mustPass} quizzes that have`} to be passed, and you can print yours with your name on it.`
                        : "Finish every lesson and you can print yours with your name on it."}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {selling ? (
                <form action="/api/store/checkout" method="post" data-checkout="">
                  <input type="hidden" name="handle" value={store.handle} />
                  <input type="hidden" name="product" value={product.id} />
                  <button type="submit" className="btn st-btn btn-lg btn-block">{`${access.state === "ended" ? "Renew" : "Buy the course"} · ${price}`}</button>
                </form>
              ) : paypalReady(store, product) ? (
                <Link href={`/@${store.handle}/p/${product.id}#buy`} className="btn st-btn btn-lg btn-block">{`Buy the course with PayPal · ${price}`}</Link>
              ) : (
                <p className="st-muted text-sm">{`${store.name}'s store is not taking payments right now.`}</p>
              )}
              {preview ? (
                <p className="text-sm">
                  <Link href={`${base}/${preview.lesson.id}`} className="font-semibold underline underline-offset-2" style={{ color: "var(--st-text)" }}>
                    {`Try a free lesson first: ${preview.lesson.title}`}
                  </Link>
                </p>
              ) : null}
              {access.state === "ended" ? null : (
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
              )}
            </div>
          )}
        </div>

        <div className="st-card mt-6 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">What is inside</h2>
          {/*
            A course that runs to a timetable says so here, above the
            outline, and says it to a visitor as well as to a student.

            Somebody who has bought and is waiting needs to be told they are
            waiting on a date and not on something they failed to do — a page
            of locked modules with no explanation reads as a broken purchase.
            Somebody who has not bought needs it before they pay, because a
            course that begins in three weeks is a different thing from one
            that begins when you press the button, and finding that out after
            paying is the kind of surprise that earns a refund.
          */}
          {isCohort(course) ? (
            <p className="st-muted mt-3 text-sm">
              {beforeStart(course)
                ? "Everyone on this course moves through it together. It begins on "
                : "Everyone on this course moves through it together. It began on "}
              <LocalDay seconds={course.startsAt!} />
              {beforeStart(course)
                ? ", and the first module opens that morning — buying earlier holds your place rather than starting you early."
                : ", and everything released up to now is open to you from the day you join."}
            </p>
          ) : null}
          <div className="mt-4">
            <CourseOutline course={course} base={base} start={start} done={done} held={held} />
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
