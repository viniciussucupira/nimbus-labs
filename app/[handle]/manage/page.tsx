import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { MANAGE_LINK_SECONDS, canManage, linkIsLive } from "@/lib/membership-manage";

export const metadata: Metadata = {
  title: "Your membership — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. Use the address you pay with; it is the one Stripe sends your receipts to.",
  },
  limited: {
    title: "Too many requests for now",
    body: "To keep this form from being used to flood somebody's inbox, it takes a limited number of requests an hour. Try again in an hour.",
  },
  unavailable: {
    title: "This store cannot do this here",
    body: "Its payments are not connected to Stripe right now, so there is no membership to open from this page. Reply to the receipt Stripe emailed you and it reaches the store.",
  },
  error: {
    title: "Something went wrong on our side",
    body: "Nothing was changed. Try again in a moment.",
  },
  expired: {
    title: "This link has expired",
    body: "A link to your membership works for one hour. Ask for a new one below; it takes a few seconds.",
  },
  used: {
    title: "This link has been used too many times",
    body: "Ask for a new one below; it takes a few seconds.",
  },
};

/**
 * Where a member manages or cancels a membership, on their own.
 *
 * Two visits to the same page. The first asks for the address they pay with.
 * The second comes from the link in the email and shows one button. Opening
 * the page never changes anything; only the button asks Stripe for the
 * member's own page, where cancelling is one click.
 */
export default async function ManagePage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const status = typeof query.status === "string" ? query.status : "";
  const live = token ? await linkIsLive(token) : false;
  const available = canManage(store);
  const notice = token && !live ? NOTICES.expired : NOTICES[status] ?? null;
  const hours = Math.round(MANAGE_LINK_SECONDS / 3600);

  const form = (
    <form action="/api/store/manage" method="post" className="mt-7 space-y-3">
      <input type="hidden" name="handle" value={store.handle} />
      <div aria-hidden="true" className="hidden">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor="manage-email" className="st-label">
        The email you pay with
      </label>
      <input
        id="manage-email"
        type="email"
        name="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder="you@example.com"
        className="st-field"
      />
      <button type="submit" className="btn st-btn btn-block">
        Email me a link to my membership
      </button>
      <p className="st-muted text-sm">
        {`If that address has a membership with ${store.name}, a link to it arrives in a minute. It works for ${hours === 1 ? "one hour" : `${hours} hours`}. We say the same thing whether or not it does, so nobody can use this page to find out who is a member.`}
      </p>
    </form>
  );

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-xl px-4 py-14 sm:py-20">
        <div className="text-center">
          {store.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(store.photoId)} alt="" width={72} height={72} className="st-avatar" style={{ width: 72, height: 72 }} />
          ) : (
            <p aria-hidden="true" className="st-avatar st-avatar-initial" style={{ width: 72, height: 72, fontSize: "1.75rem" }}>
              {store.name.slice(0, 1).toUpperCase()}
            </p>
          )}
          <p className="st-muted mt-4 text-sm font-semibold">{store.name}</p>
        </div>

        <div className="st-card mt-6 p-6 sm:p-9">
          {token && live ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                Your membership
              </h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {`Press the button and Stripe shows your membership with ${store.name}. You can cancel it there in one click, change the card it is paid with, or see your receipts.`}
              </p>
              <form action="/api/store/manage/open" method="post" className="mt-7">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="btn st-btn btn-lg btn-block">
                  Open my membership
                </button>
              </form>
              <p className="st-muted mt-5 text-sm">
                If you cancel, the membership stays on until the end of the period you have already paid for, and nothing more is charged.
              </p>
            </>
          ) : status === "sent" ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                Check your inbox
              </h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {`If that address has a membership with ${store.name}, the link is on its way. It comes from ${store.name} via Nimbus Labs and usually arrives within a minute. If it is not there, look in spam.`}
              </p>
              <p className="st-muted mt-4 text-sm">
                Nothing arrived? You may pay with a different address. It is the one your Stripe receipts go to. Try that one below.
              </p>
              {available ? form : null}
            </>
          ) : (
            <>
              {notice ? (
                <div className="st-note mb-6">
                  <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
                  <p className="mt-1 text-sm">{notice.body}</p>
                </div>
              ) : null}
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                Manage or cancel your membership
              </h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {available
                  ? `Type the email you pay ${store.name} with and we send you a link to your membership. No account and no password: you cancel it yourself, in one click, on Stripe's own page.`
                  : `${store.name} cannot take payments through Stripe right now, so there is no membership to open from here. Reply to the receipt Stripe emailed you and it reaches them.`}
              </p>
              {available ? form : null}
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Back to ${store.name}`}
          </Link>
        </div>
      </main>
    </div>
  );
}
