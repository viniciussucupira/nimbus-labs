import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icons";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import {
  centsToPrice,
  isFree,
  ensureStatsId,
  setSubscription,
  storeForEmail,
  storeFolder,
} from "@/lib/store";
import { HandleForm } from "@/components/handle-form";
import { RenameForm } from "@/components/rename-form";
import { OldAddresses } from "@/components/old-addresses";
import { DetailsForm } from "@/components/details-form";
import { LookEditor } from "@/components/look-editor";
import { catchUpBookings, paidCalls } from "@/lib/calls";
import { readSales, readStats, studioStats } from "@/lib/stats";
import { StatsPanel } from "@/components/stats-panel";
import { PixelEditor } from "@/components/pixel-editor";
import { SITE_URL } from "@/lib/site-url";
import { readableTime, zoneName } from "@/lib/call-setup";
import { ProductEditor } from "@/components/product-editor";
import { LinkEditor } from "@/components/link-editor";
import { DiscountEditor } from "@/components/discount-editor";
import {
  COUNTRIES,
  isConnectConfigured,
  isConnectInTestMode,
} from "@/lib/stripe-connect";
import { ORDERS_PAGE_SIZE, canSell, listSales } from "@/lib/store-checkout";
import { deliveredThisMonth } from "@/lib/delivery";
import { MAX_LEADS, listSize } from "@/lib/free";
import { readableSize } from "@/lib/product-file";
import {
  PRICE_CENTS,
  TRIAL_DAYS,
  isBillingConfigured,
  readSubscription,
} from "@/lib/billing";

export const metadata: Metadata = {
  title: "Your account — Nimbus Labs",
  robots: { index: false, follow: false },
};

const NEXT_WHEN_SELLING = [
  "Upsells and limited offers at checkout",
  "Courses with lessons",
  "Email to your list, from your studio",
  "Your own domain",
];
/** Calls that have not ended yet, soonest first. */
function upcoming<T extends { start: number; end: number }>(list: T[]): T[] {
  const now = Date.now();
  return list.filter((call) => call.end > now).sort((a, b) => a.start - b.start);
}

const NEXT_WHEN_NOT = [
  "The checkout that pays into your account",
  "The list of what you have sold",
];

const STRIPE_NOTICES: Record<string, { title: string; body: string }> = {
  ready: {
    title: "Stripe says your account can take payments",
    body: "That is Stripe's answer, not ours. Your store can take money now, and what you sell shows up further down this page.",
  },
  pending: {
    title: "Stripe still wants something from you",
    body: "Coming back here does not mean Stripe is satisfied. Open the connection again and finish what it asks for.",
  },
  forgotten: {
    title: "Forgotten on this side",
    body: "Your Stripe account is untouched and still yours. To remove Nimbus from it as well, do that in your own Stripe dashboard.",
  },
  notstarted: {
    title: "There is no connection yet",
    body: "Start it below.",
  },
  nostore: {
    title: "Take your address first",
    body: "A Stripe account is connected to a store, and there is no store yet.",
  },
  unavailable: {
    title: "Connecting is not switched on yet",
    body: "The platform side of Stripe is not configured, so nothing would happen. Nothing was changed.",
  },
  country: {
    title: "Stripe needs to know where you are",
    body: "Pick the country your bank account is in before connecting. It is fixed once the account is open, so it is worth a second's thought.",
  },
  "country-unsupported": {
    title: "Stripe will not open an account in that country from here",
    body: "Nothing was charged and nothing was created. This is a limit on our side, not a judgement on you: our own Stripe account is registered in a country Stripe does not yet let us open accounts from into yours. Write to us and we will tell you honestly whether that is changing.",
  },
  error: {
    title: "Stripe did not answer as expected",
    body: "Nothing was changed. Try again in a moment.",
  },
};


