import type { Metadata } from "next";
import { readListings } from "@/lib/catalog";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { commissionRate, nextPayday, paydayWords, payoutPromise } from "@/lib/affiliate-setting";
import {
  MAX_NOTE_LENGTH,
  affiliateCookieName,
  affiliateForSession,
  affiliateLink,
  affiliatesOn,
  buyersJoin,
  canApply,
  linkEmail,
  readBook,
} from "@/lib/affiliates";
import { AffiliateLinkBox } from "@/components/affiliate-link-box";

export const metadata: Metadata = {
  title: "Affiliates — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again.",
  },
  limited: {
    title: "Too many requests for now",
    body: "To keep this form from being used to flood somebody's inbox, it takes a limited number of requests an hour. Try again in an hour.",
  },
  unavailable: {
    title: "This store is not taking affiliates right now",
    body: "Nothing was sent.",
  },
  owner: {
    title: "This is the store's own address",
    body: "A store cannot be its own affiliate.",
  },
  full: {
    title: "This program is full",
    body: "It has as many affiliates as one store can hold. Write to the store if you would like to be considered.",
  },
  error: {
    title: "Something went wrong on our side",
    body: "Nothing was changed. Try again in a moment.",
  },
  expired: {
    title: "This link has expired",
    body: "An emailed link works once, within 24 hours. Ask for a new one below; it takes a few seconds.",
  },
  order: {
    title: "That order could not be read",
    body: "Open the link in your purchase email again, or apply below with the address you bought with.",
  },
  declined: {
    title: "You cannot join from your order",
    body: "This store decided on this address before. Write to the store if you think that should change.",
  },
  signedout: {
    title: "You are signed out on this browser",
    body: "To see your affiliate page again, ask for a new link below.",
  },
};

/** In the currency it was paid in; totals are in the store's (lib/affiliates.ts, readBook). */
const money = (cents: number, currency: string) => `${cents < 0 ? "-" : ""}${formatMoney(Math.abs(cents), currency)}`;
const day = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * A store's affiliate programme, seen from outside: its terms and the form to
 * apply, and — for an affiliate signed in on this browser — their link, their
 * clicks, the sales that came through it and what they earned and were paid.
 * Payouts are made by the creator, and every view of it says so.
 */
