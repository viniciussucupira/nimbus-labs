import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { PhoneScreens } from "@/components/phone-screens";
import { SiteNav } from "@/components/site-nav";
import {
  DemoWindow,
  Faq,
  Pricing,
  RevealOnScroll,
  StoreMock,
} from "@/components/home-parts";

export const metadata: Metadata = {
  title: "Nimbus Labs — the link-in-bio store that pays into your own Stripe",
  description:
    "A colourful, fast store page for creators who sell files, plans and calls. Buyers pay into your own Stripe account, the file is delivered the second the payment clears, and Nimbus takes 0% of your sales.",
};

const PHOTO = (id: string, w = 400, h = 400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=${w}&h=${h}&q=70`;

const HERO_FACES = [
  {
    id: "photo-1662850886700-4ec19bd30d11",
    alt: "A woman with curly hair, smiling",
    className: "left-0 top-6 h-20 w-20 nb-float",
    ring: "ring-amber-brand",
  },
  {
    id: "photo-1630939687530-241d630735df",
    alt: "A woman with long dark hair, smiling",
    className: "right-2 top-0 h-16 w-16 nb-float-slow",
    ring: "ring-pink-brand",
  },
  {
    id: "photo-1757744705465-ea08b0ddc38a",
    alt: "A young man in a navy jumper, smiling",
    className: "bottom-24 left-2 h-16 w-16 nb-float-slow",
    ring: "ring-mint-brand",
  },
  {
    id: "photo-1758598497192-15ffa411c3de",
    alt: "A man with a beard, smiling",
    className: "bottom-8 right-0 h-20 w-20 nb-float",
    ring: "ring-sky-brand",
  },
];

const CHIPS = [
  { label: "Meal plans", color: "bg-mint-brand/15 text-mint-deep" },
  { label: "Lightroom presets", color: "bg-violet-brand/10 text-violet-deep" },
  { label: "Workout programs", color: "bg-pink-brand/10 text-pink-brand" },
  { label: "Notion templates", color: "bg-sky-brand/15 text-sky-brand" },
  { label: "Coaching calls", color: "bg-amber-brand/15 text-amber-brand" },
  { label: "Study guides", color: "bg-violet-brand/10 text-violet-deep" },
  { label: "Sheet music", color: "bg-mint-brand/15 text-mint-deep" },
  { label: "Recipe packs", color: "bg-pink-brand/10 text-pink-brand" },
];

const STEPS = [
  {
    n: "01",
    title: "Connect your own Stripe",
    body: "You keep your account. Payments are charged directly on it, so the money never passes through us.",
    art: "from-violet-brand to-sky-brand",
    emoji: "🔗",
  },
  {
    n: "02",
    title: "Build a store that looks like you",
    body: "Your photo, your colours, your links, your products — with as many price options as the product needs.",
    art: "from-pink-brand to-amber-brand",
    emoji: "🎨",
  },
  {
    n: "03",
    title: "Sell and deliver in one second",
    body: "The buyer pays, the file is released immediately, and the link stays valid for three days.",
    art: "from-mint-brand to-sky-brand",
    emoji: "⚡",
  },
];

const FEATURES = [
  {
    title: "Several prices for one product",
    body: "One week for $27, five weeks for $39 — the buyer picks, and each option delivers its own file.",
    state: "Live in the demo",
    tint: "bg-violet-brand text-white",
    emoji: "🏷️",
    span: "md:col-span-2",
  },
  {
    title: "Instant delivery",
    body: "The file is released only after Stripe confirms the payment. No manual sending, no waiting.",
    state: "Live in the demo",
    tint: "bg-mint-brand text-ink",
    emoji: "📦",
    span: "",
  },
  {
    title: "An About me section",
    body: "A face and a story on the page, not only a list of buttons.",
    state: "Live in the demo",
    tint: "bg-amber-brand text-ink",
    emoji: "🙋",
    span: "",
  },
  {
    title: "Your own domain",
    body: "yourname.com pointing at your store, with the certificate handled for you.",
    state: "Being built",
    tint: "bg-pink-brand text-white",
    emoji: "🌐",
    span: "",
  },
  {
    title: "A customer area",
    body: "Your buyers find every purchase in one place instead of digging through old e-mails.",
    state: "Being built",
    tint: "bg-sky-brand text-ink",
    emoji: "🗂️",
    span: "md:col-span-2",
  },
];

const COMPARE = [
  {
    row: "Who holds the money from a sale",
    stan: "A Stripe account managed by the platform",
    nimbus: "Your own Stripe account",
  },
  {
    row: "Cut of each sale",
    stan: "0% platform fee, plus Stripe's own fees",
    nimbus: "0% platform fee, plus Stripe's own fees",
  },
  {
    row: "Getting paid out",
    stan: "Manual cash-out, $10 minimum, payout fee",
    nimbus: "Your Stripe payout schedule, no minimum from us",
  },
  {
    row: "Several prices for one product",
    stan: "Not available",
    nimbus: "Working in the demo store today",
  },
  {
    row: "Your own domain",
    stan: "Not available",
    nimbus: "Being built",
  },
];

const GALLERY = [
  {
    id: "photo-1553640662-9ab20b8fa2ea",
    alt: "A man in a leather jacket, smiling",
    label: "Photographers",
    tint: "from-violet-brand/80",
  },
  {
    id: "photo-1595085610896-fb31cfd5d4b7",
    alt: "A woman smiling in a red shirt",
    label: "Coaches",
    tint: "from-pink-brand/80",
  },
  {
    id: "photo-1746781420003-d15e604b9a10",
    alt: "A woman laughing in the sunlight",
    label: "Nutritionists",
    tint: "from-mint-brand/80",
  },
  {
    id: "photo-1507003211169-0a1dd7228f2d",
    alt: "A man in a white t-shirt, smiling",
    label: "Gamers",
    tint: "from-sky-brand/80",
  },
  {
    id: "photo-1713370572362-35983645f6a7",
    alt: "A woman laughing with her hands on her cheeks, against a bright green background",
    label: "Teachers",
    tint: "from-amber-brand/80",
  },
  {
    id: "photo-1539694265588-f101b5569bd2",
    alt: "A man smiling in bright pink and blue light",
    label: "Musicians",
    tint: "from-violet-deep/80",
  },
];

/* The faces that greet a phone. The floating portraits beside the store mock
   only fit from the small breakpoint up, so on a phone — where most creators
   open this page — there was nobody on the screen at all. This row fixes that. */
const HELLO_FACES = [
  { id: "photo-1544507888-56d73eb6046e", alt: "A woman laughing outdoors", ring: "ring-amber-brand" },
  { id: "photo-1654817758777-c8a6101783ea", alt: "A man laughing, covered in colour", ring: "ring-mint-brand" },
  { id: "photo-1594756154841-ac5d160dbf46", alt: "A woman laughing against a warm pink wall", ring: "ring-pink-brand" },
  { id: "photo-1606337332936-b797a7d4f4c9", alt: "A man smiling outdoors", ring: "ring-sky-brand" },
  { id: "photo-1713370572362-35983645f6a7", alt: "A woman laughing against a bright green background", ring: "ring-violet-brand" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content">

      {/* ---------------- hero ---------------- */}
      <section className="nb-mesh nb-grain relative overflow-hidden text-white">
        <div
          aria-hidden="true"
          className="nb-blob absolute -left-24 top-10 h-72 w-72 bg-pink-brand/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="nb-blob absolute -right-20 bottom-0 h-80 w-80 bg-mint-brand/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="nb-spin-slow absolute right-1/3 top-10 hidden h-40 w-40 rounded-[38%] border-4 border-white/10 lg:block"
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <span aria-hidden="true">🌈</span> Link-in-bio store for creators
            </p>
            <h1 className="font-display mt-5 text-4xl leading-[1.05] font-black sm:text-6xl">
              Your store.
              <br />
              Your Stripe.
              <br />
              <span className="nb-gradient-text">Your money.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-white/85">
              Nimbus Labs is a store page for creators who sell files, plans and
              calls. The buyer pays straight into your own Stripe account, the
              file is delivered a second later, and we take{" "}
              <strong className="text-white">0% of your sales</strong>.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/creators"
                className="rounded-full bg-white px-7 py-3.5 font-bold text-violet-deep shadow-xl shadow-ink/30 transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get early access
              </Link>
              <DemoWindow />
            </div>

            {/* On a phone the floating portraits do not fit, so the faces
                come here instead, right under the buttons. */}
            <div className="mt-9 flex items-center gap-4 sm:hidden">
              <div className="flex -space-x-3">
                {HELLO_FACES.map((face) => (
                  <img
                    key={face.id}
                    src={PHOTO(face.id, 112, 112)}
                    alt={face.alt}
                    width={56}
                    height={56}
                    loading="lazy"
                    className={`h-14 w-14 rounded-full object-cover ring-4 ${face.ring} ring-offset-2 ring-offset-transparent`}
                  />
                ))}
              </div>
              <p className="text-sm font-semibold leading-tight text-white/85">
                For people who sell
                <br />
                what they know
              </p>
            </div>

            <ul className="mt-10 flex flex-wrap gap-2 text-sm font-semibold">
              {[
                { t: "0% of your sales", e: "💸" },
                { t: "Payouts on your Stripe schedule", e: "🏦" },
                { t: "Built in public", e: "🛠️" },
              ].map((item) => (
                <li
                  key={item.t}
                  className="flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 backdrop-blur"
                >
                  <span aria-hidden="true">{item.e}</span>
                  {item.t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            {HERO_FACES.map((face) => (
              <img
                key={face.id}
                src={PHOTO(face.id, 160, 160)}
                alt={face.alt}
                loading="lazy"
                className={`absolute z-10 hidden rounded-full object-cover ring-4 ring-offset-2 ring-offset-transparent sm:block ${face.className} ${face.ring}`}
              />
            ))}
            <StoreMock />
          </div>
        </div>

        {/* marquee */}
        <div className="relative border-t border-white/10 bg-white/5 py-4">
          <div className="nb-marquee-track gap-3">
            {[...CHIPS, ...CHIPS].map((chip, i) => (
              <span
                key={`${chip.label}-${i}`}
                className="whitespace-nowrap rounded-full bg-white px-5 py-2 text-sm font-bold text-ink"
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <PhoneScreens />

      {/* ---------------- how it works ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="font-semibold uppercase tracking-[0.2em] text-pink-brand">
            How it works
          </p>
          <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
            Three steps, and the store is selling
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="nb-lift reveal relative overflow-hidden rounded-3xl border-2 border-ink/10 bg-white p-7 shadow-xl shadow-ink/5"
            >
              <div
                aria-hidden="true"
                className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${step.art} opacity-25 blur-xl`}
              />
              <span
                aria-hidden="true"
                className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${step.art} text-2xl shadow-lg`}
              >
                {step.emoji}
              </span>
              <p className="font-display mt-5 text-sm font-black text-ink-soft">
                {step.n}
              </p>
              <h3 className="font-display mt-1 text-xl font-extrabold">
                {step.title}
              </h3>
              <p className="mt-2 text-ink-soft">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- features bento ---------------- */}
      <section className="bg-cream py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-semibold uppercase tracking-[0.2em] text-violet-deep">
                What is in the box
              </p>
              <h2 className="font-display mt-3 max-w-xl text-3xl font-black sm:text-4xl">
                Every card says what is live and what is still being built
              </h2>
            </div>
            <p className="max-w-sm text-ink-soft">
              No feature is listed here before it exists in the code. You can
              open the demo store and check any of the green ones yourself.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className={`nb-lift reveal rounded-3xl border-2 border-ink/10 bg-white p-7 shadow-lg shadow-ink/5 ${f.span}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    aria-hidden="true"
                    className={`grid h-12 w-12 place-items-center rounded-2xl text-xl ${f.tint}`}
                  >
                    {f.emoji}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      f.state === "Live in the demo"
                        ? "bg-mint-brand/15 text-mint-deep"
                        : "bg-ink/5 text-ink-soft"
                    }`}
                  >
                    {f.state}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-xl font-extrabold">
                  {f.title}
                </h3>
                <p className="mt-2 text-ink-soft">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- money ---------------- */}
      <section id="money" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="reveal">
            <p className="font-semibold uppercase tracking-[0.2em] text-mint-deep">
              The money
            </p>
            <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
              We never touch a cent of your sales
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              Your buyer pays on your own Stripe account, through a direct
              charge. Payouts follow your Stripe schedule, disputes and refunds
              are handled in your own dashboard, and if you ever leave, the
              account was always yours.
            </p>
            <p className="mt-4 text-lg text-ink-soft">
              We make money one way only: a monthly subscription. That is the
              whole business model, written on one line.
            </p>
            <Link
              href="/creators"
              className="mt-7 inline-block rounded-full bg-ink px-7 py-3.5 font-bold text-white transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
            >
              Tell me what you sell
            </Link>
          </div>

          <div className="reveal grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-lg">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                Sale of $39
              </p>
              <p className="font-display mt-3 text-4xl font-black">$39.00</p>
              <p className="mt-1 text-sm text-ink-soft">paid by your buyer</p>
              <div className="mt-5 space-y-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-ink-soft">Stripe fees</span>
                  <span className="font-semibold">charged by Stripe</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-ink-soft">Nimbus Labs</span>
                  <span className="font-bold text-mint-deep">$0.00</span>
                </p>
              </div>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-violet-brand to-pink-brand p-6 text-white shadow-xl">
              <p className="text-sm font-bold uppercase tracking-wide text-white/80">
                Where it lands
              </p>
              <p className="font-display mt-3 text-2xl font-black">
                Your Stripe account
              </p>
              <p className="mt-2 text-white/85">
                Same account you already use, same payout rhythm, same
                dashboard.
              </p>
              <p className="mt-6 rounded-2xl bg-white/15 p-3 text-sm">
                Tested on 17 September 2026 with a real Stripe checkout in test
                mode: the sale landed on the creator&apos;s account with no cut
                for the platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- speed ---------------- */}
      <section
        id="speed"
        className="nb-mesh nb-grain relative scroll-mt-28 overflow-hidden py-20 text-white"
      >
        <div
          aria-hidden="true"
          className="nb-blob absolute -right-24 top-0 h-72 w-72 bg-amber-brand/30 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="reveal max-w-2xl">
            <p className="font-semibold uppercase tracking-[0.2em] text-amber-brand">
              Speed
            </p>
            <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
              A slow store is a store people leave
            </h2>
            <p className="mt-4 text-white/80">
              Measured with Google PageSpeed Insights on a simulated phone, on
              17 September 2026. Higher is better, and the test is public — run
              it yourself on any store you like.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Nimbus demo store", score: "97–100", tone: "bg-mint-brand text-ink" },
              { label: "Stan store A", score: "57", tone: "bg-white/10 text-white" },
              { label: "Stan store B", score: "57", tone: "bg-white/10 text-white" },
              { label: "Stan store C", score: "58", tone: "bg-white/10 text-white" },
            ].map((item) => (
              <div
                key={item.label}
                className={`reveal rounded-3xl p-6 ${item.tone}`}
              >
                <p className="font-display text-5xl font-black">{item.score}</p>
                <p className="mt-2 text-sm font-semibold opacity-80">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          <p className="reveal mt-6 text-sm text-white/60">
            Performance score on mobile. Stan stores measured: three public
            stores chosen at random on the same day, same tool, same settings.
          </p>
        </div>
      </section>

      {/* ---------------- compare ---------------- */}
      <section id="compare" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-20">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="font-semibold uppercase tracking-[0.2em] text-violet-deep">
            Side by side
          </p>
          <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
            How we compare with Stan
          </h2>
          <p className="mt-4 text-ink-soft">
            Checked on Stan&apos;s own public pricing, terms and help pages in
            September 2026. If any of it changes, this table changes.
          </p>
        </div>

        <div className="reveal mt-10 overflow-hidden rounded-3xl border-2 border-ink/10 shadow-xl shadow-ink/5">
          <table className="w-full border-collapse text-left text-sm sm:text-base">
            <thead>
              <tr className="bg-ink text-white">
                <th scope="col" className="p-4 font-semibold">
                  &nbsp;
                </th>
                <th scope="col" className="p-4 font-semibold">
                  Stan
                </th>
                <th scope="col" className="bg-violet-brand p-4 font-semibold">
                  Nimbus Labs
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r, i) => (
                <tr key={r.row} className={i % 2 ? "bg-lilac/40" : "bg-white"}>
                  <th
                    scope="row"
                    className="p-4 text-left font-semibold text-ink"
                  >
                    {r.row}
                  </th>
                  <td className="p-4 text-ink-soft">{r.stan}</td>
                  <td className="p-4 font-semibold text-violet-deep">
                    {r.nimbus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- gallery ---------------- */}
      <section className="nb-joy py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="font-semibold uppercase tracking-[0.2em] text-pink-brand">
              Who it is for
            </p>
            <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
              People who sell what they know
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GALLERY.map((item) => (
              <figure
                key={item.id}
                className="nb-lift reveal relative overflow-hidden rounded-[2rem] shadow-xl ring-4 ring-white"
              >
                <img
                  src={PHOTO(item.id, 500, 620)}
                  alt={item.alt}
                  loading="lazy"
                  className="h-80 w-full object-cover"
                />
                <figcaption
                  className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${item.tint} to-transparent p-4 font-display text-lg font-extrabold text-white`}
                >
                  {item.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- pricing ---------------- */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-28 px-4 py-20">
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="font-semibold uppercase tracking-[0.2em] text-amber-brand">
            Pricing
          </p>
          <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
            The same price as Stan, with more in the box
          </h2>
          <p className="mt-4 text-ink-soft">
            Nothing is charged today. These are the planned prices for early
            access, and you will be told the exact terms before any card is
            asked for.
          </p>
        </div>
        <div className="mt-10">
          <Pricing />
        </div>
      </section>

      {/* ---------------- faq ---------------- */}
      <section id="faq" className="bg-cream py-20">
        <div className="mx-auto max-w-3xl scroll-mt-28 px-4">
          <div className="reveal text-center">
            <p className="font-semibold uppercase tracking-[0.2em] text-mint-deep">
              Questions
            </p>
            <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
              Including the awkward ones
            </h2>
          </div>
          <div className="mt-10">
            <Faq />
          </div>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-brand via-pink-brand to-amber-brand py-20 text-white">
        <div
          aria-hidden="true"
          className="nb-blob absolute -left-16 top-4 h-64 w-64 bg-white/20 blur-2xl"
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-3xl font-black sm:text-5xl">
            Tell me what is broken in your store today
          </h2>
          <p className="mt-5 text-lg text-white/90">
            Early access opens with the first creators who answer. It takes two
            minutes, there is nothing to buy, and you get the answers in
            writing.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/creators"
              className="rounded-full bg-white px-8 py-4 font-bold text-violet-deep shadow-xl transition hover:-translate-y-0.5"
            >
              Get early access
            </Link>
            <Link
              href="/demo"
              className="rounded-full border-2 border-white/80 px-8 py-4 font-bold text-white transition hover:bg-white hover:text-violet-deep"
            >
              See the live store
            </Link>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  );
}
