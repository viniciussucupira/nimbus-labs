import Link from "next/link";
import { InstallApp } from "@/components/install-app";

const PHOTO = (id: string, w: number, h: number, faces = true) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop${faces ? "&crop=faces" : ""}&w=${w}&h=${h}&q=65`;

const JENNY = "photo-1662850886700-4ec19bd30d11";
const FOOD = "photo-1535473895227-bdecb20fb157";

function Phone({
  label,
  caption,
  tilt,
  children,
}: {
  label: string;
  caption: string;
  tilt: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={`shrink-0 snap-center ${tilt}`}>
      <div className="w-[248px] rounded-[2.4rem] border-[9px] border-ink bg-ink p-1 shadow-2xl shadow-violet-deep/30">
        <div className="relative h-[470px] overflow-hidden rounded-[1.9rem] bg-cream">
          <div className="flex items-center justify-between bg-white px-3 py-1.5 text-[9px] font-semibold text-ink-soft">
            <span>9:41</span>
            <span className="rounded-full bg-mint-brand/20 px-2 py-0.5 text-mint-deep">
              harborkitchen.store
            </span>
          </div>
          {children}
        </div>
      </div>
      <figcaption className="mt-4 w-[248px] text-center">
        <span className="font-display block text-sm font-black text-white">
          {label}
        </span>
        <span className="mt-1 block text-[13px] text-white/70">{caption}</span>
      </figcaption>
    </figure>
  );
}

export function PhoneScreens() {
  return (
    <section
      id="screens"
      className="nb-mesh nb-grain relative scroll-mt-28 overflow-hidden py-20 text-white"
    >
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-24 top-10 h-72 w-72 bg-violet-brand/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-20 bottom-10 h-72 w-72 bg-pink-brand/30 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4">
        <div className="reveal max-w-2xl">
          <p className="font-semibold uppercase tracking-[0.2em] text-amber-brand">
            Every screen
          </p>
          <h2 className="font-display mt-3 text-3xl font-black sm:text-4xl">
            This is the whole journey, on a phone
          </h2>
          <p className="mt-4 text-white/80">
            Not a mock-up made in a design tool: these are the real screens of
            the live demo store, the ones your buyer sees between the link in
            your bio and the file in their hands.
          </p>
        </div>

        <div className="nb-no-scrollbar reveal -mx-4 mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4">
          {/* 1 — the store */}
          <Phone
            label="1. Your store"
            caption="The demo store: a face, links and products."
            tilt="lg:-rotate-2"
          >
            <div className="relative">
              <img
                src={PHOTO(FOOD, 400, 144, false)}
                alt=""
                aria-hidden="true"
                width={400}
                height={144}
                loading="lazy"
                className="h-20 w-full object-cover"
              />
              <div className="px-4 pb-4 text-center">
                <img
                  src={PHOTO(JENNY, 112, 112)}
                  alt="Jenny, the fictional cook of the demo store"
                  width={112}
                  height={112}
                  loading="lazy"
                  className="-mt-7 inline-block h-14 w-14 rounded-full object-cover ring-4 ring-white"
                />
                <p className="font-display mt-1 text-sm font-black text-ink">
                  Harbor Kitchen
                </p>
                <p className="text-[10px] text-ink-soft">
                  Simple family meals by Jenny
                </p>
                <div className="mt-3 space-y-2 text-left">
                  {["🍅 Free recipe of the week", "🙋 About Jenny"].map((l) => (
                    <p
                      key={l}
                      className="rounded-xl border-2 border-ink/10 bg-white px-3 py-2 text-[11px] font-semibold text-ink"
                    >
                      {l}
                    </p>
                  ))}
                  <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                    <div className="relative h-16">
                      <img
                        src={PHOTO(FOOD, 340, 116, false)}
                        alt=""
                        aria-hidden="true"
                        width={340}
                        height={116}
                        loading="lazy"
                        className="h-16 w-full object-cover"
                      />
                      <span className="font-display absolute bottom-1 left-2 text-[11px] font-black text-white drop-shadow">
                        Weekly Meal Planner
                      </span>
                    </div>
                    <p className="flex items-center justify-between px-3 py-2 text-[11px]">
                      <span className="text-ink-soft">from</span>
                      <span className="font-display font-black text-violet-deep">
                        $27
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Phone>

          {/* 2 — price options */}
          <Phone
            label="2. Several prices"
            caption="One product, the buyer picks the size."
            tilt="lg:rotate-1"
          >
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-pink-brand">
                Weekly meal planner
              </p>
              <p className="font-display text-sm font-black text-ink">
                Choose your plan
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-ink">
                    1 week
                    <span className="block text-[9px] font-normal text-ink-soft">
                      PDF, 1 page
                    </span>
                  </span>
                  <span className="font-display text-sm font-black">$27</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border-2 border-violet-brand bg-lilac px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-ink">
                    5 weeks
                    <span className="block text-[9px] font-normal text-ink-soft">
                      PDF, 5 pages
                    </span>
                  </span>
                  <span className="font-display text-sm font-black text-violet-deep">
                    $39
                  </span>
                </div>
              </div>
              <p className="mt-4 rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-3 py-2.5 text-center text-[12px] font-bold text-white">
                Continue to checkout
              </p>
              <p className="mt-2 text-center text-[9px] text-ink-soft">
                Secure checkout by Stripe. Money goes straight to the creator.
              </p>
            </div>
          </Phone>

          {/* 3 — checkout */}
          <Phone
            label="3. Checkout"
            caption="On Stripe, into the creator's own account."
            tilt="lg:-rotate-1"
          >
            <div className="flex h-full flex-col bg-white p-4">
              <p className="text-[10px] font-semibold text-ink-soft">
                Pay Harbor Kitchen
              </p>
              <p className="font-display text-2xl font-black text-ink">$39.00</p>
              <p className="mt-1 text-[10px] text-ink-soft">
                Weekly Meal Planner (5 weeks)
              </p>
              <div className="mt-4 space-y-2">
                {["Email", "Card number", "MM / YY   ·   CVC", "Name on card"].map(
                  (f) => (
                    <p
                      key={f}
                      className="rounded-lg border-2 border-ink/10 px-3 py-2 text-[10px] text-ink-soft"
                    >
                      {f}
                    </p>
                  ),
                )}
              </div>
              <p className="mt-4 rounded-lg bg-ink px-3 py-2.5 text-center text-[12px] font-bold text-white">
                Pay $39.00
              </p>
              <p className="mt-3 text-center text-[9px] text-ink-soft">
                Card, Apple Pay, Klarna and Afterpay, handled by Stripe.
              </p>
            </div>
          </Phone>

          {/* 4 — delivered */}
          <Phone
            label="4. File delivered"
            caption="The second Stripe confirms the payment."
            tilt="lg:rotate-2"
          >
            <div className="p-4">
              <div className="rounded-2xl border-2 border-ink/10 bg-white p-4">
                <p aria-hidden="true" className="text-2xl">
                  🎉
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-mint-deep">
                  Payment confirmed
                </p>
                <p className="font-display mt-1 text-sm font-black text-ink">
                  Thank you! Your file is ready.
                </p>
                <p className="mt-1 text-[10px] text-ink-soft">
                  You paid $39 for Weekly Meal Planner, 5 weeks.
                </p>
                <p className="mt-3 rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-3 py-2.5 text-center text-[12px] font-bold text-white">
                  Download the PDF
                </p>
                <p className="mt-2 text-center text-[9px] text-ink-soft">
                  PDF, 5 pages. This link works for 3 days.
                </p>
              </div>
            </div>
          </Phone>

          {/* 5 — what is inside */}
          <Phone
            label="5. What they receive"
            caption="Real pages of the file, not a stock picture."
            tilt="lg:-rotate-2"
          >
            <div className="p-4">
              <p className="font-display text-sm font-black text-ink">
                What is inside
              </p>
              <p className="text-[10px] text-ink-soft">
                Real pages from the file you receive.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  "/demo/week1-1.webp",
                  "/demo/five-1.webp",
                  "/demo/five-2.webp",
                  "/demo/five-3.webp",
                ].map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt="A page of the meal planner"
                    width={420}
                    height={544}
                    loading="lazy"
                    className="h-32 w-full rounded-lg border border-ink/10 object-cover object-top"
                  />
                ))}
              </div>
            </div>
          </Phone>
        </div>

        <div className="mt-10">
          <InstallApp />
        </div>

        <div className="reveal mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/demo"
            className="rounded-full bg-white px-6 py-3 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5"
          >
            Open these screens for real
          </Link>
          <p className="text-sm text-white/70">
            Swipe the phones. Every screen above exists in the live demo store.
          </p>
        </div>
      </div>
    </section>
  );
}
