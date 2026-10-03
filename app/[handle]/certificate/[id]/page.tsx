import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { SITE_URL } from "@/lib/site-url";
import { storeKey } from "@/lib/learn";
import { CERT_ID_PATTERN, type Certificate, readCertificate } from "@/lib/certificate";
import { readCourse } from "@/lib/course";
import { CertificateActions } from "@/components/certificate-actions";
import { readCourseListing } from "@/lib/catalog";

type Params = {
  params: Promise<{ handle: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

async function load(rawHandle: string, id: string, product: string | undefined) {
  const decoded = decodeURIComponent(rawHandle);
  if (!decoded.startsWith("@")) return null;
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) return null;
  // The sample a creator looks at before any student has finished: the
  // course's real title and the creator's name, a placeholder for the rest.
  if (id === "sample") {
    const found = await readCourseListing(store, product);
    const course = found?.course ? await readCourse(found.course.id) : null;
    if (!found || !course?.certificate) return null;
    const sample: Certificate = {
      id: "sample",
      store: storeKey(store),
      productId: found.id,
      courseId: course.id,
      name: "Your student's name",
      title: found.title,
      creator: store.name,
      email: "",
      issuedAt: Math.floor(Date.now() / 1000),
      withdrawnAt: 0,
    };
    return { store, certificate: sample, sample: true };
  }
  if (!CERT_ID_PATTERN.test(id)) return null;
  const certificate = await readCertificate(id);
  // A certificate is only ever shown under the store that issued it, at any
  // address that store has used.
  if (!certificate || certificate.store !== storeKey(store)) return null;
  return { store, certificate, sample: false };
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { handle, id } = await params;
  const query = await searchParams;
  const found = await load(handle, id, typeof query.product === "string" ? query.product : undefined);
  if (!found) return { title: "Certificate not found — Marktmorgen", robots: { index: false, follow: false } };
  const { certificate } = found;
  return {
    title: `${certificate.name}: ${certificate.title} — certificate of completion`,
    description: `${certificate.name} completed ${certificate.title}, taught by ${certificate.creator}.`,
    robots: { index: false, follow: false },
  };
}

/**
 * A certificate of completion, and the proof of it.
 *
 * Everything on the sheet is read from the record kept when it was issued
 * (lib/certificate.ts): nothing in the address can change a word of it, so
 * the page itself is the check. It prints on one landscape page, and the
 * browser's own print dialog saves it as a PDF.
 */
export default async function CertificatePage({ params, searchParams }: Params) {
  const { handle, id } = await params;
  const query = await searchParams;
  const found = await load(handle, id, typeof query.product === "string" ? query.product : undefined);
  if (!found) notFound();
  const { store, certificate, sample } = found;
  const withdrawn = certificate.withdrawnAt > 0;
  const url = `${SITE_URL}/@${store.handle}/certificate/${certificate.id}`;
  const shortUrl = url.replace(/^https?:\/\//, "");
  const issued = DATE.format(new Date(certificate.issuedAt * 1000));

  return (
    <div
      className={`st-page st-theme-${store.look.theme} cert-page relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="cert-noprint mx-auto max-w-3xl">
          {sample ? (
            <div className="st-note text-sm" role="status">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>A sample</p>
              <p className="mt-1">
                This is what a student who finishes the course gets, with the name they type. Theirs has an address of its own that anyone can open to check it.
              </p>
            </div>
          ) : withdrawn ? (
            <div className="rounded-2xl bg-danger-soft px-5 py-4 text-sm text-ink" role="status">
              <p className="font-bold">{`This certificate was withdrawn on ${DATE.format(new Date(certificate.withdrawnAt * 1000))}.`}</p>
              <p className="mt-1">{`${certificate.creator} withdrew it, so it no longer certifies anything. If it is yours, the course page lets you issue it again.`}</p>
            </div>
          ) : (
            <div className="rounded-2xl px-5 py-4 text-sm" style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }} role="status">
              <p className="font-bold">
                <span aria-hidden="true">{"✓ "}</span>
                {query.issued === "1" ? "Your certificate is ready." : "This certificate is genuine."}
              </p>
              <p className="mt-1">
                {`It is on record with Marktmorgen, issued on behalf of ${store.name} on ${issued}. This page is the proof: share its link and anyone can open it to check.`}
              </p>
            </div>
          )}
          {sample || withdrawn ? null : (
            <div className="mt-5">
              <CertificateActions url={url} />
            </div>
          )}
        </div>

        <article
          className={`cert-sheet mx-auto mt-6 ${withdrawn ? "cert-withdrawn" : ""}`}
          aria-label={`Certificate of completion for ${certificate.name}`}
        >
          <div className="cert-frame">
            <div className="cert-head">
              {store.photoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(store.photoId)} alt="" className="cert-avatar" />
              ) : (
                <span aria-hidden="true" className="cert-avatar cert-avatar-initial">
                  {store.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="cert-store">{store.name}</span>
            </div>

            <p className="cert-kicker">Certificate of <span className="font-accent">completion</span></p>
            <p className="cert-lead">This certifies that</p>
            <p className="cert-name">{certificate.name}</p>
            <p className="cert-lead">has completed</p>
            <p className="cert-title">{certificate.title}</p>
            <p className="cert-by">{`taught by ${certificate.creator}, on ${issued}`}</p>

            <div className="cert-foot">
              <div className="cert-seal" aria-hidden="true">
                <span>{"✓"}</span>
              </div>
              <div className="cert-proof">
                <p>{sample ? "Certificate ID: issued when a student finishes" : `Certificate ID ${certificate.id}`}</p>
                <p>{sample ? "Checked at its own address on marktmorgen.com" : `Check it at ${shortUrl}`}</p>
              </div>
            </div>
            {sample ? <p className="cert-stamp" aria-hidden="true">Sample</p> : withdrawn ? <p className="cert-stamp" aria-hidden="true">Withdrawn</p> : null}
          </div>
        </article>

        <div className="cert-noprint mt-8 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Visit ${store.name}`}
          </Link>
        </div>
      </main>
    </div>
  );
}