const BILLING_NOTICES: Record<string, { title: string; body: string }> = {
  on: {
    title: "You are subscribed",
    body: "Your trial has started and your store can take money. Nothing is charged until the trial ends, and you can cancel it on this page at any time.",
  },
  cancelling: {
    title: "Cancelled",
    body: "Nothing more will be charged. Your store keeps taking payments until the date below, and you can change your mind on this page until then.",
  },
  resumed: {
    title: "Your subscription continues",
    body: "The cancellation is undone. Nothing else changed.",
  },
  none: {
    title: "There is no subscription to change",
    body: "This store has not started one, so there is nothing to cancel.",
  },
  ended: {
    title: "This subscription has already ended",
    body: "Stripe says it is over, so there was nothing left to cancel and nothing was charged.",
  },
  "cancel-error": {
    title: "Stripe did not answer",
    body: "Nothing changed. Try again in a moment.",
  },
  pending: {
    title: "Stripe has not confirmed the payment yet",
    body: "The subscription exists but is not in good standing yet. Open it again in a moment; nothing here was lost.",
  },
  cancelled: {
    title: "Nothing was started",
    body: "You closed the payment page. No card was charged and your store is exactly as you left it.",
  },
  unfinished: {
    title: "That did not finish",
    body: "Stripe has no completed subscription for this store, so nothing was written down. Start it again below.",
  },
  already: {
    title: "You already pay for this store",
    body: "There is nothing to start. One store, one subscription.",
  },
  unavailable: {
    title: "Paying is not switched on yet",
    body: "Our side of Stripe is not configured, so nothing would happen. Nothing was changed.",
  },
  error: {
    title: "Stripe did not answer as expected",
    body: "Nothing was charged. Try again in a moment.",
  },
};

