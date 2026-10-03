"use client";

import { AI_MONTHLY } from "@/lib/ai-rules";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { HOME_QUESTIONS } from "@/lib/home-faq";
import { PLAN_NAMES, PLAN_PRICES, PRO_MONTHLY_EMAILS, TRIAL_DAYS, TRIAL_MONTHLY_EMAILS, yearSaving } from "@/lib/plan";

/* Reveals every element with .reveal as it scrolls into view, once. */
export function RevealOnScroll() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return null;
}

/*
 * The hero: one composition that shows the whole sale — the store, the Stripe
 * checkout, the file delivered and the money landing in the creator's own
 * account. It plays through once and then stays on the last step; the three
 * buttons under it let anyone step back and forth. With reduced motion it
 * opens on the finished state.
 */
const FLOW = [
  { key: "pick", label: "Pick a plan", short: "Pick" },
  { key: "pay", label: "Pay on Stripe", short: "Pay" },
  { key: "get", label: "File delivered", short: "Get the file" },
] as const;

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/*
 * Five creators, cycling.
 *
 * The hero used to draw one store, and one store is a diagram. Five, each
 * with a face and a different thing for sale, is a market: the page is
 * for people who sell what they know, so the first thing on it should be
 * people. They change every five seconds, carrying their own colour, so
 * the first screen is never the same twice and never still.
 *
 * All five are stores we built as examples, and the line under the
 * picture says so. Nobody here is presented as a customer.
 */
const STORES = [
  {
    handle: "harborkitchen",
    name: "Harbor Kitchen",
    line: "Simple family meals by Jenny",
    photo: "photo-1543871595-e11129e271cc",
    item: "Weekly meal planner",
    options: [
      { label: "1 week", price: "$27" },
      { label: "5 weeks", price: "$39" },
    ],
    links: ["Free recipe of the week", "About Jenny"],
    tint: "#ff7a59",
  },
  {
    handle: "mornpractice",
    name: "Morning Practice",
    line: "Mobility and strength by Ada",
    photo: "photo-1787647090008-4b88ffc977b7",
    item: "30-day mobility plan",
    options: [
      { label: "The plan", price: "$34" },
      { label: "Plan + 2 calls", price: "$89" },
    ],
    links: ["Free hip routine", "Book a session"],
    tint: "#15a37a",
  },
  {
    handle: "lightandgrain",
    name: "Light & Grain",
    line: "Film presets by Theo",
    photo: "photo-1765429158141-b283bbe7d0e4",
    item: "Golden hour pack",
    options: [
      { label: "12 presets", price: "$24" },
      { label: "Everything", price: "$59" },
    ],
    links: ["Before and after", "How I shoot"],
    tint: "#ffcf4d",
  },
  {
    handle: "thequietdesk",
    name: "The Quiet Desk",
    line: "Study systems by Maren",
    photo: "photo-1758599880979-f6a64947b541",
    item: "Focus course",
    options: [
      { label: "The course", price: "$49" },
      { label: "Course + templates", price: "$69" },
    ],
    links: ["Free first lesson", "Student results"],
    tint: "#5a36ee",
  },
  {
    handle: "saltandsteel",
    name: "Salt & Steel",
    line: "Knife skills by Dmitri",
    photo: "photo-1780277993159-b4ca60e8922d",
    item: "Sharpening masterclass",
    options: [
      { label: "Masterclass", price: "$39" },
      { label: "With the live Q&A", price: "$79" },
    ],
    links: ["Free knife guide", "Watch a clip"],
    tint: "#e8456b",
  },
] as const;

