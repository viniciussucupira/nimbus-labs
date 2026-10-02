import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { readListing } from "@/lib/catalog";
import { readFeedToken } from "@/lib/podcast-access";
import { appLinks } from "@/lib/podcast-rules";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Your private podcast — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string; product: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Check your inbox",
    body: "If that address has this podcast, a link to its own feed is on its way. It comes from the store via Marktmorgen and usually arrives within a minute; if it is not there, look in spam.",
  },
  email: { title: "That does not look like an email address", body: "Type the address you bought it with." },
  limited: { title: "Too many requests for now", body: "Try again in an hour." },
  error: { title: "We could not send it just now", body: "Try again in a moment." },
};

/**
 * Where a buyer gets their own feed of a private podcast and adds it to their
 * podcast app; or, on another device, asks for it by email.
 */
export default async function PodcastPage({ params, searchParams }: Params) {
  const { handle: raw, product: productId } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const product = await readListing(store, productId);
  if (!product?.podcast) redirect(`/@${store.handle}`);
  const query = await searchParams;
  const token = typeof query.t === "string" ? query.t : "";
  const status = typeof query.status === "string" ? query.status : "";
  const grant = token ? await readFeedToken(token) : null;
  const mine = grant && grant.s === store.statsId && grant.p === product.id ? token : null;
  const feed = mine ? `${SITE_URL}/api/store/podcast/feed/${mine}.xml` : null;
  const notice = NOTICES[status];

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`} style={lookStyle(store.look) as React.CSSProperties}>
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          <p className="st-price text-sm">Private podcast</p>
          <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{product.title}</h1>
          {feed ? (
            <>
              <p className="st-muted mt-4 text-lg">
                This is your own feed. Open this page on your phone and pick your podcast app: new episodes then arrive in it like any show&apos;s.
              </p>
              <div className="mt-6 grid gap-3">
                {appLinks(feed).map((app) => (
                  <a key={app.name} href={app.href} className="btn st-btn btn-block">
                    {`Add to ${app.name}`}
                  </a>
                ))}
              </div>
              <label className="mt-6 block">
                <span className="st-label">Another app? Paste this address where it says &ldquo;add a show by URL&rdquo;</span>
                <input className="st-field mt-2 font-mono text-sm" readOnly value={feed} />
              </label>
              <p className="st-muted mt-4 text-sm">
                {`The feed is yours alone: please do not share it. It keeps working for as long as you have the podcast. Spotify does not take private feeds; Apple Podcasts, Overcast, Pocket Casts and most others do.`}
              </p>
            </>
          ) : (
            <>
              {notice ? (
                <div className="mt-5" role={status === "sent" ? "status" : "alert"}>
                  <p className="font-semibold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
                  <p className="st-muted mt-1">{notice.body}</p>
                </div>
              ) : (
                <p className="st-muted mt-4 text-lg">{`Bought it? Type the address you bought it with, and a link to your own feed is emailed to you.`}</p>
              )}
              <form action="/api/store/podcast/link" method="post" className="mt-6 space-y-3">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="product" value={product.id} />
                <label className="block">
                  <span className="st-label">Your email</span>
                  <input className="st-field mt-2" type="email" name="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" />
                </label>
                <button type="submit" className="btn st-btn btn-block">Email me my feed</button>
              </form>
            </>
          )}
          <div className="mt-8">
            <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">{`Back to ${store.name}`}</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
