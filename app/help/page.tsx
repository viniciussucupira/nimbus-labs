import type { Metadata } from "next";
import Link from "next/link";
import { RevealOnScroll } from "@/components/home-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Help centre — Nimbus Labs",
  description:
    "Straight answers about the store, the money, the files and what the subscription buys. If an answer is 'not yet', it says not yet.",
};

type Section = {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  tone: string;
  items: { q: string; a: string[] }[];
};

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    emoji: "🚀",
    title: "Getting started",
    blurb: "What Nimbus is right now, and what it costs to start.",
    tone: "bg-lilac",
    items: [
      {
        q: "What is Nimbus today?",
        a: [
          "You sign up, take your own store address and build the page: its name, its description, and what you sell with its price. You connect your own Stripe account, and once Stripe has cleared it your page can take a card. The money is charged on your account, not ours.",
          "You can see the whole path before signing up. The demo store has price options on a product, a Stripe checkout made on the creator account, and the file delivered the second the payment clears. You can buy from it with a test card.",
          "The mission page lists everything that is built and everything that is not, in two columns, so nobody signs up expecting the wrong thing.",
        ],
      },
      {
        q: "Can I put my own products on my store?",
        a: [
          "Yes. On your account page you write the name of the store, the line under it, and each thing you sell with what the buyer gets and the price. It is on your page the moment you save it, and you can reorder or remove any of it.",
          "A store holds up to twenty things, each with one price in US dollars. You can also put the file itself on each one, and open it again to check it is the right one.",
          "Your page can take a card as soon as two things are true: Stripe has cleared your connected account, and your subscription is running — the trial counts. Until then the page says so plainly, to you and to anyone who opens it.",
        ],
      },
      {
        q: "What file can I sell, and how big?",
        a: [
          "Up to 5 GB, in any of these: PDF, ePub, ZIP, PNG, JPG, GIF, WebP, SVG, MP3, WAV, M4A, MP4, MOV, TXT, CSV, Markdown, Word, Excel and PowerPoint. Anything over about 20 MB is uploaded in parts, so a dropped connection costs you one part rather than the whole thing.",
          "Bigger than that, or not a file at all? Sell it as a link. You paste an https address \u2014 a Google Drive folder, a private video page, a Notion page \u2014 and the buyer is sent there the moment they pay, with the address shown on the page and kept in their receipt. There is no size limit on that, because the files stay where you already keep them.",
          "A product carries one or the other, never both, so a buyer who has paid is shown one thing to open rather than a choice.",
          "Anything that runs — a program, an installer, a script — is refused. A store that hands out software is a store that hands out malware the day an account is taken over.",
          "The file goes straight from your browser to storage that needs a key to read. It is never named or linked on your public page, and the only way it comes out is through us, after we have checked who is asking. You can open it yourself from your account page to be sure it is the right one.",
        ],
      },
      {
        q: "What does it cost to start?",
        a: [
          "Nothing to sign up. Your store address, your page, the editor and connecting Stripe are free and stay free.",
          "What the $29 monthly subscription switches on is the till: your page taking a card. The first 14 days of it are free and no card is asked for to begin, so you can put a product up and make a sale before you decide whether it is worth paying for.",
        ],
      },
      {
        q: "What will it cost?",
        a: [
          "One monthly subscription, and 0% of your sales. The card fee your payment processor charges is paid to them, on your own account, and we never take a cut on top of it.",
          "The price is published on the home page. If it ever changes, existing subscribers are told before it applies to them.",
        ],
      },
      {
        q: "Is it open, or is this a waiting list?",
        a: [
          "Open. You can take an address and be selling the same day.",
          "It is also young, and the mission page lists what is built and what is not, in two columns, so you can see what you are signing up to before you do. That page is updated the day something new actually works, not the day it is planned.",
        ],
      },
    ],
  },
  {
    id: "demo-store",
    emoji: "🧪",
    title: "The demo store",
    blurb: "How to test a real checkout without spending anything.",
    tone: "bg-cream",
    items: [
      {
        q: "How do I try it?",
        a: [
          "Open the demo store, pick a price option and pay with the Stripe test card 4242 4242 4242 4242, any future expiry date, any three digits for the security code and any postcode.",
          "The checkout is a real Stripe checkout running in test mode. No real money moves, and no real card is ever charged.",
        ],
      },
      {
        q: "Is the file real?",
        a: [
          "Yes. The sample planner is a real PDF, and the page delivers the file that matches the option you paid for — the one-week file for the one-week price, the five-week file for the five-week price.",
        ],
      },
      {
        q: "Can I put my own file in it?",
        a: [
          "Not in the public demo, which is a fixed sample everyone shares. Your own store is where your file goes: take an address, upload it, and the page and the file are yours.",
        ],
      },
    ],
  },
  {
    id: "money",
    emoji: "💳",
    title: "Money, fees and payouts",
    blurb: "Who charges the buyer, who holds the money, and when you get it.",
    tone: "bg-mint-brand/12",
    items: [
      {
        q: "Whose account is the buyer charged on?",
        a: [
          "Yours. You connect your own Stripe account and the charge is made on it directly. The receipt and the line on your buyer's card statement carry your business name, not ours.",
        ],
      },
      {
        q: "What does Nimbus take from a sale?",
        a: [
          "Nothing. 0% of your sales, with no asterisk. Our only income is the monthly subscription.",
          "Stripe charges its own processing fee on each payment, published on Stripe's own pricing page, and that is taken on your account by Stripe.",
        ],
      },
      {
        q: "When am I paid?",
        a: [
          "On your own Stripe payout schedule, which you set in your own Stripe dashboard. We never hold a balance for you, so there is nothing for us to release.",
        ],
      },
      {
        q: "Can my buyers pay with PayPal?",
        a: [
          "No. Nimbus runs on Stripe and only Stripe. Stan and Beacons both let you take PayPal as well, and on this one we are behind them.",
          "The reason is not laziness. Stripe's own documentation says PayPal through Stripe is not available to platforms that onboard other businesses to accept payments directly, which is exactly what we are. The other road is a second, separate integration with PayPal, and a second integration means a second checkout, a second refund path and a second dispute queue to keep working. We would rather have one that never breaks than two that sometimes do.",
          "Two things follow from that, and you should know them before you sign up. You need a Stripe account, in a country Stripe operates in — which covers the United States, Canada, the United Kingdom and the European Union, but not everywhere. And a buyer who has only a PayPal balance and no card cannot buy from you here.",
        ],
      },
      {
        q: "Who handles refunds and disputes?",
        a: [
          "You do, in your own Stripe dashboard, with the same tools any business has. Because the charge was made on your account, a refund is a refund you issue, not a request you file with us.",
        ],
      },
      {
        q: "What about refunds on the Nimbus subscription itself?",
        a: [
          "Ask within 14 days of a charge and we refund that charge in full, including renewals. You can cancel at any time and keep access until the end of the period you already paid for. The refund policy page has the exact wording.",
        ],
      },
    ],
  },
  {
    id: "your-store",
    emoji: "🏪",
    title: "Your store",
    blurb: "What it can hold today, and what it cannot.",
    tone: "bg-sky-brand/12",
    items: [
      {
        q: "Is there a limit on how much my buyers download?",
        a: [
          "Your plan covers 200 GB of downloads a month for your store. Your account page shows what you have sent out so far, counted from the moment each download starts.",
          "If you go past it, nothing is cut off. Somebody paid you for that file and they get it — we are not going to take a sale and then break it to protect our own bill. We write to you instead, and we work it out.",
          "To put the number in scale: 200 GB is two hundred copies of a one-gigabyte course, or forty thousand copies of a five-megabyte guide, in a single month.",
        ],
      },
      {
        q: "What can I sell?",
        a: [
          "Digital files — one price each — and memberships that charge on a schedule. What is too big to upload, or is not a file at all, is sold as a link to where it already lives.",
          "Your page also holds links that are not for sale, with no price and no checkout on them: the channel, the podcast, the profile, the booking page you already pay someone else for.",
          "One thing the demo store has that your own editor does not yet: several prices on the same product. It is real and it runs in production there, and building the same into your editor is not done. Until it is, that is two products rather than one.",
        ],
      },
      {
        q: "Can I sell a membership?",
        a: [
          "Yes. Any product can charge on a schedule instead of once: daily, weekly, monthly or yearly. The subscription is created on your own Stripe account, like every other charge here, so the member is your customer, in your dashboard, and the renewals are 0% to us as well.",
          "Two things it does not do yet, said plainly. A membership runs until the member cancels \u2014 you cannot set it to stop after six payments. And it does not take access back when somebody stops paying: if what you deliver is a link, that link keeps working, so remove them wherever you actually keep the thing. Your Stripe dashboard is where you see who is still paying.",
        ],
      },
      {
        q: "Can I sell courses or a community?",
        a: [
          "Not yet. Lessons with progress, communities, scheduled calls, webinars, email automations and an affiliate programme are not built. Platforms that have them today are the better choice if you need them today, and our comparison page says so.",
        ],
      },
      {
        q: "Does it work on a phone?",
        a: [
          "That is the case it is designed for. The store installs to the home screen with its own icon on both iPhone and Android, straight from the browser, with no app to download — for you or for your buyers.",
        ],
      },
      {
        q: "Can I use my own domain?",
        a: [
          "Not yet. It is on the list, and this page will say so on the day it works.",
        ],
      },
      {
        q: "Can I change my store address later?",
        a: [
          "Yes, whenever you want, from your own account page. Nobody has to be asked and there is nothing to wait for.",
          "Your store does not move: same page, same name, same description, same products. Only the address changes.",
          "Every address your store has ever used keeps working and sends people to the current one, so the link already in your bio, in old posts and in messages other people sent never breaks. A store holds up to ten addresses, and you can hand one back if you are sure it was never given to anyone.",
        ],
      },
    ],
  },
  {
    id: "delivery",
    emoji: "📦",
    title: "Files and delivery",
    blurb: "What happens in the seconds after someone pays.",
    tone: "bg-pink-brand/10",
    items: [
      {
        q: "How does the buyer get the file?",
        a: [
          "On the screen, immediately after Stripe confirms the payment. There is no waiting for an email to arrive before they can open what they bought.",
        ],
      },
      {
        q: "Does the download link expire?",
        a: [
          "Yes. The link works for a limited window and is tied to that order, so a link that leaks does not turn into a free copy for everyone.",
          "A buyer who loses it does not lose what they paid for: they type the address they paid with and the link is sent there again. No account, no password. It is working on the demo store today, at nimbuslabsai.com/demo/recover.",
        ],
      },
      {
        q: "A buyer says the file never arrived. What now?",
        a: [
          "Send them to the page that sends the link again — they type the address they paid with and it arrives in their inbox. That answers most of these without you doing anything.",
          "If it still does not appear, check the payment in your own Stripe dashboard: a payment that did not complete is the most common cause. If Stripe shows the payment succeeded and the file still did not arrive, email us with the order details and we will look at it with you.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    emoji: "🔒",
    title: "Your data",
    blurb: "What we keep, and how to have it removed.",
    tone: "bg-amber-brand/12",
    items: [
      {
        q: "What do you store about me?",
        a: [
          "For your store: the email address that signs you in, the store you build, and the Stripe account id you connect. For the research form: what you typed in it and, if you ticked the box, your email address. The privacy page lists it in full.",
        ],
      },
      {
        q: "Can I have it deleted?",
        a: [
          "Yes. Email us from the address you used and we remove it. You do not have to give a reason.",
        ],
      },
      {
        q: "Do you sell or share it?",
        a: ["No. Not with anyone, for any price."],
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <RevealOnScroll />
      <SiteNav />

      <main id="content" className="flex-1">
        {/* ---------------- hero ---------------- */}
        <section className="nb-mesh nb-grain relative overflow-hidden text-white">
          <div
            aria-hidden="true"
            className="nb-blob absolute -left-20 top-0 h-72 w-72 bg-mint-brand/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="nb-blob absolute -right-20 bottom-0 h-72 w-72 bg-violet-brand/35 blur-3xl"
          />
          <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <span aria-hidden="true">💬</span> Help centre
            </p>
            <h1 className="font-display mt-5 text-4xl font-black leading-[1.05] sm:text-6xl">
              How can we <span className="nb-gradient-text">help you?</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
              Every answer here is about the product as it is today. Where the
              answer is &ldquo;not yet&rdquo;, it says not yet.
            </p>

            <nav
              aria-label="Help sections"
              className="mt-9 flex flex-wrap justify-center gap-2"
            >
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur transition hover:bg-white hover:text-violet-deep"
                >
                  <span aria-hidden="true">{section.emoji}</span>{" "}
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* ---------------- sections ---------------- */}
        <div className="mx-auto max-w-4xl space-y-14 px-4 py-16">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="reveal scroll-mt-28"
            >
              <div
                className={`rounded-3xl ${section.tone} px-7 py-6 shadow-[0_14px_36px_rgba(20,15,61,0.06)]`}
              >
                <h2 className="font-display flex items-center gap-3 text-2xl font-black text-ink sm:text-3xl">
                  <span aria-hidden="true">{section.emoji}</span>
                  {section.title}
                </h2>
                <p className="mt-2 text-ink-soft">{section.blurb}</p>
              </div>

              <div className="mt-5 space-y-3">
                {section.items.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-2xl border-2 border-ink/8 bg-white px-6 py-5 shadow-sm transition open:border-violet-brand/40 open:shadow-md"
                  >
                    <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black text-ink marker:content-none">
                      {item.q}
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-2xl font-black text-violet-brand transition group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    {item.a.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="mt-4 leading-relaxed text-ink-soft"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ---------------- contact ---------------- */}
        <section className="px-4 pb-20">
          <div className="reveal mx-auto max-w-4xl rounded-[2rem] bg-ink p-10 text-center text-white">
            <h2 className="font-display text-3xl font-black sm:text-4xl">
              Still stuck?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Write to us. A person reads it, and you will get an answer even if
              the answer is that we have not built that part yet.
            </p>
            <a
              href="mailto:viniciussucupira091@gmail.com"
              className="mt-7 inline-block rounded-full bg-white px-7 py-3.5 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5"
            >
              viniciussucupira091@gmail.com
            </a>
            <p className="mt-6 text-sm text-white/60">
              Looking for the rules instead?{" "}
              <Link href="/terms" className="underline underline-offset-4">
                Terms
              </Link>
              ,{" "}
              <Link href="/privacy" className="underline underline-offset-4">
                Privacy
              </Link>{" "}
              and{" "}
              <Link href="/refunds" className="underline underline-offset-4">
                Refunds
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
