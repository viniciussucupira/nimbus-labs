import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { StoreTracking } from "@/components/store-tracking";
import { speech } from "@/lib/buyer-words";
import { contactWords } from "@/lib/buyer-words/contact";

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);
  const store = decoded.startsWith("@") ? await storeForPage(normaliseHandle(decoded)) : null;
  return { title: `${contactWords(store?.language).pageTitle} — Marktmorgen`, robots: { index: false, follow: false } };
}

/** What happened to a message sent from a store page's contact form (lib/store-contact.ts). */
export default async function ContactPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : "";
  if (!status) redirect(`/@${store.handle}`);
  const said = speech(store);
  const w = contactWords(store.language);
  const notice = status === "sent" ? { title: w.sentTitle, body: w.sentBody(store.name) } : (w.notices[status] ?? w.notices.error);
  return (
    <div lang={said.lang.locale} className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`} style={lookStyle(store.look) as React.CSSProperties}>
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{notice.title}</h1>
          <p className="st-muted mt-4 text-lg">{notice.body}</p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            <Link href={`/@${store.handle}${status === "sent" ? "" : "#contact"}`} className="st-footer-link text-sm font-semibold">
              {said.w.backTo(store.name)}
            </Link>
            <StoreTracking store={store} presence event={null} />
          </div>
        </div>
      </main>
    </div>
  );
}
