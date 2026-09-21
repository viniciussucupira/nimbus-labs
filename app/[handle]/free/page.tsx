import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { linkHost } from "@/lib/product-link";
import { readClaim } from "@/lib/free";

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
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-mint-brand/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-0 h-64 w-64 bg-sky-brand/20 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="rounded-[2rem] border-2 border-ink/5 bg-white p-7 shadow-xl shadow-ink/5 sm:p-10">
          {token ? (
            claimed && stillFree ? (
              <>
                <p className="inline-flex items-center gap-2 rounded-full bg-mint-brand px-4 py-1.5 text-sm font-black text-mint-deep">
                  <span aria-hidden="true">✓</span> Free
                </p>
                <h1 className="font-display mt-5 text-3xl font-black leading-tight sm:text-4xl">
                  {claimed.title}
                </h1>
                <p className="mt-4 text-lg text-ink-soft">
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
                    className="rounded-full bg-ink px-7 py-4 text-base font-bold text-white transition hover:-translate-y-0.5"
                  >
                    {claimed.link ? "Open it" : "Download it"}
                  </button>
                </form>
                {claimed.link ? (
                  <p className="mt-5 text-sm text-ink-soft">
                    {`It is kept on ${linkHost(claimed.link)} by ${store.name}, not here, so the button takes you there.`}
                  </p>
                ) : (
                  <p className="mt-5 text-sm text-ink-soft">
                    The link in your email works for 7 days, so you can come
                    back for it on another device.
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">
                  {claimed ? "This is no longer free" : "This link has expired"}
                </h1>
                <p className="mt-4 text-lg text-ink-soft">
                  {claimed
                    ? `${store.name} has changed it since the email was sent, so it is not handed out from this link.`
                    : "A free copy's link works for 7 days. Ask the store for a new one — it takes a few seconds."}
                </p>
              </>
            )
          ) : status === "sent" ? (
            <>
              <p className="inline-flex items-center gap-2 rounded-full bg-sky-brand/20 px-4 py-1.5 text-sm font-black text-ink">
                <span aria-hidden="true">✉</span> Sent
              </p>
              <h1 className="font-display mt-5 text-3xl font-black leading-tight sm:text-4xl">
                Check your inbox
              </h1>
              <p className="mt-4 text-lg text-ink-soft">
                {asked
                  ? `We emailed you a link to ${asked.title}.`
                  : "We emailed you a link."}{" "}
                It comes from {store.name} via Nimbus Labs and usually arrives
                within a minute. If it is not there, look in spam.
              </p>
              <p className="mt-4 text-sm text-ink-soft">
                Your address joins {store.name}&apos;s list only once you use
                that link, so a mistyped address never ends up on it.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">
                {(NOTICES[status] ?? NOTICES.error).title}
              </h1>
              <p className="mt-4 text-lg text-ink-soft">
                {(NOTICES[status] ?? NOTICES.error).body}
              </p>
            </>
          )}

          <div className="mt-8">
            <Link
              href={`/@${store.handle}`}
              className="text-sm font-semibold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Back to {store.name}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
