import Link from "next/link";
import { Icon } from "@/components/icons";
import { InstallApp } from "@/components/install-app";

const PHOTO = (id: string, w: number, h: number, faces = true) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop${faces ? "&crop=faces" : ""}&w=${w}&h=${h}&q=68`;

const JENNY = "photo-1543871595-e11129e271cc";

/* Lines the first phone up with the heading above it, while the row itself
   runs to the edge of the screen. Same numbers as .container-page. */
const GUTTER =
  "max(clamp(1rem, 0.4rem + 2.6vw, 2rem), calc((100% - 76rem) / 2 + clamp(1rem, 0.4rem + 2.6vw, 2rem)))";
const FOOD = "photo-1535473895227-bdecb20fb157";

/* One frame for every screen: same size, same shadow, no tilt. */
function Phone({
  step,
  label,
  caption,
  children,
}: {
  step: number;
  label: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <li className="w-[15.5rem] shrink-0 snap-start sm:w-[16.5rem]">
      <figure>
        <div className="rounded-[2.2rem] bg-[#0f0c2a] p-[7px] shadow-[var(--shadow-lg)]">
          <div className="relative h-[29rem] overflow-hidden rounded-[1.8rem] bg-paper">
            <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[10px] font-semibold text-ink-mute">
              <span>9:41</span>
              <span className="rounded-[5px] bg-white px-1.5 py-0.5 text-[9px] text-ink-soft ring-1 ring-line">
                nimbuslabsai.com/demo
              </span>
            </div>
            {children}
          </div>
        </div>
        <figcaption className="mt-5 px-1">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-lilac text-[0.75rem] font-semibold text-violet-deep">
              {step}
            </span>
            {label}
          </span>
          <span className="mt-1.5 block text-[0.9375rem] leading-snug text-ink-soft">{caption}</span>
        </figcaption>
      </figure>
    </li>
  );
}

export function PhoneScreens() {
  return (
    <section id="screens" className="section scroll-mt-20 overflow-hidden bg-white">
      <div className="container-page">
        <div className="reveal flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">The buyer&apos;s path</p>
            <h2 className="t-h2 balance mt-4">From the link in your bio to the file in their hands</h2>
            <p className="mt-5 text-ink-soft">
              These are the real screens of the live demo store, not a mock-up made in a design tool. Open it and buy
              with a Stripe test card to see every one.
            </p>
          </div>
          <Link href="/demo" className="btn btn-secondary shrink-0">
            Open the demo store
            <Icon name="arrow-up-right" size={18} />
          </Link>
        </div>
      </div>

      <div className="reveal mt-12">
        <ol
          aria-label="The five screens of a sale"
          tabIndex={0}
          className="nb-no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto pb-6 focus-visible:outline-offset-[-3px]"
          style={{ paddingInline: GUTTER, scrollPaddingInline: GUTTER }}
        >
          {/* 1 — the store */}
          <Phone step={1} label="Your store" caption="A face, a line about you, links and products.">
            <div>
              <img
                src={PHOTO(FOOD, 400, 144, false)}
                alt=""
                width={400}
                height={144}
                loading="lazy"
                className="h-20 w-full bg-sand-deep object-cover"
              />
              <div className="px-4 pb-4 text-center">
                <img
                  src={PHOTO(JENNY, 112, 112)}
                  alt="Jenny, the fictional cook of the demo store"
                  width={112}
                  height={112}
                  loading="lazy"
                  className="-mt-7 inline-block h-14 w-14 rounded-full bg-sand-deep object-cover ring-4 ring-paper"
                />
                <p className="mt-1 text-sm font-semibold text-ink">Harbor Kitchen</p>
                <p className="text-[10.5px] text-ink-mute">Simple family meals by Jenny</p>
                <div className="mt-3 space-y-2 text-left">
                  {["Free recipe of the week", "About Jenny"].map((l) => (
                    <p key={l} className="rounded-[10px] border border-line bg-white px-3 py-2 text-[11px] font-medium text-ink-soft">
                      {l}
                    </p>
                  ))}
                  <div className="overflow-hidden rounded-[10px] border border-line bg-white">
                    <img
                      src={PHOTO(FOOD, 340, 116, false)}
                      alt=""
                      width={340}
                      height={116}
                      loading="lazy"
                      className="h-16 w-full bg-sand-deep object-cover"
                    />
                    <p className="flex items-center justify-between px-3 py-2 text-[11px]">
                      <span className="font-medium text-ink">Weekly Meal Planner</span>
                      <span className="font-semibold text-violet-deep">from $27</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Phone>

          {/* 2 — price options */}
          <Phone step={2} label="Several prices" caption="One product. The buyer picks the size.">
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-deep">Weekly meal planner</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">Choose your plan</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-[10px] border border-line bg-white px-3 py-2.5">
                  <span className="text-[11px] font-medium text-ink">
                    1 week
                    <span className="block text-[9.5px] font-normal text-ink-mute">PDF, 1 page</span>
                  </span>
                  <span className="text-sm font-semibold">$27</span>
                </div>
                <div className="flex items-center justify-between rounded-[10px] border border-violet-brand bg-lilac px-3 py-2.5">
                  <span className="text-[11px] font-medium text-ink">
                    5 weeks
                    <span className="block text-[9.5px] font-normal text-ink-mute">PDF, 5 pages</span>
                  </span>
                  <span className="text-sm font-semibold text-violet-deep">$39</span>
                </div>
              </div>
              <p className="mt-4 rounded-[10px] bg-violet-brand px-3 py-2.5 text-center text-[12px] font-semibold text-white">
                Continue to checkout
              </p>
              <p className="mt-2 text-center text-[9.5px] text-ink-mute">Secure checkout by Stripe. The money goes to the creator.</p>
            </div>
          </Phone>

          {/* 3 — checkout */}
          <Phone step={3} label="Checkout on Stripe" caption="Paid on the creator's own Stripe account.">
            <div className="flex h-full flex-col bg-white p-4">
              <p className="text-[10.5px] text-ink-mute">Pay Harbor Kitchen</p>
              <p className="text-2xl font-semibold tracking-[-0.03em] text-ink">$39.00</p>
              <p className="mt-0.5 text-[10.5px] text-ink-mute">Weekly Meal Planner (5 weeks)</p>
              <div className="mt-4 space-y-2">
                {["Email", "Card number", "MM / YY   ·   CVC", "Name on card"].map((f) => (
                  <p key={f} className="rounded-[8px] border border-line px-3 py-2 text-[10.5px] text-ink-mute">
                    {f}
                  </p>
                ))}
              </div>
              <p className="mt-4 rounded-[8px] bg-ink px-3 py-2.5 text-center text-[12px] font-semibold text-white">Pay $39.00</p>
              <p className="mt-3 text-center text-[9.5px] text-ink-mute">Card, Apple Pay, Klarna and Afterpay, handled by Stripe.</p>
            </div>
          </Phone>

          {/* 4 — delivered */}
          <Phone step={4} label="File delivered" caption="The second Stripe confirms the payment.">
            <div className="p-4">
              <div className="rounded-[14px] border border-line bg-white p-4">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mint-soft text-mint-deep">
                  <Icon name="check" size={18} strokeWidth={2.4} />
                </span>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-mint-deep">Payment confirmed</p>
                <p className="mt-1 text-sm font-semibold text-ink">Thank you. Your file is ready.</p>
                <p className="mt-1 text-[10.5px] text-ink-mute">You paid $39 for Weekly Meal Planner, 5 weeks.</p>
                <p className="mt-3 flex items-center justify-center gap-1.5 rounded-[10px] bg-violet-brand px-3 py-2.5 text-center text-[12px] font-semibold text-white">
                  <Icon name="download" size={14} strokeWidth={2.2} /> Download the PDF
                </p>
                <p className="mt-2 text-center text-[9.5px] text-ink-mute">PDF, 5 pages. This link works for 3 days.</p>
              </div>
            </div>
          </Phone>

          {/* 5 — what is inside */}
          <Phone step={5} label="What they receive" caption="Real pages of the file, not a stock picture.">
            <div className="p-4">
              <p className="text-sm font-semibold text-ink">What is inside</p>
              <p className="text-[10.5px] text-ink-mute">Real pages from the file you receive.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["/demo/week1-1.webp", "/demo/five-1.webp", "/demo/five-2.webp", "/demo/five-3.webp"].map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt="A page of the meal planner"
                    width={420}
                    height={544}
                    loading="lazy"
                    className="h-32 w-full rounded-[8px] border border-line object-cover object-top"
                  />
                ))}
              </div>
            </div>
          </Phone>
          <li aria-hidden="true" className="w-1 shrink-0" />
        </ol>
      </div>

      <div className="container-page">
        <InstallApp />
      </div>
    </section>
  );
}
