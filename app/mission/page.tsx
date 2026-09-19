import type { Metadata } from "next";
import Link from "next/link";
import { RevealOnScroll } from "@/components/home-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { isConnectConfigured } from "@/lib/stripe-connect";

export const metadata: Metadata = {
  title: "Our mission — Nimbus Labs",
  description:
    "Why Nimbus exists, what we believe, what we have built so far and what we have not built yet. Written plainly, including the parts that are not finished.",
};

const VALUES = [
  {
    emoji: "🧾",
    title: "Charge fairly, promise only what we can deliver",
    text: "One subscription, written in one line. No cut of your sales, no fee that appears at the last screen, no feature listed on the site that does not exist in the product.",
    tone: "bg-lilac",
  },
  {
    emoji: "🔑",
    title: "The money is yours from the first second",
    text: "Your buyer pays into your own Stripe account. We never hold your balance, never set your payout schedule, and never stand between you and your customer's card.",
    tone: "bg-cream",
  },
  {
    emoji: "🪟",
    title: "Say the uncomfortable part out loud",
    text: "Where a competitor is better than us, we write it down. Where we have not built something yet, the page says so instead of going quiet.",
    tone: "bg-mint-brand/12",
  },
  {
    emoji: "⚡",
    title: "Fast is a feature, not a bonus",
    text: "Your buyer is on a phone, on mobile data, with three seconds of patience. Every page we ship is measured, and the numbers are published on the site.",
    tone: "bg-sky-brand/12",
  },
  {
    emoji: "🚪",
    title: "Easy to leave",
    text: "Your Stripe account, your customer list and your files stay yours. A product people stay with because leaving is hard is not a product we want to run.",
    tone: "bg-pink-brand/10",
  },
  {
    emoji: "🎨",
    title: "A store worth putting in your bio",
    text: "Colour, movement and a page that looks like a person made it. A store that looks like a form is a store people close.",
    tone: "bg-amber-brand/12",
  },
];

const BUILT = [
  "A store page with your links, your products and your own look",
  "Price options on one product — one week, five weeks, the season",
  "A Stripe checkout that charges the creator account directly, with nothing taken on top — running in test mode on the demo store",
  "The file delivered the second the payment clears, with a link that expires",
  "A buyer who loses that link gets it sent again — no account, no password",
  "A creator account you sign in to with an emailed link, and no password at all",
  "Your own store address, live the moment you take it",
  "A change of address that never breaks the link already in your bio",
  "An editor for your own store: the name, the description, and what you sell with its price",
  "The file you sell, uploaded straight from your browser and kept where only you can reach it",
  "A store that installs to the home screen on iPhone and Android",
  "A live demo store anyone can buy from with a test card, before signing up",
];

/**
 * One line that moves between the two lists depending on this deployment.
 *
 * The code is written either way; what changes is whether this site can
 * actually reach Stripe. The page says which of those is true here rather
 * than claiming a button that would do nothing.
 */
const STRIPE_LINE =
  "Connecting your own Stripe account from the studio, so charges are made on it and not on ours";

const NOT_BUILT = [
  "The checkout itself, which charges your buyer on your connected account",
  "PayPal as a second way to be paid — it is Stripe only today",
  "Courses with lessons and progress",
  "Memberships that charge every month",
  "Communities and group chat",
  "Scheduled calls with a calendar",
  "Email marketing and automations",
  "An affiliate programme",
];