const FACE = (id: string, s = 96) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=${s}&h=${s}&q=70`;

export function HeroFlow() {
  const [played, setPlayed] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [store, setStore] = useState(0);
  const reduce = useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );

  // With reduced motion the finished sale shows at once; otherwise it plays
  // through once. A step somebody picked always wins.
  const step = chosen ?? (reduce ? 2 : played);

  useEffect(() => {
    if (chosen !== null || reduce || played >= 2) return;
    const t = setTimeout(() => setPlayed((s) => Math.min(2, s + 1)), played === 0 ? 2200 : 1900);
    return () => clearTimeout(t);
  }, [chosen, reduce, played]);

  /*
   * The store on the phone changes every five seconds, for as long as
   * anybody is looking. Five seconds is long enough to read the name, the
   * thing for sale and both prices without hurrying, and the only motion
   * is the fade — nothing slides, so nothing has to be chased.
   *
   * It stops entirely for anyone who has asked motion to stop; they see
   * the first store, which is the one the rest of the page talks about.
   */
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setStore((s) => (s + 1) % STORES.length), 5000);
    return () => clearInterval(t);
  }, [reduce]);

  const s = STORES[store];

  const choose = (i: number) => setChosen(i);

  const paying = step === 1;
  const paid = step === 2;

  return (
    <div className="relative mx-auto w-full max-w-[35rem]">
      {/*
        Two compositions, not one squeezed.
        On a wide screen the three cards overlap in depth, which is what makes
        it read as one movement. On a phone there is no depth to spend: the
        same three pieces stack in the order they happen — the store, then
        whichever card the current step is on, then where the money landed —
        so nothing is laid over the phone it is meant to be explaining.
      */}
      <div className="flex flex-col items-center gap-4 lg:relative lg:block lg:h-[35rem]">
        {/* soft light behind the devices */}
        <div
          aria-hidden="true"
          className="absolute left-[56%] top-[38%] h-[78%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.5),transparent)] blur-2xl"
        />
        {/*
          The thread the sale runs along. Two faint strokes from the store to
          the checkout and from the checkout down to the delivery: enough to
          read the three cards as one movement, far too faint to compete with
          them. Hidden on a phone, where the cards are already stacked in the
          order they happen.
        */}
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
        >
          <path
            d="M34 26 C 52 22, 58 24, 70 30"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="0.35"
            strokeDasharray="1.6 1.6"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M82 50 C 84 60, 80 64, 74 70"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="0.35"
            strokeDasharray="1.6 1.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* the store, on a phone */}
        <div className="w-[15.5rem] lg:absolute lg:left-0 lg:top-0 lg:w-[54%] lg:max-w-[16.5rem]">
          <div className="device">
            <div className="device-screen">
              <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[10px] font-semibold text-ink-mute">
                <span>9:41</span>
                <span className="rounded-[5px] bg-white px-1.5 py-0.5 text-[9px] text-ink-soft ring-1 ring-line">
                  {`marktmorgen.com/@${s.handle}`}
                </span>
              </div>
              {/*
                Everything below changes with the store. The key on this
                wrapper is the store's own, so React replaces the subtree
                rather than editing it, and the CSS animation on .nb-swap
                runs again from the top each time.
              */}
              <div key={s.handle} className="nb-swap px-3.5 pb-4 pt-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={FACE(s.photo)}
                    alt=""
                    width={40}
                    height={40}
                    fetchPriority="high"
                    className="h-10 w-10 rounded-full bg-sand-deep object-cover ring-2 ring-white"
                    style={{ boxShadow: `0 0 0 3px ${s.tint}33` }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-tight text-ink">{s.name}</p>
                    <p className="truncate text-[10.5px] text-ink-mute">{s.line}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-[12px] border border-line bg-white p-2.5">
                  <p className="text-[11px] font-semibold text-ink" style={{ color: s.tint }}>
                    {s.item}
                  </p>
                  <div className="mt-2 grid gap-1.5">
                    <div className="flex items-center justify-between rounded-[9px] border border-line px-2.5 py-2 text-[11.5px]">
                      <span className="text-ink-soft">{s.options[0].label}</span>
                      <span className="font-semibold text-ink">{s.options[0].price}</span>
                    </div>
                    <div
                      className={`flex items-center justify-between rounded-[9px] border px-2.5 py-2 text-[11.5px] transition-colors duration-500 ${
                        step === 0 ? "border-violet-brand bg-lilac" : "border-violet-brand/50 bg-lilac/60"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink">
                        <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-violet-brand text-white">
                          <Icon name="check" size={9} strokeWidth={3} />
                        </span>
                        <span className="truncate">{s.options[1].label}</span>
                      </span>
                      <span className="font-semibold text-ink">{s.options[1].price}</span>
                    </div>
                  </div>
                  <div
                    className={`mt-2.5 rounded-[9px] py-2 text-center text-[11.5px] font-semibold text-white transition-colors duration-500 ${
                      step === 0 ? "bg-violet-brand" : "bg-ink/80"
                    }`}
                  >
                    Continue to checkout
                  </div>
                </div>
                <div className="mt-2 grid gap-1.5">
                  {s.links.map((l) => (
                    <p key={l} className="truncate rounded-[9px] border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink-soft">
                      {l}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/*
          The slot the step's card sits in on a phone. It keeps one height
          whichever card is showing, so stepping through the sale does not
          make the page under it jump. At 640px the wrapper stops existing
          (`display: contents`) and both cards go back to being positioned
          against the composition itself.
        */}
        <div className="flex min-h-[15.5rem] w-full max-w-[18rem] items-center justify-center lg:contents">
        {/* the Stripe checkout */}
        <div
          className={`w-[17rem] transition-all duration-700 [transition-timing-function:var(--ease)] lg:absolute lg:right-0 lg:top-[7%] lg:w-[54%] lg:max-w-[16.5rem] ${
            step === 1 ? "opacity-100" : "hidden opacity-100 lg:block"
          } ${step === 0 ? "lg:translate-y-3 lg:opacity-65" : "lg:translate-y-0 lg:opacity-100"}`}
          aria-hidden={step === 0}
        >
          <div className="rounded-[16px] bg-white p-3.5 text-ink shadow-[var(--shadow-lg)] ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-ink-mute">Pay Harbor Kitchen</p>
              <Icon name="lock" size={13} className="text-ink-mute" />
            </div>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">$39.00</p>
            <p className="text-[10.5px] text-ink-mute">Weekly Meal Planner · 5 weeks</p>
            <div className="mt-3 grid gap-1.5 text-[11px]">
              <div className="rounded-[8px] border border-line px-2.5 py-1.5 text-ink-soft">sam@example.com</div>
              <div className="flex items-center justify-between rounded-[8px] border border-line px-2.5 py-1.5 text-ink-soft">
                <span>•••• 4242</span>
                <Icon name="card" size={13} />
              </div>
            </div>
            <div
              className={`mt-3 flex h-8 items-center justify-center gap-1.5 rounded-[8px] text-[11.5px] font-semibold text-white transition-colors duration-500 ${
                paid ? "bg-mint-brand" : "bg-ink"
              }`}
            >
              {paying ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Processing
                </>
              ) : paid ? (
                <>
                  <Icon name="check" size={13} strokeWidth={2.5} /> Paid
                </>
              ) : (
                "Pay $39.00"
              )}
            </div>
            <p className="mt-2 text-center text-[9.5px] text-ink-mute">Secure checkout by Stripe</p>
          </div>
        </div>

        {/* delivered */}
        <div
          className={`w-[17rem] transition-all duration-700 [transition-timing-function:var(--ease)] lg:absolute lg:bottom-[5.25rem] lg:right-[3%] lg:w-[62%] lg:max-w-[18.5rem] ${
            paid
              ? "opacity-100 lg:translate-y-0"
              : "hidden lg:block lg:pointer-events-none lg:translate-y-4 lg:opacity-0"
          }`}
          aria-hidden={!paid}
        >
          <div className="rounded-[16px] bg-white p-3 shadow-[var(--shadow-lg)] ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-mint-soft text-mint-deep">
                <Icon name="check" size={14} strokeWidth={2.5} />
              </span>
              <p className="text-[12px] font-semibold text-ink">Payment confirmed — your file is ready</p>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] border border-line p-2">
              <img
                src="/demo/five-1.webp"
                alt=""
                width={36}
                height={46}
                className="h-[46px] w-9 rounded-[4px] border border-line object-cover object-top"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-medium text-ink">meal-planner-5-weeks.pdf</p>
                <p className="text-[10px] text-ink-mute">The link works for 3 days</p>
              </div>
              <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-violet-brand text-white">
                <Icon name="download" size={14} strokeWidth={2.2} />
              </span>
            </div>
          </div>
        </div>

        {/*
          Where the money ended up, along the bottom of the whole composition.
          It is here from the first frame rather than arriving with the sale,
          because it is the claim the page is making: the line is the
          creator's own Stripe account, and the figure beside it is what the
          platform took. The row fills as the sale completes.
        */}
        </div>

        {/*
          The other four, waiting their turn.

          One phone is a diagram of a store; five faces is the market the
          name promises. They stand in the open ground under the phone —
          measured, not guessed: the phone ends at 67% of the composition's
          height and the money bar starts at 87%, and the right half of
          that band is taken by the delivery card, so this is the one
          rectangle with nothing in it.

          They are the stores not currently on the screen, at four sizes
          and four heights so the row reads as a crowd rather than a
          toolbar, and the one coming up next lifts and brightens a beat
          before it arrives — the change on the phone is announced rather
          than sprung.

          Only from 1024px up: below that the pieces are stacked in a
          column and there is no open ground to stand in.
        */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
          {STORES.map((o, i) => {
            const slot = ((i - store + STORES.length) % STORES.length) - 1;
            const spot = [
              { top: "69%", left: "1%", size: 56 },
              { top: "73%", left: "13%", size: 44 },
              { top: "70%", left: "24%", size: 50 },
              { top: "74%", left: "36%", size: 40 },
            ][slot];
            if (!spot) return null;
            const next = slot === 0;
            return (
              <span
                key={o.handle}
                className="absolute block rounded-full transition-all duration-700 [transition-timing-function:var(--ease)]"
                style={{
                  top: spot.top,
                  left: spot.left,
                  width: spot.size,
                  height: spot.size,
                  opacity: next ? 1 : 0.62,
                  transform: next ? "scale(1.16) translateY(-6px)" : "scale(1)",
                  boxShadow: `0 0 0 2px rgba(255,255,255,${next ? 0.92 : 0.4}), 0 12px 28px -8px ${o.tint}aa`,
                }}
              >
                <img
                  src={FACE(o.photo, 128)}
                  alt=""
                  width={spot.size}
                  height={spot.size}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full rounded-full object-cover"
                />
              </span>
            );
          })}
        </div>

        <div className="w-full max-w-[20rem] lg:absolute lg:inset-x-0 lg:bottom-0 lg:max-w-none">
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/14 bg-[#05081a]/85 px-3.5 py-3 backdrop-blur-sm lg:px-4">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/10 text-[#b9a8ff]">
                <Icon name="bank" size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-white">Your Stripe account</span>
                <span className="block text-[10.5px] text-white/70">Marktmorgen&rsquo;s cut: $0.00</span>
              </span>
            </span>
            {/*
              A figure on a screen has to say what it is. This one is the
              gross payment — what the buyer paid, before Stripe takes its own
              processing fee on the creator's account — and it is labeled as
              that both on screen and for a screen reader, in both states.
            */}
            <span className="shrink-0 text-right">
              <span className="block text-[9.5px] font-medium uppercase tracking-[0.08em] text-white/55">
                Gross payment
              </span>
              <span
                className={`mt-0.5 block rounded-[9px] px-2.5 py-1 text-[13px] font-semibold tabular-nums transition-colors duration-700 ${
                  paid ? "bg-mint-soft text-mint-deep" : "bg-white/10 text-white/70"
                }`}
              >
                {paid ? "+$39.00" : "$0.00"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/*
        What this picture is, said on the picture.

        It is a drawing of a sale, not a screenshot of one that happened, and
        the figure in the bar is what the buyer paid rather than what is left
        after the card is processed. Both of those are one line to say and
        would be a small lie to leave out on a page whose argument is that we
        do not tell them. The store it draws is the demo, which anybody can
        open and buy from with a test card.
      */}
      <p className="mt-6 text-center text-[0.8125rem] leading-relaxed text-white/70">
        Five example stores we built, and a sale drawn from the{" "}
        <Link href="/demo" className="font-medium text-white underline underline-offset-4 decoration-white/40 hover:decoration-white">
          demo store
        </Link>
        , which you can buy from with a test card. The people in the photographs are licensed stock, not customers of
        ours. The $39.00 is the gross payment; Stripe takes its own processing fee from it on your account, and
        Marktmorgen takes nothing on top.
      </p>

      <div className="mt-5 flex justify-center" role="group" aria-label="Steps of a sale">
        <ol className="flex items-center gap-1 rounded-[12px] bg-[#120a45]/55 p-1 ring-1 ring-white/14">
          {FLOW.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => choose(i)}
                aria-pressed={step === i}
                className={`flex h-11 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition-colors sm:h-10 ${
                  step === i ? "bg-white text-ink" : "text-white/80 hover:bg-white/12 hover:text-white"
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${
                    step === i ? "bg-violet-brand text-white" : "bg-white/15 text-white"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="whitespace-nowrap sm:hidden">{s.short}</span>
                <span className="hidden whitespace-nowrap sm:inline">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/*
 * Two plans, and every line under them is something you can open and try
 * today. A price with a feature beside it is a promise; a promise we cannot
 * keep is worse than a shorter list. Each yearly price is the same plan paid
 * once a year, and the studio opens either.
 */
const INCLUDED = [
  "Your own store address, live the moment you take it",
  "Buyers pay into your own Stripe account",
  "Up to 2,000 products: files, courses, memberships, paid calls and live sessions",
  "Sales pages and landing pages built from blocks, and reviews only buyers can write",
  "A community for your buyers, with spaces, posts, comments, moderation and live events members RSVP to",
  "Up to three prices on any product, bundles of 2 to 20 products, pay what you want, discount codes and payment plans",
  "15 currencies, and Apple Pay, Google Pay, Klarna and the other ways to pay you switch on in Stripe",
  "Offers before and after paying: a box at checkout, and up to five one-click offers after",
  "An affiliate program with a page for each affiliate, paid from your own PayPal in one press or on payday by itself",
  "Your own numbers counted without cookies, as CSV files too, and ad pixels for Meta, Google, TikTok and Pinterest — those are the platforms' own, and visitors are asked first where the law requires it",
  "License keys, stamped PDFs, course quizzes and certificates",
  "A private video room for each booking if you want one, and calendar sync for your calls",
  "Mailchimp, Kit, beehiiv or MailerLite built in, and webhooks for Zapier or Make",
  "A team of you plus up to five people per store, each with a role, and notifications of sales on your phone",
  "Sign-in without passwords, and a full refund that closes access by itself",
  "Free products that build an email list you can download",
  "Your list, products and past buyers brought over from another platform, from a spreadsheet",
  `Product descriptions and course outlines drafted with AI from your own words, ${AI_MONTHLY.creator} drafts a month (${AI_MONTHLY.trial} during the free trial)`,
];

const PRO_INCLUDED = [
  `Everything in ${PLAN_NAMES.creator}`,
  "One-off emails to your list, now or at a time you choose",
  "Sequences that go out by themselves after someone joins or buys",
  `Up to ${PRO_MONTHLY_EMAILS.toLocaleString("en-US")} emails a month (${TRIAL_MONTHLY_EMAILS.toLocaleString("en-US")} during the free trial), from your name, with replies coming to you`,
  "One-click unsubscribe in every email, honored for good",
  "Community announcements emailed to the members who asked for them, counted in the same monthly allowance",
  "One email that asks each buyer for a review, 3 to 30 days after buying",
  `The same AI drafting, with the monthly allowance raised from ${AI_MONTHLY.creator} to ${AI_MONTHLY.pro} drafts, and emails among the things it drafts`,
];

/*
 * A yearly price said as a monthly one, for comparing with the monthly plan.
 * It is never the number on the card — the card shows what is actually
 * charged, once a year — only the line underneath that does the division so
 * nobody has to.
 */
function monthlyEquivalent(yearCents: number): string {
  const perMonth = yearCents / 12 / 100;
  return Number.isInteger(perMonth) ? String(perMonth) : perMonth.toFixed(2);
}

function PlanCard({
  name,
  tag,
  bestFor,
  tier,
  perks,
  featured,
  cta,
  yearly,
}: {
  name: string;
  tag: string;
  bestFor: string;
  tier: "creator" | "pro";
  perks: string[];
  featured: boolean;
  cta: string;
  yearly: boolean;
}) {
  const { month, year } = PLAN_PRICES[tier];
  const saving = yearSaving(tier) / 100;
  return (
    <div
      className={`relative flex flex-col p-7 sm:p-9 ${
        featured
          ? "card border-violet-brand/35 shadow-[var(--shadow-md)] ring-1 ring-violet-brand/15"
          : "card-flat"
      }`}
    >
      {/*
        The recommended plan is marked once, in words that say why, and
        nothing else on this block tries to hurry anybody: no countdown, no
        "only today", no crossed-out price that was never charged.
      */}
      {featured ? (
        <span className="absolute -top-3 left-7 rounded-full bg-violet-brand px-3 py-1 text-[0.75rem] font-semibold text-white shadow-[var(--shadow-sm)] sm:left-9">
          Where to start
        </span>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-ink">{name}</p>
        <span className={`tag ${featured ? "tag-brand" : ""}`}>{tag}</span>
      </div>
      <p className="mt-2 text-[0.9375rem] text-ink-soft">{bestFor}</p>

      <p className="mt-6 flex items-baseline gap-2">
        <span className="text-[3.5rem] font-semibold leading-none tracking-[-0.05em] text-ink tabular-nums">
          ${yearly ? year / 100 : month / 100}
        </span>
        <span className="text-ink-mute">{yearly ? "a year" : "a month"}</span>
      </p>
      <p className="mt-2 min-h-[1.5rem] text-[0.9375rem] text-ink-soft">
        {yearly
          ? `Billed annually, in one payment. That works out at $${monthlyEquivalent(year)} a month \u2014 $${saving} less than twelve months at $${month / 100}.`
          : `Billed monthly. Or $${year / 100} a year in one payment \u2014 $${saving} less than twelve months.`}
      </p>

      {/*
        Six lines, then the rest behind a press.

        Eighteen ticks in a column made the two cards 4,156px of page
        between them, and a list that long is not read — it is scrolled
        past. The six that decide the purchase are open; the rest are one
        press away, in the same card, with nothing hidden from anyone who
        wants it.
      */}
      <ul className="mt-6 space-y-3">
        {perks.slice(0, 6).map((perk) => (
          <li key={perk} className="flex gap-3 text-ink-soft">
            <Icon name="check" size={18} strokeWidth={2.2} className="mt-1 shrink-0 text-mint-brand" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      {perks.length > 6 ? (
        <details className="group/perks mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[8px] text-sm font-semibold text-violet-deep [&::-webkit-details-marker]:hidden">
            <Icon name="plus" size={15} className="transition-transform duration-200 group-open/perks:rotate-45" />
            <span className="group-open/perks:hidden">{`${perks.length - 6} more in this plan`}</span>
            <span className="hidden group-open/perks:inline">Fewer</span>
          </summary>
          <ul className="mt-3 space-y-3">
            {perks.slice(6).map((perk) => (
              <li key={perk} className="flex gap-3 text-ink-soft">
                <Icon name="check" size={18} strokeWidth={2.2} className="mt-1 shrink-0 text-mint-brand" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="mt-auto pt-7">
        {/*
          The plan and the rhythm travel with the press.

          Both buttons used to go to a bare /signin, so somebody who had just
          read the Pro column and switched the whole page to yearly arrived at
          a page that showed no sign of either. Nothing is charged from here —
          the plan is chosen in the studio, after the store exists — but the
          choice is carried in the address so the next page can say it back,
          and so a creator never has to wonder whether it was heard.
        */}
        <Link
          href={`/signin?plan=${tier}&billing=${yearly ? "year" : "month"}`}
          className={`btn ${featured ? "btn-primary" : "btn-secondary"} btn-lg btn-block`}
        >
          {cta}
        </Link>
        {/* What the button does, before it is pressed. */}
        <p className="mt-3 text-center text-[0.8125rem] leading-relaxed text-ink-mute">
          {`Sends a login link to your email. Free for ${TRIAL_DAYS} days; your card is taken at the start and first charged $${
            yearly ? year / 100 : month / 100
          } ${yearly ? "a year" : "a month"} when the trial ends. Cancel in two clicks before then and it is never charged.`}
        </p>
      </div>
    </div>
  );
}

export function Pricing({ domains = false }: { domains?: boolean }) {
  const [yearly, setYearly] = useState(false);
  const proPerks = domains
    ? [...PRO_INCLUDED.slice(0, 1), "Your store on your own domain, with its certificate handled for you", ...PRO_INCLUDED.slice(1)]
    : PRO_INCLUDED;
  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="seg" role="group" aria-label="How often you pay">
          <button type="button" className="seg-item" aria-pressed={!yearly} onClick={() => setYearly(false)}>
            Monthly
          </button>
          <button type="button" className="seg-item" aria-pressed={yearly} onClick={() => setYearly(true)}>
            Yearly
            {/* What each plan saves is written inside that plan's own card,
                beside its own price. Here it is one number, the largest, so
                the switch says what it is for without doing the arithmetic of
                two plans at once in six words. */}
            <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[0.75rem] font-semibold text-mint-deep">
              {`save up to $${yearSaving("pro") / 100}`}
            </span>
          </button>
        </div>
        <p className="text-sm text-ink-mute">Both plans, both ways. Switch from your studio whenever you like.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <PlanCard
          name={PLAN_NAMES.creator}
          tag="Everything you need to sell"
          bestFor="For a creator opening a store and selling from it."
          tier="creator"
          perks={INCLUDED}
          featured
          cta="Start your store"
          yearly={yearly}
        />
        <PlanCard
          name={PLAN_NAMES.pro}
          tag={domains ? "Email and your own domain" : "With email to your list"}
          bestFor="For a creator with an email list to write to, and sell to again."
          tier="pro"
          perks={proPerks}
          featured={false}
          cta="Start on Pro"
          yearly={yearly}
        />
      </div>
      <CostAtVolume />
      <div className="card-flat mt-6 grid gap-4 p-6 text-sm sm:grid-cols-3 sm:p-7">
        <p className="flex gap-2 text-ink-soft">
          <Icon name="clock" size={18} className="mt-0.5 shrink-0 text-violet-deep" />
          <span>
            <strong className="font-semibold text-ink">{`Free for the first ${TRIAL_DAYS} days.`}</strong>
            {" Your card is taken when the trial starts and first charged when it ends. We email you a week before that, and canceling before it means your card is never charged. Cancel in two clicks from your studio. No email to us, no chat, no second request. The trial is for your first store; a second store is paid from day one."}
          </span>
        </p>
        <p className="flex gap-2 text-ink-soft">
          <Icon name="percent" size={18} className="mt-0.5 shrink-0 text-violet-deep" />
          <span>
            <strong className="font-semibold text-ink">0% of your sales.</strong> Stripe charges its own processing fee on
            your account.
          </span>
        </p>
        <p className="flex gap-2 text-ink-soft">
          <Icon name="download" size={18} className="mt-0.5 shrink-0 text-violet-deep" />
          <span>
            <strong className="font-semibold text-ink">200 GB of downloads a month.</strong> Stated here, not hidden in the
            terms, and nothing is cut off if you pass it. Move between the plans from your studio whenever you like.
          </span>
        </p>
      </div>
    </div>
  );
}

/*
 * What the platform takes as sales grow, worked out from published prices.
 * Card processing is left out because every option pays it, to Stripe.
 */
const AVERAGE_PRICE = 27;
const SALES_LEVELS = [20, 75, 370];
const GUMROAD_RATE = 0.1;
const GUMROAD_PER_SALE = 0.5;

function money(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function CostAtVolume() {
  const flat = PLAN_PRICES.creator.month / 100;
  return (
    <div className="card-flat mt-6 p-6 sm:p-7">
      <p className="font-semibold text-ink">What you pay as your sales grow</p>
      {/* This table is the monthly price on every row, whichever way the
          switch above it is set: paying yearly changes what each platform
          costs, and a comparison where one column quietly moved to a yearly
          rate would be worth nothing. */}
      <p className="mt-1 text-sm text-ink-soft">{`Each month, at a $${AVERAGE_PRICE} average price, comparing monthly billing on every platform. Card processing is not included: every option pays it on top.`}</p>
      {/*
        Four money columns do not fit a 320px screen, and a table that is cut
        off at the edge hides the column the whole comparison turns on. Above
        640px it stays a table, because that is what it is; below, each level
        of sales becomes its own small card with the three platforms listed
        under it, so nothing is clipped and nothing has to be scrolled
        sideways to be found.
      */}
      <table className="mt-4 hidden w-full text-left text-sm tabular-nums sm:table">
        <caption className="sr-only">What each platform takes each month at three levels of sales</caption>
        <thead>
          <tr className="text-ink-mute">
            <th scope="col" className="py-2 pr-2 font-semibold">Your sales</th>
            <th scope="col" className="px-2 py-2 font-semibold text-violet-deep">Marktmorgen</th>
            <th scope="col" className="px-2 py-2 font-semibold">Stan Creator</th>
            <th scope="col" className="py-2 pl-2 font-semibold">Gumroad</th>
          </tr>
        </thead>
        <tbody>
          {SALES_LEVELS.map((n) => {
            const revenue = n * AVERAGE_PRICE;
            const gumroad = revenue * GUMROAD_RATE + n * GUMROAD_PER_SALE;
            return (
              <tr key={n} className="border-t border-line">
                <th scope="row" className="py-2.5 pr-2 font-normal text-ink">
                  <span className="font-semibold">{money(revenue)}</span>
                  <span className="block text-xs text-ink-mute">{`${n} sales`}</span>
                </th>
                <td className="px-2 py-2.5 font-semibold text-violet-deep">{money(flat)}</td>
                <td className="px-2 py-2.5 text-ink">{money(flat)}</td>
                <td className="py-2.5 pl-2 text-ink">{money(gumroad)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="mt-4 grid gap-3 sm:hidden">
        {SALES_LEVELS.map((n) => {
          const revenue = n * AVERAGE_PRICE;
          const gumroad = revenue * GUMROAD_RATE + n * GUMROAD_PER_SALE;
          return (
            <li key={n} className="rounded-[var(--r-md)] border border-line p-4">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-ink tabular-nums">{money(revenue)}</span>
                <span className="text-xs text-ink-mute">{`${n} sales a month`}</span>
              </p>
              <dl className="mt-3 grid gap-1.5 border-t border-line pt-3 text-sm tabular-nums">
                {[
                  { k: "Marktmorgen", v: money(flat), ours: true },
                  { k: "Stan Creator", v: money(flat), ours: false },
                  { k: "Gumroad", v: money(gumroad), ours: false },
                ].map((r) => (
                  <div key={r.k} className="flex items-baseline justify-between gap-3">
                    <dt className={r.ours ? "font-semibold text-violet-deep" : "text-ink-soft"}>{r.k}</dt>
                    <dd className={r.ours ? "font-semibold text-violet-deep" : "text-ink"}>{r.v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-mute">
        {`Marktmorgen and Stan's Creator plan are both $${flat} a month with 0% of sales; Marktmorgen Pro and Stan's Creator Pro are both $${PLAN_PRICES.pro.month / 100}. Gumroad takes 10% plus 50 cents on a sale you bring yourself and has no monthly fee, so under about nine sales a month it costs less. Prices read on each company's own pricing page on September 20, 2026.`}
      </p>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-line border-y border-line">
      {HOME_QUESTIONS.map((item, i) => {
        const isOpen = open === i;
        return (
          <li key={item.q}>
            <h3>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen((cur) => (cur === i ? null : i))}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-[1.0625rem] font-semibold text-ink transition-colors hover:text-violet-deep sm:text-lg"
              >
                {item.q}
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-soft transition-transform duration-300 ${
                    isOpen ? "rotate-45 border-violet-brand text-violet-deep" : ""
                  }`}
                >
                  <Icon name="plus" size={16} />
                </span>
              </button>
            </h3>
            <div
              id={`faq-a-${i}`}
              role="region"
              aria-labelledby={`faq-q-${i}`}
              hidden={!isOpen}
              className="pb-6 pr-12"
            >
              <p className="text-ink-soft">{item.a}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/*
 * A window that opens the live demo store without leaving the page. Focus
 * moves into it, stays inside it while it is open, and returns to the button
 * that opened it. It is drawn straight into <body>, so no animated parent can
 * pin it inside a column.
 */
export function DemoWindow({
  label = "Try the live demo",
  className = "link-arrow on-dark",
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && dialog.current) {
        const items = dialog.current.querySelectorAll<HTMLElement>("button, a, iframe");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)} className={className}>
        {label}
        <Icon name="arrow-right" size={18} className="arrow" />
      </button>

      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-night/70 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-window-title"
            className="nb-pop flex h-[92dvh] w-full max-w-[26rem] flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[var(--shadow-lg)] sm:h-[min(52rem,90dvh)] sm:rounded-[20px]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <p id="demo-window-title" className="text-[0.9375rem] font-semibold text-ink">
                  Live demo store
                </p>
                <p className="text-[0.8125rem] text-ink-mute">Stripe test mode · card 4242 4242 4242 4242</p>
              </div>
              <div className="flex items-center gap-1">
                <Link href="/demo" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
                  Full page
                </Link>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  className="grid h-10 w-10 place-items-center rounded-[10px] text-ink-soft transition-colors hover:bg-sand hover:text-ink"
                >
                  <span className="sr-only">Close the demo</span>
                  <Icon name="close" size={20} />
                </button>
              </div>
            </div>
            <iframe src="/demo" title="Live demo store" className="w-full flex-1 border-0" />
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

/*
 * What people sell, running past.
 *
 * Every other thing on this page is still until somebody scrolls to it.
 * This one moves on its own, continuously, because a market does — and
 * because the fastest way to answer "is this for someone like me?" is to
 * show forty things people like them sell rather than describe a
 * category.
 *
 * Each item is a real kind of product the platform delivers today: a
 * file, a course, a membership, a booked call, a bundle. Nothing here is
 * a customer, a number or a claim — it is a list of what the thing does,
 * which is why it can run without a caveat under it.
 */
/*
 * Every item carries its own photograph.
 *
 * Stan's strip is type on a tile. Theirs works; a photograph of the thing
 * works harder, because "Sourdough courses" is a category and a loaf is a
 * reason. Each id below was looked up and confirmed to resolve, and each
 * is cropped square on faces so a person in the frame is never beheaded.
 *
 * The tint is the chip's own, drawn from the five lights of the page, so
 * the strip carries the whole palette past in one pass instead of
 * repeating one accent twenty-four times.
 */
const SOLD: { label: string; photo: string }[] = [
  { label: "Meal plans", photo: "photo-1580642682609-8b6ab251fbb7" },
  { label: "Lightroom presets", photo: "photo-1556910103-1c02745aae4d" },
  { label: "Sourdough courses", photo: "photo-1620545628446-6319bce6b95c" },
  { label: "Yoga programs", photo: "photo-1621111848501-8d3634f82336" },
  { label: "Sample packs", photo: "photo-1632494873717-d630cd5f2634" },
  { label: "Knitting patterns", photo: "photo-1574100004472-e536d3b6bacc" },
  { label: "1:1 coaching calls", photo: "photo-1592837613828-4b65deb44f15" },
  { label: "Study guides", photo: "photo-1519408469771-2586093c3f14" },
  { label: "Brush packs", photo: "photo-1561070791-2526d30994b5" },
  { label: "Membership communities", photo: "photo-1562577309-d67db487e6cd" },
  { label: "Watercolor classes", photo: "photo-1626785774573-4b799315345d" },
  { label: "Resume reviews", photo: "photo-1637270873552-80d3bb9569dd" },
  { label: "Pottery classes", photo: "photo-1606787503066-794bb59c64bc" },
  { label: "Lesson plans", photo: "photo-1603201667246-3c45012c6d17" },
  { label: "Portfolio critiques", photo: "photo-1534670007418-fbb7f6cf32c3" },
  { label: "Running plans", photo: "photo-1636647511729-6703539ba71f" },
  { label: "Chord charts", photo: "photo-1761628332000-9da4f810183e" },
  { label: "Lettering classes", photo: "photo-1613579917953-d35e6b72d32b" },
  { label: "Recipe packs", photo: "photo-1528712306091-ed0763094c98" },
  { label: "Business templates", photo: "photo-1537861295351-76bb831ece99" },
  { label: "Breathwork sessions", photo: "photo-1556911220-e15b29be8c8f" },
  { label: "Font bundles", photo: "photo-1653233797467-1a528819fd4f" },
  { label: "Wedding checklists", photo: "photo-1518737003272-dac7c4760d5e" },
  { label: "Garden guides", photo: "photo-1556911073-a517e752729c" },
];

const TINTS = ["#ff7a59", "#15a37a", "#ffcf4d", "#5a36ee", "#e8456b"];

export function SoldMarquee() {
  // Two copies of the list: the track travels exactly half its width, so
  // the second copy is under the cursor the instant the first leaves.
  const row = [...SOLD, ...SOLD];
  return (
    <div className="marquee py-1" aria-hidden="true">
      <ul className="marquee-track">
        {row.map((item, i) => (
          <li
            key={`${item.label}-${i}`}
            className="flex shrink-0 items-center gap-3 rounded-full bg-white/85 py-1.5 pl-1.5 pr-5 text-[0.9375rem] font-medium text-ink shadow-[inset_0_0_0_1px_rgba(42,23,144,0.09),0_8px_20px_-12px_rgba(42,23,144,0.3)]"
          >
            <img
              src={FACE(item.photo, 96)}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-10 w-10 shrink-0 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${TINTS[i % TINTS.length]}55` }}
            />
            <span className="whitespace-nowrap">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
