import type { Metadata } from "next";
import { SITE_OG_IMAGE } from "@/lib/site-og";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { BuyerPath } from "@/components/buyer-path";
import { SiteNav } from "@/components/site-nav";
import { Icon, type IconName } from "@/components/icons";
import { FeatureVisual, type VisualKey } from "@/components/feature-visuals";
import { DemoWindow, Faq, HeroFlow, Pricing, RevealOnScroll, SoldMarquee } from "@/components/home-parts";
import { HomeData } from "@/components/structured-data";
import { HOME_QUESTIONS } from "@/lib/home-faq";
import { PLAN_PRICES, PRICE_CENTS, TRIAL_DAYS } from "@/lib/plan";
import { isDomainsConfigured } from "@/lib/domains";

const HOME_TITLE = "Marktmorgen — the link-in-bio store that pays into your own Stripe";
const HOME_DESCRIPTION =
  "A fast store page for creators who sell files, courses, calls and memberships. Buyers pay into your own Stripe account, every handover is checked against Stripe's own record of the payment, and Marktmorgen takes 0% of your sales. Stripe's processing fee applies.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Marktmorgen",
    locale: "en_US",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION, images: [SITE_OG_IMAGE.url] },
};

const PHOTO = (id: string, w = 400, h = 400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=${w}&h=${h}&q=72`;

const PRICE = PRICE_CENTS / 100;

/*
 * The three things that make a sale on Marktmorgen different.
 *
 * Each one is shown, not described: beside the words is the drawing of the
 * screen it happens on, taken from the page that explains it in full. A claim
 * about where money goes is worth more with the path drawn next to it, and
 * two of these three drawings are the real thing and can be clicked.
 */
const REASONS: {
  icon: IconName;
  title: string;
  body: string;
  example: string;
  visual: VisualKey;
  href: string;
  link: string;
  photo: string;
  alt: string;
}[] = [
  {
    icon: "bank",
    title: "The money lands in your Stripe",
    body: "Every sale is a direct charge on your own Stripe account. Payouts follow your schedule, and refunds and disputes live in your own dashboard.",
    example:
      "If you ever leave us, nothing moves: the account, the customers and the payout history were yours the whole time.",
    visual: "stripe",
    href: "/platform/your-stripe",
    link: "How the money moves",
    photo: "photo-1677340725081-e81626d96e29",
    alt: "A desk with a printed statement, a marker and a laptop",
  },
  {
    icon: "tag",
    title: "Several prices for one product",
    body: "One week for $27, five weeks for $39. Up to three options on any product, and each option delivers its own file.",
    example:
      "Stan's own help center lists this among its common feature requests and says there is no native way to do it — read on September 18, 2026.",
    visual: "options",
    href: "/platform/price-options",
    link: "See price options",
    photo: "photo-1723464003582-df09ab4ad03d",
    alt: "Ingredients and recipe cards laid out on a counter",
  },
  {
    icon: "bolt",
    title: "Checked against Stripe, not against a page",
    body: "A file downloads, a course opens, a booked call lands on both calendars — but only after we ask Stripe's own record whether the payment settled, and we ask again on every download. A link somebody guesses or forwards opens nothing. If the buyer never comes back from checkout, the confirmation reaches them by email within minutes.",
    example:
      "A buyer on a new phone types the email address they paid with, and every purchase from that store comes back to them — a month or a year later, for as long as the store is open and the product is still there.",
    visual: "delivery",
    href: "/platform/instant-delivery",
    link: "How delivery works",
    photo: "photo-1723780856806-385158fd0afc",
    alt: "A woman at a laptop, close up, opening something she has just bought",
  },
];

const DOMAINS = isDomainsConfigured();

/*
 * What a creator may come looking for and will not find, said beside what is
 * live. Not a promise of when: each is a line where Stan is ahead today, and
 * the feature-by-feature page has the rest.
 */
const NOT_YET = [
  "Automatic replies on Instagram",
  "PayPal at checkout",
  "An iPhone app from the App Store",
  "Zoom links made for each booking",
  "Paying affiliates without a PayPal account of your own",
];

/*
 * Eight kinds of creator, each shown at work rather than posed.
 *
 * Four was a tidy row and a thin answer: a visitor looking for themselves
 * either saw their trade in the first four or decided this was not for them.
 * Eight is a market, and the cards are now sized unevenly — the first two
 * run tall, the rest sit in a denser grid — so the block reads as a wall of
 * people rather than a set of equal tiles.
 *
 * The photographs are licensed stock, and the line under them says so: the
 * people in them are not our customers, and we will not pretend they are.
 * What they are for is recognition — a visitor should see the thing they do
 * all day before they read a word of ours.
 */
const CREATORS = [
  {
    href: "/for/coaches",
    label: "Coaches and teachers",
    sells: "Worksheets, programs, paid calls",
    photo: "photo-1758599880979-f6a64947b541",
    alt: "A woman sitting on the floor of her living room, talking through a lesson to a camera",
  },
  {
    href: "/for/cooks",
    label: "Cooks and nutritionists",
    sells: "Meal plans, grocery lists, recipe packs",
    photo: "photo-1780277993159-b4ca60e8922d",
    alt: "A cook in an apron plating a dish in a bright kitchen",
  },
  {
    href: "/for/fitness",
    label: "Fitness creators",
    sells: "Training programs and challenges",
    photo: "photo-1787647090008-4b88ffc977b7",
    alt: "A movement teacher showing a stretch to someone in a light studio",
  },
  {
    href: "/for/designers",
    label: "Designers and photographers",
    sells: "Presets, templates, brush packs",
    photo: "photo-1765429158141-b283bbe7d0e4",
    alt: "A photographer holding a camera among tall trees",
  },
  {
    href: "/platform/courses",
    label: "Musicians and producers",
    sells: "Sample packs, lessons, chord charts",
    photo: "photo-1770393391946-7d9b658deec3",
    alt: "A musician at a desk with a keyboard and headphones",
  },
  {
    href: "/platform/memberships",
    label: "Writers and newsletters",
    sells: "Memberships, archives, workshops",
    photo: "photo-1775196610640-5e70ef38f846",
    alt: "A writer at a window desk with a notebook open",
  },
  {
    href: "/platform/calls",
    label: "Therapists and counselors",
    sells: "Booked sessions and workbooks",
    photo: "photo-1780585328302-747a6eee7694",
    alt: "Two people talking across a low table in a calm room",
  },
  {
    href: "/platform/community",
    label: "Makers and crafters",
    sells: "Patterns, classes, a community",
    photo: "photo-1543871595-e11129e271cc",
    alt: "A maker at a bench with tools and materials laid out",
  },
];

/* Checked on Stan's own public pricing, terms and help pages. */
const COMPARE = [
  { row: "Where the money from a sale goes", stan: "A Stripe account managed by the platform", nimbus: "Your own Stripe account", key: true },
  { row: "Getting paid out", stan: "Manual cash-out, $10 minimum, whole balance only", nimbus: "Your Stripe payout schedule, no minimum from us", key: true },
  { row: "Cut of each sale", stan: "0%, plus Stripe's own fees", nimbus: "0%, plus Stripe's own fees", key: false, same: true },
  { row: "Several prices for one product", stan: "Not available", nimbus: "Up to three on any product", key: true },
  { row: "Discount codes", stan: "On the $99 Creator Pro plan", nimbus: `Included at $${PRICE} a month`, key: true },
  { row: "Pay what you want", stan: "Not documented on their public help pages, read September 2026", nimbus: "A minimum and a suggested price", key: false },
  { row: "Changing your store address", stan: "Old links forwarded on a best-effort basis", nimbus: "Old addresses keep working, up to 10 held at once", key: false },
];

const SPEED = [
  { label: "Marktmorgen demo store", score: 98, shown: "97–100", ours: true },
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
        <section className="surface-daybreak on-dark overflow-hidden">
          <div className="awning" aria-hidden="true" />
          <div className="container-page grid items-center gap-12 pb-28 pt-12 sm:gap-14 sm:pt-16 lg:grid-cols-[1.04fr_1fr] lg:gap-12 lg:pb-32 lg:pt-20">
            <div className="nb-fade-up">
              <h1 className="t-display text-white">
                Your store.
                <br />
                Your <span className="serif nb-gradient-text pr-1 text-[1.08em] leading-[0.9]">Stripe.</span>
                <br />
                Your money.
              </h1>
              <p className="t-lead measure mt-7 text-white/80">
                Sell files, courses, calls and memberships from the link in your bio. Buyers pay straight into your own
                Stripe account. Marktmorgen takes{" "}
                <strong className="font-semibold text-white">0% of your sales</strong> — only Stripe charges its own
                processing fee, on your account.
              </p>
              {/*
                On a phone the two calls to action run the width of the
                column: a thumb reaching across a 390px screen should not have
                to find a 180px target, and a half-width button next to empty
                space reads as the smaller of two choices rather than the
                first of two. From 480px up they sit side by side.
              */}
              <div className="mt-9 grid gap-3 min-[480px]:flex min-[480px]:flex-wrap min-[480px]:items-center">
                {/*
                  `w-full` rather than `.btn-block`: that class is plain CSS
                  and Tailwind's utilities sit in a layer, so `.btn-block`
                  would beat the breakpoint that is meant to undo it and the
                  buttons would run the full column on a desktop too.
                */}
                <Link href="/signin" className="btn btn-light btn-lg w-full min-[480px]:w-auto">
                  Start your store
                  <Icon name="arrow-right" size={18} />
                </Link>
                {/*
                  A second button, not a sentence with an arrow. The demo is
                  the strongest thing on this page — a visitor can buy from a
                  real store with a test card in under a minute — and an
                  offer that good should not be dressed as a footnote.
                */}
                <DemoWindow
                  label="See the live demo"
                  className="btn btn-outline-light btn-lg w-full min-[480px]:w-auto"
                />
              </div>
              {/*
                Three facts, not three adjectives. Each one is checkable
                elsewhere on this site inside a minute: the price page, the
                money section and the demo store. They are kept short enough
                to sit two to a row on a phone rather than stacking into a
                third list.
              */}
              <ul className="mt-7 flex flex-wrap gap-2">
                {[
                  { icon: "percent" as IconName, text: "0% of your sales" },
                  { icon: "bank" as IconName, text: "Your own Stripe" },
                  { icon: "calendar" as IconName, text: `${TRIAL_DAYS} days free` },
                ].map((c) => (
                  <li key={c.text} className="chip chip-dark">
                    <Icon name={c.icon} size={15} />
                    {c.text}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-white/80">
                {`Your card is taken when the trial starts and first charged ${TRIAL_DAYS} days later, at $${PRICE} a month. Cancel in two clicks, from your own studio, and it is never charged.`}
              </p>
            </div>

            <div className="nb-fade-up nb-delay-2">
              <HeroFlow />
            </div>
          </div>

        </section>

        {/*
          The band under the hero.

          It deliberately does not repeat the three chips above it. Those are
          the offer; these are the four things a careful person checks next —
          how fast it is, who handles the card, how hard it is to leave, and
          what the limit is — and every one of them is a measurement or a
          number stated elsewhere on this site, not a slogan.
        */}
        <section aria-label="What you can check before you sign up" className="surface-lilac section-tight">
          {/*
            Four facts, each on its own photograph.

            This was the dullest band on the page: four icons in tinted
            squares with text beside them, 475px of it, not one image.
            Kajabi's answer to exactly this problem is a card whose
            background IS a photograph, darkened, with the words in white
            on top — which is why their page can be a third of the length
            of ours and still feel full.

            Taken, and taken further: the figure is set at display size
            rather than caption size, so what the card is actually claiming
            is the thing you see from across the room. The gradient is
            heavy enough at the bottom that white type clears contrast on
            any crop these photographs can produce.
          */}
          <ul className="container-page grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                figure: "97\u2013100",
                title: "Google PageSpeed",
                body: "Mobile performance on the demo store, measured September 17, 2026, before its photos were added.",
                photo: "photo-1775400788040-3b26ab2b8ca5",
                alt: "A runner on a trail at first light",
              },
              {
                figure: "Stripe",
                title: "Handles the card",
                body: "The payment happens on Stripe's own checkout. We never see a card number.",
                photo: "photo-1677340725081-e81626d96e29",
                alt: "A statement and a marker on a working desk",
              },
              {
                figure: "2 clicks",
                title: "To cancel",
                body: "From your own studio. No email to us, no chat, no second request.",
                photo: "photo-1723780856806-385158fd0afc",
                alt: "A woman at a laptop, close up",
              },
              {
                figure: "200 GB",
                title: "Of downloads a month",
                body: "Stated here, not buried in the terms, and nothing is cut off if you pass it. Files up to 5 GB each.",
                photo: "photo-1670963025124-36714c107eb7",
                alt: "A light desk with a laptop and a notebook",
              },
            ].map((f) => (
              <li
                key={f.title}
                className="reveal relative aspect-[4/5] overflow-hidden rounded-[var(--r-lg)] bg-sand-deep shadow-[inset_0_0_0_1px_rgba(42,23,144,0.09),0_14px_32px_-16px_rgba(42,23,144,0.22)] sm:aspect-[5/4] lg:aspect-[4/5]"
              >
                <img
                  src={PHOTO(f.photo, 560, 700)}
                  srcSet={`${PHOTO(f.photo, 400, 500)} 400w, ${PHOTO(f.photo, 560, 700)} 560w, ${PHOTO(f.photo, 900, 1125)} 900w`}
                  sizes="(min-width: 1024px) 23vw, (min-width: 640px) 46vw, 92vw"
                  alt={f.alt}
                  width={560}
                  height={700}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/55 to-black/15" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[2rem] font-semibold leading-none tracking-[-0.04em] text-white">{f.figure}</p>
                  <p className="mt-2 text-[0.9375rem] font-semibold text-white">{f.title}</p>
                  <p className="mt-1.5 text-[0.8125rem] leading-snug text-white/75">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/*
          What people sell, running past.

          The one piece of this page that moves on its own, placed where a
          visitor has just read the offer and is asking whether it is for
          someone like them. Forty kinds of product answer that faster than
          a paragraph about categories, and a strip that never stops is what
          a market looks like.
        */}
        <section aria-label="Things people sell from a Marktmorgen store" className="surface-lilac overflow-hidden py-5">
          <SoldMarquee />
        </section>

        {/* ------------------------------------------------ the buyer's path */}
        <BuyerPath />

        {/* ------------------------------------------------------ why Marktmorgen */}
        <section className="surface-gold section">
          <div className="container-page">
            <div className="reveal max-w-2xl">
              <h2 className="t-h2 balance">Built around the one thing that is yours: the money</h2>
            </div>

            <div className="mt-14 space-y-16 sm:mt-16 sm:space-y-20">
              {REASONS.map((r, i) => (
                <article key={r.title} className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <span className="icon-tile">
                      <Icon name={r.icon} size={22} />
                    </span>
                    <h3 className="t-h3 mt-6">{r.title}</h3>
                    <p className="measure mt-3 text-ink-soft">{r.body}</p>
                    <p className="measure mt-5 flex gap-2.5 rounded-[var(--r-md)] bg-white p-4 text-[0.9375rem] text-ink-soft ring-1 ring-line">
                      <Icon name="check" size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-mint-deep" />
                      <span>{r.example}</span>
                    </p>
                    <Link href={r.href} className="link-arrow mt-6 text-[0.9375rem]">
                      {r.link}
                      <Icon name="arrow-right" size={16} className="arrow" />
                    </Link>
                  </div>
                  {/*
                    The photograph and the drawing, overlapping.

                    Stan's hero works because a portrait and a product card
                    sit on top of each other at slightly different angles:
                    the photograph gives the block a reason to exist and the
                    card gives it the proof. Three sections of pure diagram
                    was the longest stretch of this page with no human being
                    in it — 5,736px of it.

                    The photograph is the ground, tilted a degree and a half
                    and tinted at the corner; the drawing of the real screen
                    sits over its lower edge, straight, because the thing
                    being proved must never look styled.

                    min-w-0 is not decoration. A grid item will not shrink
                    below the widest thing inside it unless you say so, and
                    these drawings are full of rows that would rather stay
                    wide, so without it the whole page grows a sideways
                    scrollbar on a phone.
                  */}
                  <div className={`relative flex min-w-0 justify-center ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                    <div className="relative w-full max-w-[30rem]">
                      <div
                        className="overflow-hidden rounded-[var(--r-xl)] shadow-[0_18px_44px_-20px_rgba(42,23,144,0.45)]"
                        style={{ transform: i % 2 === 1 ? "rotate(1.5deg)" : "rotate(-1.5deg)" }}
                      >
                        <img
                          src={PHOTO(r.photo, 760, 560)}
                          srcSet={`${PHOTO(r.photo, 560, 412)} 560w, ${PHOTO(r.photo, 760, 560)} 760w, ${PHOTO(r.photo, 1120, 824)} 1120w`}
                          sizes="(min-width: 1024px) 44vw, 92vw"
                          alt={r.alt}
                          width={760}
                          height={560}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[19/14] w-full object-cover"
                        />
                      </div>
                      <div className="relative -mt-14 flex justify-center px-2 sm:-mt-16">
                        <FeatureVisual visual={r.visual} tone="light" />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/*
              What we do not have, kept and made small.

              The feature inventory that used to sit here is on /platform,
              where it belongs and where the nav already points; repeating
              it added 5,500px to this page and said nothing the visitor
              could not reach in one click. This block is the part that
              could not move, because it is the argument: a page that lists
              only what works is worth nothing unless it also names what
              does not. One row, five names, no padding around them.
            */}
            <div className="reveal mt-14 flex flex-col gap-4 rounded-[var(--r-lg)] bg-white/70 p-6 shadow-[inset_0_0_0_1px_rgba(42,23,144,0.09)] sm:p-7 lg:flex-row lg:items-center lg:gap-8">
              <div className="lg:w-[17rem] lg:shrink-0">
                <span className="tag tag-next">Not here yet</span>
                <p className="mt-3 text-[0.9375rem] text-ink-soft">
                  Not offered yet, so not sold. Stan has each of these today, and we do not.
                </p>
              </div>
              <ul className="flex flex-wrap gap-2.5">
                {NOT_YET.map((n) => (
                  <li
                    key={n}
                    className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[0.875rem] text-ink shadow-[inset_0_0_0_1px_rgba(42,23,144,0.09)]"
                  >
                    <Icon name="minus" size={14} className="shrink-0 text-ink-mute" />
                    {n}
                  </li>
                ))}
              </ul>
              <Link href="/proof/everything" className="link-arrow shrink-0 text-[0.9375rem]">
                Feature by feature
                <Icon name="arrow-right" size={16} className="arrow" />
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ who it's for */}
        <section className="surface-coral section">
          <div className="container-page">
            <div className="reveal flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <h2 className="t-h2 balance">People who sell what they know</h2>
              </div>
              <Link href="/creators" className="link-arrow">
                Tell us what you sell
                <Icon name="arrow-right" size={16} className="arrow" />
              </Link>
            </div>

            {/*
              The photograph carries the card, not the caption.

              The words used to sit in a white tray under the picture, which
              split each card in two and made a grid of eight read as
              sixteen things. The name and the line now sit on the
              photograph itself, over a gradient dark enough to hold white
              text at any crop, so each card is one object: a person, and
              what they sell.

              The first two run tall and wide; the other six fill a denser
              grid beside them. Eight equal tiles would be the wallpaper
              this section is trying to stop being.
            */}
            <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {CREATORS.map((c, i) => (
                <li key={c.href} className={`reveal ${i < 2 ? "lg:col-span-2 lg:row-span-2" : ""}`}>
                  <Link
                    href={c.href}
                    className="group relative block h-full overflow-hidden rounded-[var(--r-lg)] bg-sand-deep shadow-[inset_0_0_0_1px_rgba(42,23,144,0.09),0_14px_32px_-16px_rgba(42,23,144,0.22)]"
                  >
                    <div className={`relative overflow-hidden ${i < 2 ? "aspect-[4/5] lg:aspect-[1.12]" : "aspect-[4/5]"}`}>
                      <img
                        src={PHOTO(c.photo, 560, 700)}
                        srcSet={`${PHOTO(c.photo, 400, 500)} 400w, ${PHOTO(c.photo, 560, 700)} 560w, ${PHOTO(c.photo, 900, 1125)} 900w`}
                        sizes={i < 2 ? "(min-width: 1024px) 45vw, 46vw" : "(min-width: 1024px) 22vw, 46vw"}
                        alt={c.alt}
                        width={560}
                        height={700}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 [transition-timing-function:var(--ease)] group-hover:scale-[1.04]"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                        <p className={`flex items-center justify-between gap-2 font-semibold leading-snug text-white ${i < 2 ? "text-base sm:text-xl" : "text-[0.9375rem] sm:text-base"}`}>
                          {c.label}
                          <Icon
                            name="arrow-right"
                            size={18}
                            className="shrink-0 text-white/70 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white"
                          />
                        </p>
                        <p className={`mt-1 text-white/80 ${i < 2 ? "text-[0.875rem] sm:text-[0.9375rem]" : "text-[0.8125rem]"}`}>
                          {c.sells}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/*
              Said plainly, under the photographs themselves. We have no
              customers to show yet, and a stock photograph presented as one
              would be the first lie on a site whose whole argument is that we
              do not tell them.
            */}
            <p className="reveal mt-6 flex items-start gap-2.5 text-[0.875rem] text-ink-mute">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              <span className="measure-wide">
                Licensed photographs of people at work, not customers of ours. Every store behind these links is an
                example we built, and the one store here you can buy from is the{" "}
                <Link href="/demo" className="link">
                  live demo
                </Link>
                .
              </span>
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- compare */}
        <section id="compare" className="surface-mint section scroll-mt-20">
          <div className="container-page">
            <div className="reveal max-w-2xl">
              <h2 className="t-h2 balance">How we compare with Stan</h2>
              <p className="mt-5 text-ink-soft">
                Checked on Stan&apos;s own public pricing, terms and help pages in September 2026, and the discount row on
                September 22. If any of it changes, this section changes.
              </p>
            </div>

            {/*
              A comparison is a table. Cut into seven cards it became seven
              of the same object with the answer buried in each one, and a
              reader had to assemble the column themselves. As rows, the two
              columns line up and the shape of the argument is visible from
              across the room — which is the whole point of putting it here.

              Below 640px a table of two long text columns is unreadable at
              any font size, so there the same rows stack: the claim, then
              each side under it.
            */}
            <div className="reveal mt-10 overflow-hidden rounded-[var(--r-lg)] bg-white/80 shadow-[inset_0_0_0_1px_rgba(42,23,144,0.09),0_14px_32px_-16px_rgba(42,23,144,0.22)]">
              <table className="hidden w-full text-left sm:table">
                <caption className="sr-only">Marktmorgen and Stan, side by side</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="w-[34%] px-6 py-4 text-[0.875rem] font-semibold text-ink-mute">
                      What it is
                    </th>
                    <th scope="col" className="px-6 py-4 text-[0.875rem] font-semibold text-ink-mute">
                      Stan
                    </th>
                    <th scope="col" className="bg-white px-6 py-4 text-[0.875rem] font-semibold text-violet-deep">
                      Marktmorgen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => {
                    const same = "same" in r && r.same === true;
                    return (
                      <tr key={r.row} className="border-b border-line last:border-0">
                        <th scope="row" className="px-6 py-5 align-top font-semibold text-ink">
                          {r.row}
                        </th>
                        <td className="px-6 py-5 align-top text-[0.9375rem] text-ink-soft">{r.stan}</td>
                        <td className={`bg-white px-6 py-5 align-top text-[0.9375rem] ${same ? "text-ink-soft" : "font-semibold text-ink"}`}>
                          <span className="flex gap-2.5">
                            {same ? null : (
                              <Icon name="check" size={17} strokeWidth={2.6} className="mt-0.5 shrink-0 text-mint-deep" />
                            )}
                            <span>{r.nimbus}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <ul className="divide-y divide-line sm:hidden">
                {COMPARE.map((r) => {
                  const same = "same" in r && r.same === true;
                  return (
                    <li key={r.row} className="p-5">
                      <p className="font-semibold text-ink">{r.row}</p>
                      <dl className="mt-3 grid gap-2 text-[0.9375rem]">
                        <div className="grid grid-cols-[6.5rem_1fr] gap-3">
                          <dt className="text-ink-mute">Stan</dt>
                          <dd className="text-ink-soft">{r.stan}</dd>
                        </div>
                        <div className="grid grid-cols-[6.5rem_1fr] gap-3">
                          <dt className="font-semibold text-violet-deep">Marktmorgen</dt>
                          <dd className={same ? "text-ink-soft" : "font-semibold text-ink"}>{r.nimbus}</dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="reveal mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="card-flat p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="icon-tile icon-tile-sm">
                    <Icon name="gauge" size={18} />
                  </span>
                  <p className="font-semibold text-ink">Speed on a phone</p>
                </div>
                <p className="mt-3 text-[0.9375rem] text-ink-soft">
                  Google PageSpeed Insights, mobile performance score, measured on September 17, 2026. Three public Stan
                  stores chosen at random, same tool, same day. The demo store had no photographs on it when it was
                  measured; it has them now, and photographs lower the score.
                </p>
                <ul className="mt-5 space-y-3">
                  {SPEED.map((s) => (
                    <li key={s.label} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-[0.9375rem]">
                      <span className={s.ours ? "font-semibold text-ink" : "text-ink-soft"}>{s.label}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-line">
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
                    Stan has PayPal at checkout, affiliates paid with no PayPal account of your own, automatic Instagram
                    replies, Zoom links made for each booking and webinar, and an iPhone app. We do not have those, and we say so on every page that could make you think otherwise.
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
        <section id="pricing" className="surface-lilac section scroll-mt-20">
          <div className="container-page">
            {/*
              Three photographs across the top of the price block.

              Pricing was 2,218px without a single image — the longest
              stretch of the page where somebody is deciding whether to pay,
              and nothing on it to look at. These are three of the trades
              the plans are for, wide and shallow so they frame the prices
              rather than compete with them.
            */}
            <ul className="reveal mx-auto grid max-w-5xl grid-cols-3 gap-3 sm:gap-4">
              {[
                { id: "photo-1723291425355-87a06a81be37", alt: "A meal prepared and plated on a counter" },
                { id: "photo-1677589330382-775a14653741", alt: "A sampler pad under studio light" },
                { id: "photo-1770581063308-ee603bfb4e3b", alt: "Watercolor supplies laid out on a table" },
              ].map((p) => (
                <li key={p.id} className="overflow-hidden rounded-[var(--r-lg)] shadow-[0_14px_32px_-18px_rgba(42,23,144,0.4)]">
                  <img
                    src={PHOTO(p.id, 560, 320)}
                    srcSet={`${PHOTO(p.id, 400, 229)} 400w, ${PHOTO(p.id, 560, 320)} 560w, ${PHOTO(p.id, 900, 514)} 900w`}
                    sizes="(min-width: 1024px) 22vw, 31vw"
                    alt={p.alt}
                    width={560}
                    height={320}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[7/4] w-full object-cover"
                  />
                </li>
              ))}
            </ul>
            <div className="reveal mx-auto mt-10 max-w-2xl text-center">
              <h2 className="t-h2 balance">Two plans. Your sales stay yours.</h2>
              <p className="mt-5 text-ink-soft">
                {`The same $${PRICE} and $${PLAN_PRICES.pro.month / 100} a month as Stan's two plans, the same 14-day free trial, 0% of your sales, and the sale itself landing in your own Stripe account. The $${PRICE} plan holds what Stan keeps for its $${PLAN_PRICES.pro.month / 100} one: discount codes, pixels, funnels, order bumps, upsells, payment plans and limited quantities.`}
              </p>
            </div>
            <div className="reveal mx-auto mt-12 max-w-5xl">
              <Pricing domains={DOMAINS} />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ faq */}
        <section id="faq" className="surface-rose section scroll-mt-20">
          <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div className="reveal">
              <h2 className="t-h2 balance">Including the awkward ones</h2>
              <p className="mt-5 text-ink-soft">
                Something else?{" "}
                <Link href="/help" className="link">
                  The help center
                </Link>{" "}
                answers the rest, in writing.
              </p>
              {/*
                A photograph in the column that would otherwise be three
                lines of text and a lot of air. It is somebody reading
                something carefully, which is what this section is for.
              */}
              <div className="mt-8 hidden overflow-hidden rounded-[var(--r-lg)] shadow-[0_18px_44px_-20px_rgba(42,23,144,0.4)] lg:block">
                <img
                  src={PHOTO("photo-1670963025124-36714c107eb7", 560, 620)}
                  srcSet={`${PHOTO("photo-1670963025124-36714c107eb7", 560, 620)} 560w, ${PHOTO("photo-1670963025124-36714c107eb7", 900, 996)} 900w`}
                  sizes="30vw"
                  alt="A desk with a laptop and an open notebook"
                  width={560}
                  height={620}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[14/15] w-full object-cover"
                />
              </div>
            </div>
            <div className="reveal">
              <Faq />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ final CTA */}
        <section className="surface-signature on-dark relative overflow-hidden">
          {/*
            The last screen, on a photograph.

            It was 669px of violet with four icons on it — the weakest end
            to a page this long, and the one place a visitor decides. The
            photograph is somebody at the moment this product is for: work
            finished, about to be sold. It is darkened far past the point
            where the headline and both buttons clear contrast, and the
            violet of the section still sits over it, so the band belongs
            to the same morning as everything above it.
          */}
          <img
            src={PHOTO("photo-1723914159511-8dd3d2b66805", 1600, 900)}
            srcSet={`${PHOTO("photo-1723914159511-8dd3d2b66805", 900, 506)} 900w, ${PHOTO("photo-1723914159511-8dd3d2b66805", 1600, 900)} 1600w`}
            sizes="100vw"
            alt=""
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25"
          />
          <div className="container-narrow relative py-20 text-center sm:py-28">
            {/*
              The five example stores, one last time.

              A row of faces above a call to action is the oldest move
              there is, and it only works when it is true. These are the
              five stores drawn at the top of this page, the same people,
              said again in the caption to be examples we built.
            */}
            <ul className="mx-auto mb-8 flex items-center justify-center -space-x-3">
              {[
                "photo-1543871595-e11129e271cc",
                "photo-1787647090008-4b88ffc977b7",
                "photo-1765429158141-b283bbe7d0e4",
                "photo-1758599880979-f6a64947b541",
                "photo-1780277993159-b4ca60e8922d",
              ].map((id) => (
                <li key={id}>
                  <img
                    src={PHOTO(id, 96, 96)}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white/80"
                  />
                </li>
              ))}
            </ul>
            <h2 className="t-h1 balance text-white">Put your first product up today</h2>
            <p className="t-lead mx-auto mt-6 max-w-xl text-white/80">
              {`Take your address, connect your own Stripe account and list what you sell. Your checkout is free for ${TRIAL_DAYS} days; your card is taken at the start and first charged $${PRICE} when the trial ends, unless you cancel before it.`}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Link href="/signin" className="btn btn-light btn-lg">
                Start your store
                <Icon name="arrow-right" size={18} />
              </Link>
              <Link href="/demo" className="link-arrow on-dark">
                See the live demo
                <Icon name="arrow-right" size={18} className="arrow" />
              </Link>
            </div>
            <ul className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[0.9375rem] text-white/80">
              {[
                { icon: "calendar" as IconName, text: `${TRIAL_DAYS} days free` },
                { icon: "door" as IconName, text: "Cancel in two clicks" },
                { icon: "percent" as IconName, text: "0% of your sales" },
                { icon: "lock" as IconName, text: "Payments by Stripe" },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-2">
                  <Icon name={f.icon} size={17} className="text-white/70" />
                  {f.text}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-[0.8125rem] text-white/65">
              Example stores we built. The photographs are licensed stock, not customers of ours.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
      <HomeData questions={HOME_QUESTIONS} />
    </div>
  );
}