export default function MissionPage() {
  // Whether this deployment can actually reach Stripe decides which list the
  // line belongs in. A feature nobody here can press is not a built feature.
  const built = isConnectConfigured() ? [...BUILT, STRIPE_LINE] : BUILT;
  const notBuilt = isConnectConfigured()
    ? NOT_BUILT
    : [STRIPE_LINE, ...NOT_BUILT];
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content" className="flex-1">
        {/* ---------------- hero ---------------- */}
        <section className="nb-mesh nb-grain relative overflow-hidden text-white">
          <div
            aria-hidden="true"
            className="nb-blob absolute -left-24 top-0 h-72 w-72 bg-violet-brand/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="nb-blob absolute -right-16 bottom-0 h-72 w-72 bg-amber-brand/25 blur-3xl"
          />
          <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <span aria-hidden="true">🎯</span> Our mission
            </p>
            <h1 className="font-display mt-6 text-4xl font-black leading-[1.05] sm:text-6xl">
              Nobody should need a platform&apos;s permission{" "}
              <span className="nb-gradient-text">to be paid for their work</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
              Selling something you made should cost you the card fee and
              nothing more. That is the whole idea, and everything we build is
              judged against it.
            </p>
          </div>
        </section>

        {/* ---------------- why ---------------- */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="font-display text-3xl font-black sm:text-4xl">
            Why Nimbus exists
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            A creator with an audience and a file to sell has never had more
            tools and never had less control. The common arrangement is this:
            the buyer pays the platform, the platform keeps a percentage, the
            platform holds the balance, and the platform decides when the money
            moves and under what rules.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Each of those is a small thing on one sale. Together they decide
            whether the work you did is a business you own or an account
            somebody else can close.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Nimbus is built the other way around. The buyer&apos;s card is
            charged on your Stripe account. The receipt carries your name. The
            payout schedule is yours. We take 0% of your sales and make money
            one way only — a monthly subscription, the same price whether you
            sell three files or three thousand.
          </p>

          <div className="mt-10 rounded-3xl border-l-8 border-violet-brand bg-lilac p-7">
            <p className="font-display text-xl font-black text-ink">
              A note on how we write
            </p>
            <p className="mt-3 text-ink-soft">
              We do not publish invented reviews, invented customers or
              screenshots of money we never made. If a page shows a person, they
              are a stock photograph and the page says so. When we compare
              ourselves with anyone, we link to their own site so you can check
              it. It is a slower way to sell, and it is the only one we are
              willing to run.
            </p>
            <p className="mt-4 text-sm font-semibold text-ink">
              Vinicius Sucupira · Founder, Nimbus Labs
            </p>
          </div>
        </section>

        {/* ---------------- values ---------------- */}
        <section className="bg-lilac/40 px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-center text-3xl font-black sm:text-4xl">
              What we hold ourselves to
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-ink-soft">
              Six rules. Every one of them is something you can check on the
              site or in the product.
            </p>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {VALUES.map((value) => (
                <div
                  key={value.title}
                  className={`reveal rounded-3xl ${value.tone} p-7 shadow-[0_14px_36px_rgba(20,15,61,0.07)]`}
                >
                  <p className="text-3xl" aria-hidden="true">
                    {value.emoji}
                  </p>
                  <h3 className="font-display mt-4 text-lg font-black leading-snug text-ink">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    {value.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- honest status ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl font-black sm:text-4xl">
            Where the product actually is today
          </h2>
          <p className="mt-4 max-w-2xl text-ink-soft">
            Nimbus is early. Here is the whole picture, both columns, so nobody
            signs up expecting the second one.
          </p>

          <div className="mt-10 grid gap-7 lg:grid-cols-2">
            <div className="reveal rounded-3xl border-2 border-mint-brand/30 bg-mint-brand/8 p-8">
              <p className="inline-flex rounded-full bg-mint-brand px-4 py-1.5 text-sm font-black text-mint-deep">
                Built and working
              </p>
              <ul className="mt-6 space-y-3">
                {built.map((item) => (
                  <li key={item} className="flex gap-3 text-ink-soft">
                    <span
                      aria-hidden="true"
                      className="font-black text-mint-deep"
                    >
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/demo"
                className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5"
              >
                Try it in the demo store
              </Link>
            </div>

            <div className="reveal rounded-3xl border-2 border-ink/10 bg-white p-8">
              <p className="inline-flex rounded-full bg-ink/10 px-4 py-1.5 text-sm font-black text-ink">
                Not built yet
              </p>
              <ul className="mt-6 space-y-3">
                {notBuilt.map((item) => (
                  <li key={item} className="flex gap-3 text-ink-soft">
                    <span aria-hidden="true" className="font-black text-ink/30">
                      —
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-7 text-sm text-ink-soft">
                Other platforms have these today. If you need them now, they are
                the better choice now, and{" "}
                <Link
                  href="/proof/compare"
                  className="font-bold text-violet-deep underline underline-offset-4"
                >
                  our comparison page
                </Link>{" "}
                says so in writing.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- cta ---------------- */}
        <section className="px-4 pb-20">
          <div className="reveal mx-auto max-w-4xl rounded-[2rem] bg-gradient-to-br from-violet-brand via-pink-brand to-amber-brand p-10 text-center text-white shadow-xl">
            <h2 className="font-display text-3xl font-black sm:text-4xl">
              Help decide what gets built next
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/90">
              Tell us what you sell and what breaks today. It takes two minutes,
              there is nothing to buy, and it is what the roadmap is made of.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/creators"
                className="rounded-full bg-white px-7 py-3.5 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5"
              >
                Get early access
              </Link>
              <Link
                href="/blog"
                className="rounded-full border-2 border-white/70 px-7 py-3.5 font-bold text-white transition hover:bg-white hover:text-violet-deep"
              >
                Read the journal
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