const ADDRESS_NOTICES: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Check the new address",
    body: "We sent a link there. Opening it and tapping the button finishes the move. Nothing has changed yet, and the old address stays in charge until it does.",
  },
  moved: {
    title: "Your account moved",
    body: "This address signs you in from now on. Every session the old one had open is closed.",
  },
  same: {
    title: "That is the address you already use",
    body: "Nothing to move.",
  },
  invalid: {
    title: "That does not look like an email address",
    body: "Check it and try again.",
  },
  taken: {
    title: "That address already has a store",
    body: "An account cannot be moved on top of another one.",
  },
  none: {
    title: "There is no store to move yet",
    body: "Take your address first. Until then, simply sign in with whichever email you prefer.",
  },
  limited: {
    title: "Too many attempts for that address",
    body: "Wait an hour and try again.",
  },
  unavailable: {
    title: "Moving is not available right now",
    body: "Sending is not configured. Nothing was changed.",
  },
  error: {
    title: "Something went wrong on our side",
    body: "Nothing was changed. Try again in a moment.",
  },
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const email = await emailForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect("/signin");

  const loaded = await storeForEmail(email);
  // A store from before visits were counted gets its counter the first time
  // its owner opens the studio.
  const store = loaded && !loaded.statsId ? ((await ensureStatsId(email)) ?? loaded) : loaded;
  const folder = store ? await storeFolder(email) : "";
  const params = await searchParams;
  const notice =
    ADDRESS_NOTICES[typeof params.address === "string" ? params.address : ""] ??
    STRIPE_NOTICES[typeof params.stripe === "string" ? params.stripe : ""] ??
    BILLING_NOTICES[typeof params.billing === "string" ? params.billing : ""];
  // The snapshot the public store page trusts is refreshed here, because this
  // is the page the creator opens and therefore the moment they would notice
  // it being wrong. A store that never started a subscription is not asked
  // about, and neither is one on a deployment with no billing configured.
  const live =
    store?.subscriptionId && isBillingConfigured()
      ? await readSubscription(store.subscriptionId)
      : null;
  // "unknown" means Stripe could not be asked, which is not the same as not
  // paying. The snapshot stands rather than closing a paying creator's till
  // over a network blip.
  const paid =
    live && live.state !== "unknown"
      ? live.state === "active"
      : Boolean(store?.subscriptionActive);
  if (store && live && live.state !== "unknown" && paid !== store.subscriptionActive) {
    await setSubscription(email, { active: paid });
  }
  // Everything below reads this, not the record we loaded, so one page never
  // shows two different answers to the same question.
  const current = store ? { ...store, subscriptionActive: paid } : null;
  const trialing = live?.state === "active" && live.trialing;
  // Read from Stripe on this page load. When Stripe could not be asked, the
  // cancel button still shows: the route asks again before it does anything.
  const cancelling = live?.state === "active" && live.cancelsAtEnd;
  const endsOn =
    live?.state === "active" && live.until > 0
      ? new Date(live.until * 1000).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : null;

  // Only asked for when there is a store that can actually have sold
  // something, so a creator who has not connected Stripe never waits on a
  // request that could only come back empty.
  const sold =
    current && current.stripeAccountId ? await listSales(current) : null;

  // What this store has sent out this month, so the one cost that scales with
  // use is visible to the creator before it is visible on our bill.
  const delivery = store ? await deliveredThisMonth(folder) : null;
  // The list is shown once there is something that fills it, or once it holds
  // anybody — a creator who stops giving things away still owns what came in.
  const list = store ? await listSize(store) : null;
  const givesAway = store ? store.products.some((product) => isFree(product)) : false;
  // Booked calls are read from the creator's Stripe account, the ledger, and
  // only asked for when the store sells calls at all.
  const callProducts = store ? store.products.filter((product) => product.call) : [];
  const paidList =
    current && current.stripeAccountId && callProducts.length > 0
      ? await paidCalls(current).catch(() => null)
      : null;
  const calls = paidList ? upcoming(paidList) : null;
  // A buyer who paid and never came back from Stripe still gets their email,
  // and so does the creator, the next time the creator looks.
  if (current && paidList && paidList.length) after(() => catchUpBookings(current, paidList, SITE_URL));
  // Visits from Redis and sales from the creator's Stripe, read side by side.
  const [visits, salesRead] = current
    ? await Promise.all([
        readStats(current).catch(() => null),
        current.stripeAccountId
          ? readSales(current).then(
              (value) => ({ state: "ok" as const, value }),
              () => ({ state: "error" as const, value: null }),
            )
          : Promise.resolve({ state: "none" as const, value: null }),
      ])
    : [null, null];
  const numbers =
    current && visits && salesRead ? studioStats(current, visits, salesRead.value, salesRead.state) : null;
  const connectReady = isConnectConfigured();
  const connectTestMode = isConnectInTestMode();
  const billingReady = isBillingConfigured();
  const NEXT = connectReady ? NEXT_WHEN_SELLING : NEXT_WHEN_NOT;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-3">
          <Link href="/" className="shrink-0 rounded-[10px]" aria-label="Nimbus Labs, home">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm text-ink-mute md:inline">{email}</span>
            {store ? (
              <Link href={`/@${store.handle}`} className="btn btn-secondary btn-sm">
                <span className="hidden min-[400px]:inline">View my store</span>
                <span className="min-[400px]:hidden">My store</span>
                <Icon name="arrow-up-right" size={16} />
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
        <p className="eyebrow">Studio</p>
        <h1 className="t-h2 mt-3">
          {store ? "Your store" : "You are signed in"}
        </h1>
        <p className="mt-3 text-ink-soft">
          As <strong className="text-ink [overflow-wrap:anywhere]">{email}</strong>. No password was
          created, and none is stored.
        </p>

        {notice ? (
          <div className="notice notice-warn mt-6">
            <p className="font-bold text-ink">{notice.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{notice.body}</p>
          </div>
        ) : null}

        {store ? (
          <>
            <div className="grid items-start gap-x-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0">
            <div className="card mt-8 p-6 sm:p-8">
              <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                {store.name}
              </p>
              {store.bio ? (
                <p className="mt-2 text-ink-soft">{store.bio}</p>
              ) : null}
              <div className="mt-3">
                <DetailsForm name={store.name} bio={store.bio} />
              </div>

              <p className="mt-5 text-sm font-bold text-ink">Your address</p>
              <p className="mt-1 break-all rounded-[8px] bg-paper px-3 py-2 font-mono text-[0.9375rem] text-violet-deep ring-1 ring-line">
                nimbuslabsai.com/@{store.handle}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link
                  href={`/@${store.handle}`}
                  className="btn btn-primary"
                >
                  Open my store
                </Link>
                <RenameForm current={store.handle} />
              </div>

              <OldAddresses handles={store.previousHandles} />
            </div>

            {numbers ? <StatsPanel data={numbers} /> : null}

            <LookEditor
              look={store.look}
              photoId={store.photoId}
              name={store.name}
              handle={store.handle}
            />

            <ProductEditor
              products={store.products}
              folder={folder}
              selling={current ? canSell(current) : false}
              testMode={isConnectInTestMode()}
              email={email}
            />

            {callProducts.length > 0 ? (
              <section className="card mt-8 p-6 sm:p-8" aria-labelledby="calls-title">
                <h2 id="calls-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
                  Upcoming calls
                </h2>
                {!current?.stripeAccountId ? (
                  <p className="mt-2 text-ink-soft">
                    Calls can be booked once your Stripe account is connected and your store can take payments.
                  </p>
                ) : calls === null ? (
                  <p className="mt-2 text-ink-soft">
                    Your calls could not be read from Stripe just now. Nothing is lost; reload the page in a moment.
                  </p>
                ) : calls.length === 0 ? (
                  <p className="mt-2 text-ink-soft">
                    Nothing booked yet. When someone books, it shows up here, and you both get an email with a calendar file.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-line">
                    {calls.map((call) => {
                      const product = store.products.find((p) => p.id === call.product);
                      const tz = product?.call?.tz ?? callProducts[0].call?.tz ?? "UTC";
                      return (
                        <li key={call.session} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink">
                              {`${readableTime(call.start, tz)} ${zoneName(call.start, tz)}`}
                            </span>
                            <span className="block text-sm text-ink-soft">
                              {product ? product.title : "A call that is no longer listed"}
                              {call.email ? (
                                <>
                                  {" \u00b7 "}
                                  <a href={`mailto:${call.email}`} className="link break-all">{call.email}</a>
                                </>
                              ) : null}
                            </span>
                          </span>
                          {product?.call?.room ? (
                            <a href={product.call.room} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-violet-deep underline underline-offset-4">
                              Join
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : null}

            <LinkEditor links={store.links} />

            <DiscountEditor selling={current ? canSell(current) : false} />

            <PixelEditor pixels={store.pixels} />

            {list && (givesAway || list.total > 0) ? (
              <div className="card mt-8 p-6 sm:p-8">
                <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                  Your list
                </p>
                <p className="mt-2 text-ink-soft">
                  {`${list.total.toLocaleString("en-US")} ${
                    list.total === 1 ? "address" : "addresses"
                  } from what you give away. ${list.agreed.toLocaleString("en-US")} of them agreed to hear from you.`}
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  Every address on it was confirmed by the person who owns it,
                  by using the link we emailed them. None of them is a typo, and
                  none was typed in by somebody else.
                </p>

                {/* Plain GET forms rather than links: a link to a download
                    is a link something may prefetch, and each prefetch would
                    read the whole list. A form is only sent when pressed. */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <form action="/api/store/leads" method="get" className="max-w-full">
                    <input type="hidden" name="who" value="agreed" />
                    <button
                      type="submit"
                      className="btn btn-primary btn-wrap"
                    >
                      Download the ones who agreed
                    </button>
                  </form>
                  <form action="/api/store/leads" method="get" className="max-w-full">
                    <input type="hidden" name="who" value="everyone" />
                    <button
                      type="submit"
                      className="btn btn-secondary"
                    >
                      Download everyone
                    </button>
                  </form>
                </div>
                <p className="mt-4 text-sm text-ink-soft">
                  A CSV file, which Mailchimp, Kit, Beehiiv and every other email
                  tool imports. The ones who agreed ticked a box that starts
                  empty. The rest asked for one thing and said no more — writing
                  to them about something else is what spam laws, in Europe
                  especially, are about, so the first file is the one for your
                  newsletter. The list is yours: take it whenever you like, with
                  nothing to ask for, and it goes with you if you leave.
                </p>
                {list.full ? (
                  <p className="mt-4 notice notice-warn">
                    {`Your list has reached ${MAX_LEADS.toLocaleString("en-US")} addresses, which is as many as one store holds. New people still get what they ask for; their addresses are not added. Download the list and write to us.`}
                  </p>
                ) : null}
                {givesAway && !paid ? (
                  <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
                    Free products are handed out while your subscription or
                    trial is on. Until then your page shows them as not
                    available, and nobody is asked for an address.
                  </p>
                ) : null}
              </div>
            ) : null}

            </div>
            <div className="min-w-0">
            <div className="card mt-8 p-6 sm:p-8">
              <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                Where the money goes
              </p>
              <p className="mt-2 text-ink-soft">
                Buyers pay into a Stripe account that is yours, not ours. You
                sign Stripe&apos;s agreement, you log into their dashboard, and
                the payouts go to your bank. We keep the account&apos;s
                identifier and nothing else — no key to it, and never the money
                in it.
              </p>

              {!connectReady ? (
                <p className="mt-5 rounded-[var(--r-md)] bg-sand p-5 text-sm text-ink-soft">
                  Connecting is not switched on yet on our side, so there is
                  nothing here to press. This says so instead of showing you a
                  button that would do nothing.
                </p>
              ) : !store.stripeAccountId ? (
                <>
                  <form action="/api/stripe/connect" method="post" className="mt-5">
                    <label
                      htmlFor="stripe-country"
                      className="field-label"
                    >
                      Which country is your bank account in?
                    </label>
                    <select
                      id="stripe-country"
                      name="country"
                      required
                      defaultValue=""
                      className="field mt-2 max-w-xs"
                    >
                      <option value="" disabled>
                        Choose a country
                      </option>
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 max-w-md text-sm text-ink-soft">
                      Stripe fixes this when the account is opened and it cannot
                      be changed afterwards, so pick the country your bank
                      account is really in.
                    </p>
                    <button
                      type="submit"
                      className="btn btn-primary mt-4"
                    >
                      Connect your Stripe account
                    </button>
                  </form>
                  <p className="mt-4 text-sm text-ink-soft">
                    Stripe will ask for the details it needs to pay you. If you
                    already have a Stripe account, you can sign into it there
                    instead of opening a new one.
                  </p>
                </>
              ) : (
                <>
                  <div
                    className={`mt-5 rounded-3xl p-5 ${
                      store.stripeChargesEnabled
                        ? "bg-mint-brand/15"
                        : "bg-amber-brand/10"
                    }`}
                  >
                    <p className="font-bold text-ink">
                      {store.stripeChargesEnabled
                        ? "Stripe says this account can take payments"
                        : "Stripe is not finished with this account"}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-ink-soft">
                      {store.stripeAccountId}
                    </p>
                    {store.stripeCheckedAt ? (
                      <p className="mt-2 text-sm text-ink-soft">
                        Last asked on{" "}
                        {new Date(store.stripeCheckedAt).toISOString().slice(0, 10)}.
                        Stripe can change its mind, so this is what it said
                        then, not a promise about this moment.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {!store.stripeChargesEnabled ? (
                      <form action="/api/stripe/connect" method="post">
                        <button
                          type="submit"
                          className="btn btn-primary"
                        >
                          Finish it in Stripe
                        </button>
                      </form>
                    ) : null}
                    <form action="/api/stripe/check" method="post">
                      <button
                        type="submit"
                        className="btn btn-secondary"
                      >
                        Ask Stripe again
                      </button>
                    </form>
                    <form action="/api/stripe/disconnect" method="post">
                      <button
                        type="submit"
                        className="btn btn-ghost"
                      >
                        Forget it here
                      </button>
                    </form>
                  </div>
                </>
              )}

              {connectReady && connectTestMode ? (
                <p className="mt-4 text-sm text-ink-soft">
                  This is running against Stripe in test mode, so no real money
                  can move through it yet.
                </p>
              ) : null}
            </div>

            {delivery ? (
              <div className="card mt-8 p-6 sm:p-8">
                <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                  What you have sent out this month
                </p>
                <p className="mt-2 text-ink-soft">
                  {`${readableSize(delivery.bytes)} of the ${readableSize(
                    delivery.allowance,
                  )} your plan covers. Counted when a download starts, including the ones you open yourself to check.`}
                </p>
                <div
                  className="mt-4 h-2 w-full overflow-hidden rounded-full bg-sand"
                  role="progressbar"
                  aria-valuenow={Math.min(
                    100,
                    Math.round((delivery.bytes / delivery.allowance) * 100),
                  )}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Delivery used this month"
                >
                  <div
                    className={`h-full rounded-full ${
                      delivery.over
                        ? "bg-amber-brand"
                        : "bg-gradient-to-r from-violet-brand to-sky-brand"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          1,
                          Math.round(
                            (delivery.bytes / delivery.allowance) * 100,
                          ),
                        ),
                      )}%`,
                    }}
                  />
                </div>
                {delivery.over ? (
                  <p className="mt-4 notice notice-warn">
                    You are past what the plan covers this month.{" "}
                    <strong>Nothing has been cut off and nothing will be.</strong>{" "}
                    A buyer who paid always gets what they paid for. We will
                    write to you about it rather than quietly stop your store.
                  </p>
                ) : null}
              </div>
            ) : null}

            {billingReady ? (
              <div className="card mt-8 p-6 sm:p-8">
                <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                  What you pay us
                </p>
                <p className="mt-2 text-ink-soft">
                  One price, and nothing on top of it. We take 0% of what you
                  sell, because what you sell never passes through us — the
                  subscription is our whole income, and it is the same whether
                  you sell three files or three thousand.
                </p>

                {paid && cancelling ? (
                  <>
                    <p className="mt-5 notice notice-warn font-semibold">
                      {trialing
                        ? `Cancelled inside the trial. Your card will not be charged, and your store keeps taking payments until ${endsOn ?? "the trial ends"}.`
                        : `Cancelled. Nothing more will be charged, and your store keeps taking payments until ${endsOn ?? "the end of the period you paid for"}.`}
                    </p>
                    <form action="/api/billing/cancel" method="post" className="mt-4">
                      <input type="hidden" name="intent" value="resume" />
                      <button
                        type="submit"
                        className="btn btn-primary"
                      >
                        Keep my subscription
                      </button>
                    </form>
                  </>
                ) : paid ? (
                  <>
                    <p className="mt-5 notice notice-success font-semibold">
                      {trialing
                        ? `You are inside the ${TRIAL_DAYS}-day trial. No card has been charged yet.`
                        : `Subscribed at $${(PRICE_CENTS / 100).toFixed(0)} a month.`}
                    </p>
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-bold text-ink underline underline-offset-2">
                        Cancel the subscription
                      </summary>
                      <p className="mt-3 text-sm text-ink-soft">
                        {trialing
                          ? `Your store keeps taking payments until ${endsOn ?? "the trial ends"}, and your card is never charged.`
                          : `Your store keeps taking payments until ${endsOn ?? "the end of the period you already paid for"}, and nothing more is charged.`}
                      </p>
                      <form action="/api/billing/cancel" method="post" className="mt-3">
                        <input type="hidden" name="intent" value="cancel" />
                        <button
                          type="submit"
                          className="btn btn-secondary btn-sm"
                        >
                          Yes, cancel it
                        </button>
                      </form>
                    </details>
                    <p className="mt-3 text-sm text-ink-soft">
                      No email to us, no chat, no second request. This button
                      is the whole of it, and you can change your mind until
                      the day it stops.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-5 text-ink-soft">
                      Your address, your page, the editor and connecting Stripe
                      are free and stay free. What the subscription switches on
                      is the till: taking a card for what you sell, and handing
                      out what you give away for an email address.
                    </p>
                    <form action="/api/billing/checkout" method="post" className="mt-5">
                      <button
                        type="submit"
                        className="btn btn-primary btn-wrap"
                      >
                        {/* One string, not three. Split across JSX nodes it
                            comes out of the server with markers in the middle,
                            which is invisible to a reader and a lie to anything
                            that searches the page for the sentence. */}
                        {`Start the ${TRIAL_DAYS}-day trial \u2014 $${(
                          PRICE_CENTS / 100
                        ).toFixed(0)} a month after that`}
                      </button>
                    </form>
                    <p className="mt-3 text-sm text-ink-soft">
                      Nothing is charged today. The card is taken now and first
                      billed in {TRIAL_DAYS} days, so you can open a store, sell
                      something real and decide with an answer instead of a
                      guess.
                    </p>
                  </>
                )}
              </div>
            ) : null}

            {sold ? (
              <div className="card mt-8 p-6 sm:p-8">
                <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                  What you have sold
                </p>
                <p className="mt-2 text-ink-soft">
                  Read from your own Stripe account each time you open this
                  page. We keep no second copy of it, so there is nothing here
                  to go stale or go missing.
                </p>

                {sold.state === "error" ? (
                  <p className="mt-5 notice notice-warn">
                    Stripe did not answer just now, so this list is not showing.
                    Nothing is lost — your sales are on your Stripe account
                    whether this page can reach it or not.
                  </p>
                ) : sold.state === "unavailable" ? (
                  <p className="mt-5 rounded-[var(--r-md)] bg-sand p-5 text-sm text-ink-soft">
                    Nothing can have sold yet, because Stripe has not cleared
                    your account to take payments. Finish what it asks for
                    above, and your sales will appear here.
                  </p>
                ) : sold.sales.length === 0 ? (
                  <p className="mt-5 rounded-[var(--r-md)] bg-sand p-5 text-sm text-ink-soft">
                    Nothing sold yet. When someone buys, the sale shows up here
                    with who bought it, so you can answer them.
                  </p>
                ) : (
                  <>
                    <ul className="mt-5 space-y-3">
                      {sold.sales.map((sale) => (
                        <li
                          key={sale.reference}
                          className="rounded-[var(--r-md)] bg-sand p-5"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-bold text-ink">{sale.title}</p>
                            <p className="font-display font-semibold text-ink">
                              ${centsToPrice(sale.amount)}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-ink-soft">
                            {sale.email ? (
                              <>
                                Bought by{" "}
                                <a
                                  href={`mailto:${sale.email}`}
                                  className="underline underline-offset-2"
                                >
                                  {sale.email}
                                </a>
                              </>
                            ) : (
                              "Bought without an email address on the receipt"
                            )}{" "}
                            on{" "}
                            {new Date(sale.paidAt * 1000).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "long", year: "numeric" },
                            )}
                          </p>
                          <p className="mt-1 text-xs text-ink-soft">
                            {sale.isCall
                              ? "A booked call: the time is in both your calendars."
                              : sale.stillDownloadable
                                ? "Their download link still works."
                                : "Their download link has expired — send them the file yourself if they ask."}{" "}
                            Stripe reference {sale.reference}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-ink-soft">
                      The {ORDERS_PAGE_SIZE} most recent. Every sale you have
                      ever made is in your own Stripe dashboard, which is the
                      real record.
                    </p>
                  </>
                )}
              </div>
            ) : null}

            <div className="card mt-8 p-6 sm:p-8">
              <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                The email that signs you in
              </p>
              <p className="mt-2 text-ink-soft">
                Your store lives behind this address, so losing the inbox would
                mean losing the store. Move it to another one while you still
                can — when you change jobs, or leave a provider behind.
              </p>
              <form
                action="/api/store/address"
                method="post"
                className="mt-5 flex flex-wrap items-end gap-3"
              >
                <label className="flex-1 basis-64 text-sm font-bold text-ink">
                  Move to
                  <input
                    type="email"
                    name="email"
                    required
                    maxLength={254}
                    placeholder="you@somewhere-else.com"
                    className="field mt-1"
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Send the link there
                </button>
              </form>
              <p className="mt-4 text-sm text-ink-soft">
                The link goes to the new address, because holding that inbox is
                the proof. The old one gets a plain notice, with no link, so
                that a move you did not ask for reaches you while the account is
                still yours.
              </p>
            </div>
            </div>
            </div>
          </>
        ) : (
          <div className="card mt-8 p-6 sm:p-8">
            <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
              Take your address
            </p>
            <p className="mt-2 mb-6 text-ink-soft">
              This is the link you put in your bio. Pick one now without
              agonising over it: you can change it later, and the old address
              keeps working and sends people to the new one.
            </p>
            <HandleForm />
          </div>
        )}

        <div className="card mt-8 p-6 sm:p-8">
          <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
            What is not here yet
          </p>
          <p className="mt-2 text-ink-soft">
            Being honest about it, these are the pieces still being built, in
            this order:
          </p>
          <ol className="mt-5 space-y-3">
            {NEXT.map((item, index) => (
              <li key={item} className="flex gap-3 text-ink-soft">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lilac text-xs font-semibold text-violet-deep"
                >
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-ink-soft">
            Until selling works, the working proof is the demo store, and it is
            open to anyone.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/demo"
            className="btn btn-primary"
          >
            Open the demo store
          </Link>
          <Link
            href="/mission"
            className="btn btn-secondary"
          >
            What is built so far
          </Link>
          <form action="/api/auth/signout" method="post" className="ml-auto">
            <button
              type="submit"
              className="btn btn-ghost"
            >
              Sign out
            </button>
          </form>
          <form action="/api/auth/signout-all" method="post">
            <button
              type="submit"
              className="btn btn-ghost"
            >
              Sign out everywhere
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
