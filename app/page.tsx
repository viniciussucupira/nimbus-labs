import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { PhoneScreens } from "@/components/phone-screens";
import { SiteNav } from "@/components/site-nav";
import { Icon, type IconName } from "@/components/icons";
import { DemoWindow, Faq, HeroFlow, Pricing, RevealOnScroll } from "@/components/home-parts";
import { PRICE_CENTS, TRIAL_DAYS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Nimbus Labs — the link-in-bio store that pays into your own Stripe",
  description:
    "A fast store page for creators who sell files and memberships. Buyers pay into your own Stripe account, the file is delivered the second the payment clears, and Nimbus takes 0% of your sales.",
};

const PHOTO = (id: string, w = 400, h = 400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=${w}&h=${h}&q=72`;

const PRICE = PRICE_CENTS / 100;

/* The three things that make a sale on Nimbus different. */
const REASONS: { icon: IconName; title: string; body: string; href: string; link: string }[] = [
  {
    icon: "bank",
    title: "The money lands in your Stripe",
    body: "Every sale is a direct charge on your own Stripe account. Payouts follow your schedule, and refunds and disputes live in your own dashboard.",
    href: "/platform/your-stripe",
    link: "How the money moves",
  },
  {
    icon: "tag",
    title: "Several prices for one product",
    body: "One week for $27, five weeks for $39. Up to three options on any product, and each option delivers its own file.",
    href: "/platform/price-options",
    link: "See price options",
  },
  {
    icon: "bolt",
    title: "Delivered the second it is paid",
    body: "The file is released when Stripe confirms the payment, with a download link that stays valid for three days.",
    href: "/platform/instant-delivery",
    link: "How delivery works",
  },
];

const LIVE: { icon: IconName; title: string; body: string }[] = [
  { icon: "link", title: "Your own address", body: "Change it whenever you like. Every address you ever used keeps working." },
  { icon: "percent", title: "Discount codes", body: "Included on the one plan, not kept for a more expensive one." },
  { icon: "repeat", title: "Memberships", body: "Charge every week, month or year, on your own Stripe account." },
  { icon: "gift", title: "Free products for an email", body: "Each address confirmed by its owner. Download the list whenever you like." },
  { icon: "mail", title: "No password, ever", body: "Sign in with a link sent to your email. Nothing for us to lose." },
  { icon: "chart", title: "Your sales, from Stripe", body: "What you sold, read straight from your own Stripe account." },
];

const NEXT = [
  "Members cancelling on their own",
  "Visit counts, and pixels for Meta, TikTok and Google",
  "Scheduled calls with a calendar",
  "Courses with lessons",
];

const CREATORS = [
  {
    href: "/for/coaches",
    label: "Coaches and teachers",
    sells: "Workbooks, programmes, paid calls",
    photo: "photo-1616065298043-67646192dcb5",
    alt: "A woman with blonde hair and red lipstick, smiling",
  },
  {
    href: "/for/cooks",
    label: "Cooks and nutritionists",
    sells: "Meal plans, grocery lists, recipe packs",
    photo: "photo-1543871595-e11129e271cc",
    alt: "A woman with long dark hair, smiling",
  },
  {
    href: "/for/fitness",
    label: "Fitness creators",
    sells: "Training programmes and challenges",
    photo: "photo-1617748142090-06eeb8fd1119",
    alt: "A woman in a yellow dress, smiling outdoors",
  },
  {
    href: "/for/designers",
    label: "Designers and photographers",
    sells: "Presets, templates, brush packs",
    photo: "photo-1746790335260-4577f9953b11",
    alt: "A woman in a green dress, smiling",
  },
];

/* Checked on Stan's own public pricing, terms and help pages. */
const COMPARE = [
  { row: "Where the money from a sale goes", stan: "A Stripe account managed by the platform", nimbus: "Your own Stripe account", key: true },
  { row: "Getting paid out", stan: "Manual cash-out, $10 minimum, payout fee", nimbus: "Your Stripe payout schedule, no minimum from us", key: true },
  { row: "Cut of each sale", stan: "0%, plus Stripe's own fees", nimbus: "0%, plus Stripe's own fees", key: false },
  { row: "Several prices for one product", stan: "Not available", nimbus: "Up to three on any product", key: true },
  { row: "Discount codes", stan: "On the $99 Creator Pro plan", nimbus: `Included at $${PRICE} a month`, key: true },
  { row: "Changing your store address", stan: "Old links forwarded on a best effort", nimbus: "Every address you ever used keeps working", key: false },
];

const SPEED = [
  { label: "Nimbus demo store", score: 98, shown: "97–100", ours: true },
  { label: "Stan store A", score: 57, shown: "57", ours: false },
  { label: "Stan store B", score: 57, shown: "57", ours: false },
  { label: "Stan store C", score: 58, shown: "58", ours: false },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content">
        {/* ------------------------------------------------------------ hero */}
        <section className="surface-night nb-grid-lines on-dark overflow-hidden">
          <div className="container-page grid items-center gap-14 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pb-24 lg:pt-24">
            <div className="nb-fade-up">
              <p className="eyebrow">Link-in-bio store for creators</p>
              <h1 className="t-display mt-5 text-white">
                Your store.
                <br />
                Your <span className="serif nb-gradient-text pr-1 text-[1.08em] leading-[0.9]">Stripe.</span>
                <br />
                Your money.
              </h1>
              <p className="t-lead measure mt-7 text-white/75">
                Sell files and memberships from the link in your bio. Buyers pay straight into your own Stripe account,
                the file arrives a second later, and Nimbus takes{" "}
                <strong className="font-semibold text-white">0% of your sales</strong>.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link href="/signin" className="btn btn-light btn-lg">
                  Start your store
                  <Icon name="arrow-right" size={18} />
                </Link>
                <DemoWindow label="Try the live demo" />
              </div>
              <p className="mt-4 text-sm text-white/55">
                {`$${PRICE} a month, with a ${TRIAL_DAYS}-day trial. Cancel in one click.`}
              </p>
            </div>

            <div className="nb-fade-up nb-delay-2">
              <HeroFlow />
            </div>
          </div>

          <div className="border-t border-white/10">
            <ul className="container-page grid gap-x-8 gap-y-3 py-6 text-[0.9375rem] text-white/75 sm:grid-cols-3">
              {[
                { icon: "percent" as IconName, text: "0% of your sales" },
                { icon: "bank" as IconName, text: "Payouts on your own Stripe schedule" },
                { icon: "gauge" as IconName, text: "Stores that load fast on a phone" },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-3">
                  <Icon name={f.icon} size={18} className="shrink-0 text-[#b9a8ff]" />
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------ the buyer's path */}
        <PhoneScreens />

        {/* ------------------------------------------------------ why Nimbus */}
        <section className="surface-sand section">
          <div className="container-page">
            <div className="reveal max-w-2xl">
              <p className="eyebrow">Why Nimbus</p>
              <h2 className="t-h2 balance mt-4">Built around the one thing that is yours: the money</h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {REASONS.map((r) => (
                <article key={r.title} className="card card-hover reveal flex flex-col p-7">
                  <span className="icon-tile">
                    <Icon name={r.icon} size={22} />
                  </span>
                  <h3 className="t-h3 mt-6">{r.title}</h3>
                  <p className="mt-3 flex-1 text-ink-soft">{r.body}</p>
                  <Link href={r.href} className="link-arrow mt-6 text-[0.9375rem]">
                    {r.link}
                    <Icon name="arrow-right" size={16} className="arrow" />
                  </Link>
                </article>
              ))}
            </div>

            <div className="reveal mt-16 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
              <div>
                <div className="flex items-center gap-3">
                  <span className="tag tag-live">Live now</span>
                  <p className="text-sm text-ink-mute">Every line here exists in the code today.</p>
                </div>
                <ul className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2">
                  {LIVE.map((f) => (
                    <li key={f.title} className="flex gap-4">
                      <span className="icon-tile icon-tile-sm bg-white text-violet-deep ring-1 ring-line">
                        <Icon name={f.icon} size={18} />
                      </span>
                      <span>
                        <span className="block font-semibold text-ink">{f.title}</span>
                        <span className="mt-1 block text-[0.9375rem] text-ink-soft">{f.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-flat p-7">
                <span className="tag tag-next">Next on the list</span>
                <p className="mt-4 text-[0.9375rem] text-ink-soft">
                  Not built yet, so not sold yet. This is the order we are building them in.
                </p>
                <ol className="mt-5 space-y-3">
                  {NEXT.map((n, i) => (
                    <li key={n} className="flex gap-3 text-ink">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand text-[0.75rem] font-semibold text-ink-soft">
                        {i + 1}
                      </span>
                      <span className="text-[0.9375rem]">{n}</span>
                    </li>
                  ))}
                </ol>
                <Link href="/mission" className="link-arrow mt-6 text-[0.9375rem]">
                  The whole plan
                  <Icon name="arrow-right" size={16} className="arrow" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- the money */}
        <section id="money" className="surface-night on-dark section scroll-mt-20 overflow-hidden">
          <div className="container-page grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
            <div className="reveal">
              <p className="eyebrow">The money</p>
              <h2 className="t-h2 balance mt-4 text-white">
                We never touch a cent of <span className="serif font-normal">your</span> sales
              </h2>
              <p className="t-lead measure mt-6 text-white/70">
                Your buyer pays on your own Stripe account, through a direct charge. If you ever leave, nothing moves:
                the account, the customers and the payouts were always yours.
              </p>
              <p className="measure mt-4 text-white/70">
                We make money one way only, a monthly subscription. That is the whole business model, written on one line.
              </p>
              <Link href="/platform/your-stripe" className="btn btn-outline-light mt-8">
                How the money moves
              </Link>
            </div>

            <div className="reveal">
              <div className="rounded-[var(--r-xl)] bg-white p-6 text-ink shadow-[var(--shadow-device)] sm:p-8">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-mute">A sale of the 5-week planner</p>
                  <span className="tag tag-live">Paid</span>
                </div>
                <p className="mt-3 text-[2.75rem] font-semibold leading-none tracking-[-0.05em]">$39.00</p>
                <dl className="mt-7 divide-y divide-line border-y border-line text-[0.9375rem]">
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-ink-soft">Paid by your buyer</dt>
                    <dd className="font-semibold">$39.00</dd>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-ink-soft">Stripe&apos;s processing fee</dt>
                    <dd className="text-ink-soft">set by Stripe, on your account</dd>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <dt className="text-ink-soft">Nimbus Labs</dt>
                    <dd className="font-semibold text-mint-deep">$0.00</dd>
                  </div>
                </dl>
                <div className="mt-6 flex items-center gap-3 rounded-[var(--r-md)] bg-lilac p-4">
                  <span className="icon-tile icon-tile-sm bg-white">
                    <Icon name="bank" size={18} />
                  </span>
                  <p className="text-[0.9375rem] text-violet-ink">
                    <strong className="font-semibold">Lands in your Stripe account.</strong> Same dashboard, same payout rhythm.
                  </p>
                </div>
                <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-mute">
                  Tested on 17 September 2026 with a real Stripe checkout in test mode: the sale landed on the creator&apos;s
                  account with no cut for the platform.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ who it's for */}
        <section className="section">
          <div className="container-page">
            <div className="reveal flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="eyebrow">Who it is for</p>
                <h2 className="t-h2 balance mt-4">People who sell what they know</h2>
              </div>
              <Link href="/creators" className="link-arrow">
                Tell us what you sell
                <Icon name="arrow-right" size={16} className="arrow" />
              </Link>
            </div>

            <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {CREATORS.map((c) => (
                <li key={c.href} className="reveal">
                  <Link href={c.href} className="group block overflow-hidden rounded-[var(--r-lg)] border border-line bg-white shadow-[var(--shadow-sm)] transition-shadow duration-300 hover:shadow-[var(--shadow-md)]">
                    <div className="relative aspect-[4/5] overflow-hidden bg-sand-deep">
                      <img
                        src={PHOTO(c.photo, 560, 700)}
                        alt={c.alt}
                        width={560}
                        height={700}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 [transition-timing-function:var(--ease)] group-hover:scale-[1.03]"
                      />
                      <span className="absolute left-2.5 top-2.5 rounded-[6px] bg-white/90 px-2 py-1 text-[0.6875rem] font-medium text-ink-soft backdrop-blur sm:left-3 sm:top-3 sm:text-[0.75rem]">
                        Example store
                      </span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <p className="flex items-center justify-between gap-2 text-[0.9375rem] font-semibold leading-snug text-ink sm:text-base">
                        {c.label}
                        <Icon name="arrow-right" size={16} className="text-ink-mute transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-violet-deep" />
                      </p>
                      <p className="mt-1 text-[0.8125rem] text-ink-soft sm:text-[0.9375rem]">{c.sells}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------- compare */}
        <section id="compare" className="surface-sand section scroll-mt-20">
          <div className="container-page">
            <div className="reveal max-w-2xl">
              <p className="eyebrow">Side by side</p>
              <h2 className="t-h2 balance mt-4">How we compare with Stan</h2>
              <p className="mt-5 text-ink-soft">
                Checked on Stan&apos;s own public pricing, terms and help pages in September 2026, the discount row on
                22 September. If any of it changes, this table changes.
              </p>
            </div>

            {/* table from the small tablet up, cards on a phone */}
            <div className="reveal mt-10 hidden overflow-hidden rounded-[var(--r-lg)] border border-line bg-white shadow-[var(--shadow-sm)] md:block">
              <table className="table-clean text-[0.9375rem]">
                <thead>
                  <tr>
                    <th scope="col" className="w-[34%]">
                      <span className="sr-only">What we compared</span>
                    </th>
                    <th scope="col" className="w-[33%]">Stan</th>
                    <th scope="col" className="w-[33%] !text-violet-deep">Nimbus Labs</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.row}>
                      <th scope="row" className="font-semibold text-ink">
                        {r.row}
                      </th>
                      <td className="text-ink-soft">{r.stan}</td>
                      <td className={r.key ? "bg-lilac/50 font-semibold text-ink" : "text-ink"}>
                        <span className="flex gap-2">
                          {r.key && <Icon name="check" size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-violet-brand" />}
                          {r.nimbus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-8 grid gap-3 md:hidden">
              {COMPARE.map((r) => (
                <li key={r.row} className="card-flat p-5">
                  <p className="font-semibold text-ink">{r.row}</p>
                  <dl className="mt-3 grid gap-2 text-[0.9375rem]">
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-ink-mute">Stan</dt>
                      <dd className="text-ink-soft">{r.stan}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 font-semibold text-violet-deep">Nimbus</dt>
                      <dd className="font-medium text-ink">{r.nimbus}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>

            <div className="reveal mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="card-flat p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="icon-tile icon-tile-sm">
                    <Icon name="gauge" size={18} />
                  </span>
                  <p className="font-semibold text-ink">Speed on a phone</p>
                </div>
                <p className="mt-3 text-[0.9375rem] text-ink-soft">
                  Google PageSpeed Insights, mobile performance score, measured on 17 September 2026. Three public Stan
                  stores chosen at random, same tool, same day.
                </p>
                <ul className="mt-5 space-y-3">
                  {SPEED.map((s) => (
                    <li key={s.label} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-[0.9375rem]">
                      <span className={s.ours ? "font-semibold text-ink" : "text-ink-soft"}>{s.label}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-sand">
                        <span
                          className={`block h-full rounded-full ${s.ours ? "bg-violet-brand" : "bg-ink-mute/45"}`}
                          style={{ width: `${s.score}%` }}
                        />
                      </span>
                      <span className={`text-right tabular-nums ${s.ours ? "font-semibold text-ink" : "text-ink-soft"}`}>
                        {s.shown}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-flat flex flex-col justify-between p-6 sm:p-7">
                <div>
                  <p className="font-semibold text-ink">Where Stan is ahead today</p>
                  <p className="mt-3 text-[0.9375rem] text-ink-soft">
                    Stan has calendar booking, a course builder, email broadcasts, upsells and tracking pixels. We do not
                    have those yet, and we say so on every page that could make you think otherwise.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                  <Link href="/proof/everything" className="link-arrow text-[0.9375rem]">
                    Feature by feature
                    <Icon name="arrow-right" size={16} className="arrow" />
                  </Link>
                  <Link href="/proof/compare" className="link-arrow text-[0.9375rem]">
                    The full comparison
                    <Icon name="arrow-right" size={16} className="arrow" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- pricing */}
        <section id="pricing" className="section scroll-mt-20">
          <div className="container-page">
            <div className="reveal mx-auto max-w-2xl text-center">
              <p className="eyebrow">Pricing</p>
              <h2 className="t-h2 balance mt-4">One price. Your sales stay yours.</h2>
              <p className="mt-5 text-ink-soft">
                {`The same $${PRICE} a month as Stan's Creator plan, with 0% of your sales and the sale itself landing in your own Stripe account.`}
              </p>
            </div>
            <div className="reveal mx-auto mt-12 max-w-5xl">
              <Pricing />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ faq */}
        <section id="faq" className="surface-sand section scroll-mt-20">
          <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div className="reveal">
              <p className="eyebrow">Questions</p>
              <h2 className="t-h2 balance mt-4">Including the awkward ones</h2>
              <p className="mt-5 text-ink-soft">
                Something else?{" "}
                <Link href="/help" className="link">
                  The help centre
                </Link>{" "}
                answers the rest, in writing.
              </p>
            </div>
            <div className="reveal">
              <Faq />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ final CTA */}
        <section className="surface-signature on-dark overflow-hidden">
          <div className="container-narrow py-20 text-center sm:py-28">
            <h2 className="t-h1 balance text-white">Put your first product up today</h2>
            <p className="t-lead mx-auto mt-6 max-w-xl text-white/80">
              {`Take your address, connect your own Stripe account and list what you sell. The till is yours for ${TRIAL_DAYS} days before you decide whether we are worth $${PRICE} a month.`}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Link href="/signin" className="btn btn-light btn-lg">
                Start your store
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link href="/demo" className="link-arrow on-dark">
                See the live store
                <Icon name="arrow-right" size={18} className="arrow" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
