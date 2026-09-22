import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { linkHost } from "@/lib/product-link";
import { readClaim } from "@/lib/free";
import { lookStyle } from "@/lib/store-look";

export const metadata: Metadata = {
  title: "Your free copy — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. The copy goes to the address you type, so it has to be one you can open.",
  },
  limited: {
    title: "Too many requests for now",
    body: "To keep this form from being used to flood somebody's inbox, it takes a limited number of requests an hour. Try again in an hour.",
  },
  unavailable: {
    title: "This is not available right now",
    body: "Nothing was sent and nothing was kept. The store may still be setting it up.",
  },
  error: {
    title: "We could not send it just now",
    body: "Nothing was kept. Try again in a moment.",
  },
};

/**
 * Where a free copy is asked for and picked up.
 *
 * Two visits to the same page. The first comes straight from the store's form
 * and says to check the inbox. The second comes from the link in that email,
 * and shows one button. Opening the page never hands anything over and never
 * adds anybody to a list, because mail scanners open links too; only the
 * button does.
 */
export default async function FreePage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const status = typeof query.status === "string" ? query.status : "";
  const productId = typeof query.product === "string" ? query.product : "";
  // Nothing asked and nothing to pick up: the store itself is the page.
  if (!token && !status) redirect(`/@${store.handle}`);

  const claim = token ? await readClaim(token) : null;
  // The product the email named, looked up in the store as it is now. The
  // claim may be for a store's old address, which still leads here.
  const claimed = claim
    ? store.products.find((item) => item.id === claim.productId) ?? null
    : null;
  const asked = store.products.find((item) => item.id === productId) ?? null;
  const stillFree = claimed !== null && claimed.priceCents === 0;

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          {token ? (
            claimed && stillFree ? (
              <>
                <p className="st-price text-sm">
                  Free
                </p>
                <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">
                  {claimed.title}
                </h1>
                <p className="st-muted mt-4 text-lg">
                  From {store.name}. Press the button and it is yours.
                </p>
                <form
                  action="/api/store/free/download"
                  method="post"
                  className="mt-7"
                >
                  <input type="hidden" name="token" value={token} />
                  <button
                    type="submit"
                    className="btn st-btn btn-lg"
                  >
                    {claimed.link ? "Open it" : "Download it"}
                  </button>
                </form>
                {claimed.link ? (
                  <p className="st-muted mt-5 text-sm">
                    {`It is kept on ${linkHost(claimed.link)} by ${store.name}, not here, so the button takes you there.`}
                  </p>
                ) : (
                  <p className="st-muted mt-5 text-sm">
                    The link in your email works for 7 days, so you can come
                    back for it on another device.
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                  {claimed ? "This is no longer free" : "This link has expired"}
                </h1>
                <p className="st-muted mt-4 text-lg">
                  {claimed
                    ? `${store.name} has changed it since the email was sent, so it is not handed out from this link.`
                    : "A free copy's link works for 7 days. Ask the store for a new one — it takes a few seconds."}
                </p>
              </>
            )
          ) : status === "sent" ? (
            <>
              <p className="st-price text-sm">
                Sent
              </p>
              <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">
                Check your inbox
              </h1>
              <p className="st-muted mt-4 text-lg">
                {asked
                  ? `We emailed you a link to ${asked.title}.`
                  : "We emailed you a link."}{" "}
                It comes from {store.name} via Nimbus Labs and usually arrives
                within a minute. If it is not there, look in spam.
              </p>
              <p className="st-muted mt-4 text-sm">
                Your address joins {store.name}&apos;s list only once you use
                that link, so a mistyped address never ends up on it.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                {(NOTICES[status] ?? NOTICES.error).title}
              </h1>
              <p className="st-muted mt-4 text-lg">
                {(NOTICES[status] ?? NOTICES.error).body}
              </p>
            </>
          )}

          <div className="mt-8">
            <Link
              href={`/@${store.handle}`}
              className="st-footer-link text-sm font-semibold"
            >
              Back to {store.name}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
