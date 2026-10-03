import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { MANAGE_LINK_SECONDS, type Membership, canManage, membershipsFor } from "@/lib/membership-manage";
import { formatMoney } from "@/lib/money";
import { choicesFor, liveTiers } from "@/lib/tier-switch";

export const metadata: Metadata = {
  title: "Your membership — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. Use the address you pay with: the one you typed when you joined.",
  },
  limited: {
    title: "Too many requests for now",
    body: "To keep this form from being used to flood somebody's inbox, it takes a limited number of requests an hour. Try again in an hour.",
  },
  unavailable: {
    title: "This store cannot open memberships right now",
    body: "Its payments are not connected to Stripe right now, so there is no membership to open from this page. Reply to your order confirmation email and it reaches the store.",
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
  switched: {
    title: "Your membership was switched",
    body: "What the new plan includes is open to you now, and a receipt is on its way to your inbox.",
  },
  declined: {
    title: "The card was not charged, so nothing changed",
    body: "Your bank declined the payment or asked for a step we could not show here. Update your card with \u201cChange card or see receipts\u201d below, then try the switch again.",
  },
  stale: {
    title: "That price was more than 15 minutes old",
    body: "Nothing was changed. Pick the plan again to see the price as it stands now.",
  },
  busy: {
    title: "A switch was already under way",
    body: "Wait a moment and look at your membership below before trying again.",
  },
  "cannot-switch": {
    title: "That switch cannot be made",
    body: "The plan may no longer be offered, or the membership may be canceled or waiting on a payment. Nothing was changed.",
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
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const status = typeof query.status === "string" ? query.status : "";
  // Reading the memberships spends nothing: opening this page is never an
  // action, so a mail scanner following the link changes and uses up nothing.
  const memberships: Membership[] | null = token ? await membershipsFor(store, token) : null;
  const live = memberships !== null;
  // The plans each membership can switch to (lib/tier-switch.ts).
  const tiers = memberships?.length ? await liveTiers(store).catch(() => []) : [];
  const available = canManage(store);
  const notice = token && !live ? NOTICES.expired : NOTICES[status] ?? null;
  const hours = Math.round(MANAGE_LINK_SECONDS / 3600);
  // Out loud, the way a member thinks about what they pay: "$29 a month".
  const every = (m: Membership) => {
    const unit = m.interval === "year" ? "year" : m.interval === "week" ? "week" : m.interval === "day" ? "day" : "month";
    return m.intervalCount === 1 ? `a ${unit}` : `every ${m.intervalCount} ${unit}s`;
  };
  const endDate = (at: number) =>
    new Date(at * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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
        {`If that address has a membership with ${store.name}, a link to it usually arrives within a minute. It works for ${hours === 1 ? "one hour" : `${hours} hours`}. We say the same thing whether or not it does, so nobody can use this page to find out who is a member.`}
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
              {notice ? (
                <div className="st-note mb-6">
                  <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
                  <p className="mt-1 text-sm">{notice.body}</p>
                </div>
              ) : null}
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                {memberships.length > 1 ? "Your memberships" : "Your membership"}
              </h1>

              {/* Each membership with its own way out. Cancel goes straight to
                  Stripe's own cancellation page for that one membership. */}
              {memberships.length ? (
                <ul className="mt-6 space-y-3">
                  {memberships.map((m) => (
                    <li key={m.id} className="st-row">
                      <div className="min-w-0">
                        <p className="font-bold" style={{ color: "var(--st-text)" }}>{m.title}</p>
                        <p className="st-muted text-sm">
                          {m.amount ? `${formatMoney(m.amount, m.currency)} ${every(m)}` : null}
                          {m.endsAt ? `${m.amount ? " · " : ""}Ends ${endDate(m.endsAt)}` : null}
                        </p>
                      </div>
                      {m.endsAt === null ? (
                        <form action="/api/store/manage/cancel" method="post">
                          <input type="hidden" name="handle" value={store.handle} />
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="subscription" value={m.id} />
                          <button type="submit" className="btn btn-secondary btn-sm">
                            Cancel
                          </button>
                        </form>
                      ) : null}
                      {(() => {
                        const choices = choicesFor(store, m, tiers);
                        if (!choices.length) return null;
                        return (
                          <details className="mt-3 w-full basis-full">
                            <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--st-text)" }}>
                              Switch plan
                            </summary>
                            <ul className="mt-2 space-y-2">
                              {choices.map((c) => (
                                <li key={c.id}>
                                  <Link
                                    prefetch={false}
                                    href={`/@${store.handle}/manage/switch?token=${token}&sub=${m.id}&to=${c.id}`}
                                    className="st-row text-sm"
                                  >
                                    <span className="basis-full font-bold" style={{ color: "var(--st-text)" }}>{c.title}</span>
                                    <span className="st-muted -mt-2 basis-full">{`${c.words}${c.way === "up" ? " · upgrade" : c.way === "down" ? " · downgrade" : ""}`}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                            <p className="st-muted mt-2 text-xs">You see the exact amount before anything is charged.</p>
                          </details>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="st-muted mt-4 text-lg leading-relaxed">
                  {`Stripe could not list your memberships just now. The button below opens them all on Stripe's own page, where you can cancel.`}
                </p>
              )}

              <form action="/api/store/manage/open" method="post" className="mt-6">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="btn st-btn btn-lg btn-block">
                  {memberships.length ? "Change card or see receipts" : "Open my membership"}
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
                {`If that address has a membership with ${store.name}, the link is on its way. It comes from ${store.name} via Marktmorgen and usually arrives within a minute. If it is not there, look in spam.`}
              </p>
              <p className="st-muted mt-4 text-sm">
                Nothing arrived? You may pay with a different address: the one you typed when you joined. Try that one below.
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
                  ? `Type the email you pay ${store.name} with, and we will email you a link to your membership. No account and no password: you cancel it yourself, on Stripe's own page.`
                  : `${store.name} cannot take payments through Stripe right now, so there is no membership to open from here. Reply to your order confirmation email and it reaches them.`}
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