export default async function AffiliatesPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const status = typeof query.status === "string" ? query.status : "";
  const order = typeof query.order === "string" && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(query.order) ? query.order : "";
  const linkFor = token ? await linkEmail(store, token) : null;
  const affiliate = await affiliateForSession(store, (await cookies()).get(affiliateCookieName(store.handle))?.value);
  const on = affiliatesOn(store);
  const open = canApply(store);
  const terms = store.affiliates;
  const book = affiliate ? await readBook(store, affiliate.id) : null;
  const row = book?.rows[0] ?? null;
  // The next day the creator said they pay, or null when they promised none.
  const due = nextPayday(terms.payday);
  const notice = token && !linkFor ? NOTICES.expired : NOTICES[status] ?? null;
  // Products that earn differently from the store-wide share, by name.
  // Only products with a rate of their own can differ, so only those are read.
  const different = (await readListings(store, Object.keys(terms.rates)))
    .filter((p) => !p.hidden && p.priceCents > 0 && p.recurring === null && commissionRate(terms, p.id) !== terms.percent)
    .map((p) => ({ title: p.title, rate: commissionRate(terms, p.id) }));

  const form = (
    <form action="/api/store/affiliates/apply" method="post" className="mt-7 space-y-3">
      <input type="hidden" name="handle" value={store.handle} />
      <div aria-hidden="true" className="hidden">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor="aff-email" className="st-label">
        Your email
      </label>
      <input
        id="aff-email"
        type="email"
        name="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder="you@example.com"
        className="st-field"
      />
      <label htmlFor="aff-note" className="st-label pt-2">
        Where you would share it <span className="st-muted font-normal">(optional)</span>
      </label>
      <input
        id="aff-note"
        type="text"
        name="note"
        maxLength={MAX_NOTE_LENGTH}
        placeholder="My newsletter, my YouTube channel…"
        className="st-field"
      />
      <button type="submit" className="btn st-btn btn-block">
        Email me a link to apply
      </button>
      <p className="st-muted text-sm">
        No password. The link confirms the address is yours; opening it sends your application. Already an affiliate? The
        same form emails you the way back to your page.
      </p>
    </form>
  );

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-2xl px-4 py-14 sm:py-20">
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
          {token && linkFor ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                {`Continue as ${linkFor}`}
              </h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {`Press the button to open your affiliate page for ${store.name} on this browser. If you have not applied yet, this sends your application.`}
              </p>
              <form action="/api/store/affiliates/open" method="post" className="mt-7">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="btn st-btn btn-lg btn-block">
                  Open my affiliate page
                </button>
              </form>
            </>
          ) : affiliate ? (
            <>
              {status === "applied" || status === "welcome" || status === "joined" ? (
                <div className="st-note mb-6" role="status">
                  <p className="font-bold" style={{ color: "var(--st-text)" }}>
                    {status === "applied" ? "Your application is in" : status === "joined" ? "Your link is ready" : "You are signed in on this browser"}
                  </p>
                  <p className="mt-1 text-sm">
                    {status === "applied"
                      ? `${store.name} has been told. If they approve it, you get an email with your link.`
                      : status === "joined"
                        ? "Share it anywhere. You stay signed in on this browser for 30 days, and the same form below emails you the way back."
                        : "You stay signed in on this browser for 30 days."}
                  </p>
                </div>
              ) : null}
              <p className="st-price text-sm">
                {affiliate.status === "approved"
                  ? on
                    ? "Affiliate"
                    : "Program paused"
                  : affiliate.status === "pending"
                    ? "Waiting for approval"
                    : affiliate.status === "declined"
                      ? "Not approved"
                      : "No longer an affiliate"}
              </p>
              <h1 className="font-display mt-5 text-3xl font-semibold leading-tight tracking-[-0.02em]">
                {`Your affiliate page for ${store.name}`}
              </h1>
              <p className="st-muted mt-2 text-sm [overflow-wrap:anywhere]">{affiliate.email}</p>

              {affiliate.status === "approved" && on ? (
                <>
                  <p className="st-label mt-7">Your link</p>
                  <AffiliateLinkBox link={affiliateLink(store, affiliate.code)} />
                  <p className="st-muted mt-2 text-sm">
                    {`Or add ?via=${affiliate.code} to the address of any page of this store.`}
                  </p>
                </>
              ) : affiliate.status === "pending" ? (
                <p className="st-muted mt-5 leading-relaxed">
                  {`${store.name} decides on each application. If they approve yours, you get an email with your link.`}
                </p>
              ) : affiliate.status === "approved" ? (
                <p className="st-muted mt-5 leading-relaxed">
                  {`${store.name} has paused the program, so links do not earn right now. What you already earned is below.`}
                </p>
              ) : (
                <p className="st-muted mt-5 leading-relaxed">
                  {affiliate.status === "declined"
                    ? `${store.name} did not approve this application.`
                    : `${store.name} ended your place in the program, so your link no longer earns. What you earned before is below.`}
                </p>
              )}

              {row && book ? (
                <>
                  <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Clicks", value: row.clicks.toLocaleString("en-US") },
                      { label: "Sales", value: row.sales.toLocaleString("en-US") },
                      { label: "Earned", value: money(row.earned, book.currency) },
                      { label: row.owed < 0 ? "Paid ahead" : "Owed to you", value: money(Math.abs(row.owed), book.currency) },
                    ].map((tile) => (
                      <div key={tile.label} className="rounded-2xl px-4 py-3" style={{ background: "var(--st-accent-soft)" }}>
                        <dt className="st-muted text-xs font-semibold">{tile.label}</dt>
                        <dd className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--st-text)" }}>
                          {tile.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="st-muted mt-3 text-sm">
                    {`Paid to you so far: ${money(row.paid, book.currency)}. ${store.name} pays you directly, out of their own account. Nimbus Labs never holds this money, so there is no balance here to wait on and nothing to claim before a deadline.`}
                  </p>
                  <div className="st-note mt-4 text-sm" role="status">
                    <p className="font-semibold" style={{ color: "var(--st-text)" }}>
                      {payoutPromise(store.affiliates, store.name)}
                    </p>
                    {due ? (
                      <p className="mt-1">{`Next payment: ${paydayWords(due)}.`}</p>
                    ) : null}
                    {row.waiting > 0 ? (
                      <p className="mt-1">
                        {`${money(row.waiting, book.currency)} of what you are owed is still inside that wait, and is not payable yet.`}
                      </p>
                    ) : null}
                  </div>
                  {!book.refundsChecked ? (
                    <p className="st-note mt-4 text-sm" role="status">
                      Refunds could not all be checked just now, so a sale refunded recently may still show as earning. It is
                      corrected the next time this page opens.
                    </p>
                  ) : null}

                  <h2 className="mt-8 text-lg font-semibold">Sales through your link</h2>
                  {book.lines.length === 0 ? (
                    <p className="st-muted mt-2 text-sm">None yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y" style={{ borderColor: "var(--st-line)" }}>
                      {book.lines.slice(0, 50).map((line) => (
                        <li key={line.ref} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3" style={{ borderColor: "var(--st-line)" }}>
                          <span className="min-w-0">
                            <span className="block font-semibold">{line.title || "A product"}</span>
                            <span className="st-muted block text-xs">
                              {`${day(line.at)} · ${money(line.base, line.currency)} before tax · ${line.rate}%${line.status === "earned" ? "" : ` · ${line.status}`}`}
                            </span>
                          </span>
                          <span className="font-semibold tabular-nums">{money(line.commission, line.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {book.payouts.length ? (
                    <>
                      <h2 className="mt-8 text-lg font-semibold">{`Paid to you by ${store.name}`}</h2>
                      <ul className="mt-3 space-y-2 text-sm">
                        {book.payouts.map((payout) => (
                          <li key={payout.id} className="flex flex-wrap justify-between gap-x-4">
                            <span>{`${payout.date}${payout.reference ? ` · ${payout.reference}` : ""}`}</span>
                            <span className="font-semibold tabular-nums">{money(payout.cents, payout.currency)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : null}

              <form action="/api/store/affiliates/signout" method="post" className="mt-8">
                <input type="hidden" name="handle" value={store.handle} />
                <button type="submit" className="st-footer-link min-h-[44px] text-sm font-semibold">
                  Sign out on this browser
                </button>
              </form>
            </>
          ) : order && buyersJoin(store) ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                {`Earn ${terms.percent}% by sharing ${store.name}`}
              </h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {`You bought from ${store.name}, so you can have your own link now, without applying. A one-time purchase made through it within ${terms.days} ${terms.days === 1 ? "day" : "days"} of a click earns you ${terms.percent}% of what the buyer paid before tax.`}
              </p>
              <form action="/api/store/affiliates/join" method="post" className="mt-7">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="order" value={order} />
                <button type="submit" className="btn st-btn btn-lg btn-block">
                  Get my link
                </button>
              </form>
              <p className="st-muted mt-4 text-sm">
                {`${payoutPromise(terms, store.name)} ${store.name} pays you directly; Nimbus Labs never holds this money. You join with the address you bought with.`}
              </p>
            </>
          ) : status === "sent" ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">Check your inbox</h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {`The link is on its way. It comes from ${store.name} via Nimbus Labs and usually arrives within a minute. If it is not there, look in spam.`}
              </p>
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
                {on ? `Earn by sharing ${store.name}` : `${store.name} has no affiliate program right now`}
              </h1>
              {on ? (
                <>
                  <ul className="mt-6 space-y-3">
                    {[
                      `${terms.percent}% of what a buyer pays before tax, on one-time purchases made through your link (memberships and payment plans do not earn)${different.length ? "; some products differ, below" : ""}.`,
                      `A purchase counts if it is made within ${terms.days} ${terms.days === 1 ? "day" : "days"} of their last click on your link, and the last affiliate link they followed is the one credited.`,
                      "A refunded sale earns nothing, a partly refunded one earns only on what was kept, and your own purchases never earn.",
                      payoutPromise(terms, store.name),
                      store.affiliates.buyers
                        ? `Anybody who bought from ${store.name} can join at once, from their order; everyone else applies and ${store.name} decides. ${store.name} pays you directly out of their own account: Nimbus Labs never holds this money, so there is no minimum to reach and no deadline to claim it by.`
                        : `${store.name} approves every affiliate, and pays you directly out of their own account: Nimbus Labs never holds this money, so there is no minimum to reach and no deadline to claim it by.`,
                    ].map((line) => (
                      <li key={line} className="flex gap-3">
                        <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--st-accent)" }} />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  {different.length ? (
                    <ul className="st-muted mt-4 space-y-1 text-sm">
                      {different.map((p) => (
                        <li key={p.title}>{`${p.title}: ${p.rate === 0 ? "not part of the program" : `${p.rate}%`}`}</li>
                      ))}
                    </ul>
                  ) : null}
                  {open ? form : (
                    <p className="st-muted mt-6 text-sm">Applications cannot be sent from here right now. Try again later.</p>
                  )}
                </>
              ) : (
                <p className="st-muted mt-4 text-lg leading-relaxed">
                  {`When ${store.name} opens one, this is where to apply.`}
                </p>
              )}
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
