"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PRICE_CENTS, TRIAL_DAYS } from "@/lib/plan";

/* Reveals every element with .reveal as it scrolls into view. */
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return null;
}

/* The phone in the hero: shows the real flow of the demo store. */
const STEPS = [
  { key: "pick", label: "Pick a plan" },
  { key: "pay", label: "Pay with card" },
  { key: "get", label: "File delivered" },
] as const;

export function StoreMock() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const t = setTimeout(() => setStep((s) => (s + 1) % 3), 2600);
    return () => clearTimeout(t);
  }, [step, paused]);

  return (
    <div
      className="relative mx-auto w-full max-w-[320px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="rounded-[2.6rem] border-[10px] border-ink bg-ink p-1 shadow-2xl shadow-violet-deep/40">
        <div className="relative overflow-hidden rounded-[2rem] bg-cream">
          <div className="flex items-center justify-between bg-white px-4 py-2 text-[10px] font-semibold text-ink-soft">
            <span>9:41</span>
            <span className="rounded-full bg-mint-brand/20 px-2 py-0.5 text-mint-deep">
              harborkitchen.store
            </span>
          </div>

          <div className="px-4 pb-5 pt-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-mint-brand to-sky-brand text-lg font-bold text-white"
              >
                HK
              </span>
              <div>
                <p className="font-display text-sm font-extrabold text-ink">
                  Harbor Kitchen
                </p>
                <p className="text-[11px] text-ink-soft">
                  Simple family meals by Jenny
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-pink-brand">
                Weekly meal planner
              </p>

              <div className="mt-2 grid gap-2">
                <div
                  className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 text-[12px] transition ${
                    step === 0
                      ? "border-violet-brand bg-lilac"
                      : "border-ink/10 bg-white"
                  }`}
                >
                  <span className="font-semibold text-ink">1 week</span>
                  <span className="font-bold text-ink">$27</span>
                </div>
                <div
                  className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 text-[12px] transition ${
                    step > 0
                      ? "border-violet-brand bg-lilac"
                      : "border-ink/10 bg-white"
                  }`}
                >
                  <span className="font-semibold text-ink">5 weeks</span>
                  <span className="font-bold text-ink">$39</span>
                </div>
              </div>

              <div
                className={`mt-3 rounded-xl px-3 py-2 text-center text-[12px] font-bold text-white transition ${
                  step === 1
                    ? "bg-ink"
                    : "bg-gradient-to-r from-violet-brand to-pink-brand"
                }`}
              >
                {step === 1 ? "Paying…" : "Continue to checkout"}
              </div>
            </div>

            {step === 2 && (
              <div className="nb-pop mt-3 rounded-2xl border-2 border-mint-brand/40 bg-white p-3">
                <p className="text-[11px] font-bold text-mint-deep">
                  Payment confirmed
                </p>
                <p className="text-[12px] font-semibold text-ink">
                  meal-planner-5-weeks.pdf
                </p>
                <p className="text-[11px] text-ink-soft">
                  Download link works for 3 days.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ol className="mt-4 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                step === i
                  ? "bg-white text-violet-deep shadow"
                  : "bg-white/15 text-white/80 hover:bg-white/25"
              }`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/*
 * One plan, and every line under it is something you can open and try today.
 *
 * There was a second plan here, at $99, and it listed memberships, buy now
 * pay later and a priority support tier. None of the three exist in this
 * codebase. A price with a feature beside it is a promise, and a promise we
 * cannot keep is worse than a shorter list, so the list got shorter.
 *
 * There was also a monthly / yearly switch, and the yearly side of it showed
 * $300 a year. Billing only ever opens a monthly subscription, so the yearly
 * price was a number nobody could actually pay. The switch is gone until the
 * code behind it exists; a price you cannot buy is the same kind of lie as a
 * feature you cannot use.
 */
const PLAN = {
  name: "Starter",
  monthly: PRICE_CENTS / 100,
  accent: "from-violet-brand to-sky-brand",
  tagline: "One store, everything you need to sell a file.",
  perks: [
    "Your own store address, live the moment you take it",
    "Your buyer pays into your own Stripe account",
    "The file delivered the second the payment clears",
    "What you have sold, read from your own Stripe account",
    "200 GB of downloads a month, and we say so instead of hiding it",
    "0% cut of your sales",
  ],
};

/**
 * The price and the trial are imported rather than typed in, so this card and
 * the checkout a creator actually lands on cannot drift apart. lib/plan.ts
 * holds no secrets, which is what makes it safe to import from a component
 * that runs in the browser.
 */
export function Pricing() {
  return (
    <div className="mx-auto mt-2 grid max-w-md gap-6">
      <div className="nb-lift reveal relative overflow-hidden rounded-3xl border-2 border-ink/10 bg-white p-7 shadow-xl shadow-ink/5">
        <div
          aria-hidden="true"
          className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${PLAN.accent} opacity-20 blur-2xl`}
        />
        <p className="font-display text-xl font-extrabold text-ink">
          {PLAN.name}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{PLAN.tagline}</p>
        <p className="mt-5 flex items-end gap-1">
          <span className="font-display text-5xl font-black text-ink">
            ${PLAN.monthly}
          </span>
          <span className="pb-2 text-sm font-semibold text-ink-soft">
            per month
          </span>
        </p>
        <p className="mt-3 rounded-2xl bg-mint-brand/12 px-4 py-2.5 text-sm font-semibold text-mint-deep">
          {`Free for the first ${TRIAL_DAYS} days. No card until then.`}
        </p>
        <ul className="mt-6 space-y-2 text-sm text-ink">
          {PLAN.perks.map((perk) => (
            <li key={perk} className="flex gap-2">
              <span aria-hidden="true" className="text-mint-deep">
                ✔
              </span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/signin"
          className={`mt-7 block rounded-full bg-gradient-to-r ${PLAN.accent} px-5 py-3 text-center font-bold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand`}
        >
          Start your store
        </Link>
        <p className="mt-4 text-center text-xs text-ink-soft">
          Cancel from the receipt Stripe emails you. There is no cancel button
          hidden behind a conversation with us.
        </p>
      </div>
    </div>
  );
}

/* Straight answers. */
const QUESTIONS = [
  {
    q: "Can I sign up and start selling today?",
    a: `Yes. You take your store address, connect your own Stripe account, put up what you sell, and a buyer can pay for it — on your account, with nothing taken on top. The address, the page, the editor and connecting Stripe are free. What the $${PRICE_CENTS / 100} subscription switches on is the till, and the first ${TRIAL_DAYS} days of it are free, so you can sell before you decide whether it is worth paying for.`,
  },
  {
    q: "Who holds the money from my sales?",
    a: "You do. Payments go to your own Stripe account through direct charges, so payouts follow your Stripe settings and we never sit between you and your buyer's money. We charge a monthly subscription and take 0% of your sales.",
  },
  {
    q: "What happens if Nimbus Labs disappears?",
    a: "Your Stripe account, your customers and your files stay yours, because they were never held by us. Anything we host for you can be exported, and a shutdown would come with notice in writing.",
  },
  {
    q: "Who is behind this?",
    a: "Vinicius Sucupira, an independent builder working in public. Support is in English, in writing, with a response time we publish rather than promise loosely.",
  },
  {
    q: "Why is the demo store so bare?",
    a: "It is a working proof, not a portfolio piece: a fictional cook, two price options, a real Stripe checkout and a real file delivered. Your own store is designed with you.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="space-y-3">
      {QUESTIONS.map((item, i) => (
        <li
          key={item.q}
          className="reveal overflow-hidden rounded-3xl border-2 border-ink/10 bg-white"
        >
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen((cur) => (cur === i ? null : i))}
            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-display text-lg font-bold text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
          >
            {item.q}
            <span
              aria-hidden="true"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lilac text-violet-deep transition-transform ${
                open === i ? "rotate-45" : ""
              }`}
            >
              +
            </span>
          </button>
          {open === i && (
            <p className="px-6 pb-6 text-ink-soft">{item.a}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/* A window that opens the live demo store without leaving the page. */
export function DemoWindow() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border-2 border-white/70 px-6 py-3 font-bold text-white transition hover:bg-white hover:text-violet-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Open the store in a window
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Live demo store"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4 backdrop-blur"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="nb-pop flex h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white">
              <p className="font-display text-sm font-bold">
                Live demo store — test mode
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Close ✕
              </button>
            </div>
            <iframe
              src="/demo"
              title="Live demo store"
              className="h-full w-full flex-1 border-0"
            />
          </div>
        </div>
      )}
    </>
  );
}
