"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { PRICE_CENTS, TRIAL_DAYS } from "@/lib/plan";

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

export function HeroFlow() {
  const [played, setPlayed] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
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

  const choose = (i: number) => setChosen(i);

  const paying = step === 1;
  const paid = step === 2;

  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div className="relative h-[30rem] sm:h-[31rem]">
        {/* soft light behind the devices */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.45),transparent)] blur-2xl"
        />

        {/* the store, on a phone */}
        <div className="absolute left-1/2 top-0 w-[16.5rem] -translate-x-1/2 sm:left-[2%] sm:w-[58%] sm:max-w-[17rem] sm:translate-x-0">
          <div className="rounded-[2.1rem] bg-[#0a0820] p-[7px] shadow-[var(--shadow-device)] ring-1 ring-white/10">
            <div className="overflow-hidden rounded-[1.7rem] bg-paper">
              <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[10px] font-semibold text-ink-mute">
                <span>9:41</span>
                <span className="rounded-[5px] bg-white px-1.5 py-0.5 text-[9px] text-ink-soft ring-1 ring-line">
                  nimbuslabsai.com/demo
                </span>
              </div>
              <div className="px-3.5 pb-4 pt-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src="https://images.unsplash.com/photo-1543871595-e11129e271cc?auto=format&fit=crop&crop=faces&w=96&h=96&q=70"
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full bg-sand-deep object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight text-ink">Harbor Kitchen</p>
                    <p className="text-[10.5px] text-ink-mute">Simple family meals by Jenny</p>
                  </div>
                </div>
                <div className="mt-3 rounded-[12px] border border-line bg-white p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-deep">
                    Weekly meal planner
                  </p>
                  <div className="mt-2 grid gap-1.5">
                    <div className="flex items-center justify-between rounded-[9px] border border-line px-2.5 py-2 text-[11.5px]">
                      <span className="text-ink-soft">1 week</span>
                      <span className="font-semibold text-ink">$27</span>
                    </div>
                    <div
                      className={`flex items-center justify-between rounded-[9px] border px-2.5 py-2 text-[11.5px] transition-colors duration-500 ${
                        step === 0 ? "border-violet-brand bg-lilac" : "border-violet-brand/50 bg-lilac/60"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium text-ink">
                        <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-violet-brand text-white">
                          <Icon name="check" size={9} strokeWidth={3} />
                        </span>
                        5 weeks
                      </span>
                      <span className="font-semibold text-ink">$39</span>
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
                  {["Free recipe of the week", "About Jenny"].map((l) => (
                    <p key={l} className="rounded-[9px] border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink-soft">
                      {l}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* the Stripe checkout */}
        <div
          className={`absolute left-1/2 top-[34%] w-[17rem] -translate-x-1/2 transition-all duration-700 [transition-timing-function:var(--ease)] sm:left-auto sm:right-0 sm:top-[9%] sm:w-[56%] sm:max-w-[16.5rem] sm:translate-x-0 ${
            step === 1 ? "translate-y-0 opacity-100" : "max-sm:pointer-events-none max-sm:translate-y-6 max-sm:opacity-0"
          } ${step === 0 ? "sm:translate-y-3 sm:opacity-60" : "sm:translate-y-0 sm:opacity-100"}`}
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

        {/* delivered, and where the money went */}
        <div
          className={`absolute bottom-[4%] left-1/2 w-[18rem] -translate-x-1/2 transition-all duration-700 [transition-timing-function:var(--ease)] sm:bottom-[5%] sm:left-auto sm:right-[2%] sm:w-[64%] sm:max-w-[19rem] sm:translate-x-0 ${
            paid ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
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
          <div className="mt-2 flex items-center justify-between gap-2 rounded-[12px] bg-[#0a0820] px-3 py-2 text-[11px] text-white ring-1 ring-white/10">
            <span className="flex items-center gap-1.5 text-white/80">
              <Icon name="bank" size={14} /> Your Stripe account
            </span>
            <span className="font-semibold">+$39.00 · Nimbus fee $0</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center" role="group" aria-label="Steps of a sale">
        <ol className="flex items-center gap-1 rounded-[12px] bg-white/[0.06] p-1 ring-1 ring-white/10">
          {FLOW.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => choose(i)}
                aria-pressed={step === i}
                className={`flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition-colors ${
                  step === i ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${
                    step === i ? "bg-violet-brand text-white" : "bg-white/12 text-white/80"
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
 * One plan, and every line under it is something you can open and try today.
 * A price with a feature beside it is a promise; a promise we cannot keep is
 * worse than a shorter list. There is no yearly price here because billing
 * only ever opens a monthly subscription.
 */
const INCLUDED = [
  "Your own store address, live the moment you take it",
  "Buyers pay into your own Stripe account",
  "The file delivered the second the payment clears",
  "Up to three prices on any product, and discount codes",
  "Memberships billed every week, month or year",
  "Free products that build an email list you can download",
  "What you have sold, read from your own Stripe account",
];

export function Pricing() {
  const price = PRICE_CENTS / 100;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-stretch">
      <div className="card relative overflow-hidden p-7 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-semibold text-ink">Nimbus</p>
          <span className="tag tag-brand">One plan, everything included</span>
        </div>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="text-[3.5rem] font-semibold leading-none tracking-[-0.05em] text-ink">${price}</span>
          <span className="text-ink-mute">per month</span>
        </p>
        <p className="mt-3 text-ink-soft">
          {`Free for the first ${TRIAL_DAYS} days. Cancel in one click before they end and your card is never charged.`}
        </p>
        <Link href="/signin" className="btn btn-primary btn-lg btn-block mt-7">
          Start your store
        </Link>
        <p className="mt-3 text-center text-sm text-ink-mute">
          Cancel in one click from your studio. No email to us, no chat, no second request.
        </p>
      </div>

      <div className="card-flat p-7 sm:p-9">
        <p className="font-semibold text-ink">What the plan includes</p>
        <ul className="mt-5 space-y-3">
          {INCLUDED.map((perk) => (
            <li key={perk} className="flex gap-3 text-ink-soft">
              <Icon name="check" size={18} strokeWidth={2.2} className="mt-1 shrink-0 text-mint-brand" />
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-2">
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
              terms.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* Straight answers. */
const QUESTIONS = [
  {
    q: "Can I sign up and start selling today?",
    a: `Yes. You take your store address, connect your own Stripe account and put up what you sell; a buyer can pay for it on your account, with nothing taken on top. The address, the page, the editor and connecting Stripe cost nothing. The $${PRICE_CENTS / 100} subscription switches on the till — selling, and giving things away for an email address — and its first ${TRIAL_DAYS} days are free, so you can make a sale before you decide.`,
  },
  {
    q: "Who holds the money from my sales?",
    a: "You do. Payments go to your own Stripe account through direct charges, so payouts follow your Stripe settings and we never sit between you and your buyer's money. We charge a monthly subscription and take 0% of your sales.",
  },
  {
    q: "What happens if Nimbus Labs disappears?",
    a: "Your Stripe account, your customers and your payouts stay yours, because they were never held by us. Your email list downloads as a file at any time, and a shutdown would come with notice in writing.",
  },
  {
    q: "What does Stan have that Nimbus does not, yet?",
    a: "Among other things: a course builder, email broadcasts and payment plans. Every one is listed by name on the feature-by-feature page, with where we stand on it, and nothing is advertised here before it exists.",
  },
  {
    q: "Who is behind this?",
    a: "Vinicius Sucupira, an independent builder working in public. Support is in English, in writing, and a person answers it.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-line border-y border-line">
      {QUESTIONS.map((item, i) => {
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
