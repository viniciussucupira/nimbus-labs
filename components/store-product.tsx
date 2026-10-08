import { packageLimitWords, packageSaving } from "@/lib/call-package-rules";
import { endsWords, saleClock, saleOff, salePrice } from "@/lib/store-sale";
import { countryName, fairOff } from "@/lib/fair-price";
import Link from "next/link";
import { isFree, syncTakesBuyer, type Listing, type Store } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { canSellProduct, fromPriceCents, sellableOptions } from "@/lib/store-checkout";
import { everyLabel, membershipPrice } from "@/lib/product-recurring";
import { canGiveProduct } from "@/lib/free";
import { activeBumps, activePlan, planWords } from "@/lib/product-extras";
import { activePwyw } from "@/lib/pay-what-you-want";
import { imageUrl, IMAGE_SIZES, imageSrcSet } from "@/lib/product-image";
import type { PageAction } from "@/components/sales-blocks";
import { RatingLine } from "@/components/review-list";
import type { Summary } from "@/lib/review-summary";
import { MIN_BUNDLE_ITEMS, worthWords } from "@/lib/bundle-rules";
import { payPalPrice, paypalReady } from "@/lib/paypal-sales";
import { comparable, startingOption } from "@/lib/product-option";
import { DEFAULT_PEOPLE, MAX_PEOPLE, MIN_PEOPLE } from "@/lib/group-rules";
import { givableOptions } from "@/lib/gift-rules";

/**
 * How many price options are drawn as cards before they become a list to pick
 * from. Six: two rows of three on a wide screen, and on a phone still a
 * scroll the buyer can take in, rather than fifty cards to swipe past.
 */
const LIST_ABOVE = 6;

/**
 * Where a product's own page is, under the store's address.
 *
 * Links from a card to this page, to a booking page or to a course are not
 * prefetched: every one of those pages is drawn fresh for its visitor, so a
 * prefetch is a request to the server, and a page of two dozen products
 * would send dozens of them from one visit that opens none.
 */
export function productPath(store: Store, product: Listing): string {
  return `/@${store.handle}/p/${product.id}`;
}

/** The figure on the price pill: "$27", "from €9 a month", "¥500+", "Free", in the store's currency. */
export function pricePill(product: Listing, currency: string): string {
  if (isFree(product)) return "Free";
  if (activePwyw(product)) return `${formatMoney(product.priceCents, currency)}+`;
  const options = sellableOptions(product);
  const every = product.recurring ? ` ${everyLabel(product.recurring.interval)}` : "";
  return `${options.length > 1 ? "from " : ""}${formatMoney(fromPriceCents(product), currency)}${every}`;
}

/** The percentage a running store-wide sale takes off this product now, or 0 (lib/store-sale.ts). */
export function saleNow(store: Store, product: Listing): number {
  return store.sale ? saleOff(store.sale, product, saleClock()) : 0;
}

/** The percentage this visitor's country takes off this product, or 0 (lib/fair-price.ts). */
export function fairNow(store: Store, product: Listing): number {
  return fairOff(store.fair, product, store.visitorCountry ?? "");
}

/**
 * The percentage off this product for this visitor now: a sale or a fair
 * price for their country, whichever is larger, never both. The checkout
 * takes off the same one (lib/store-checkout.ts).
 */
export function offNow(store: Store, product: Listing): number {
  return Math.max(saleNow(store, product), fairNow(store, product));
}

/**
 * The price pill, with the old price crossed out while a sale covers the
 * product. What is crossed out is the product's price, never a made-up one.
 */
export function PriceTag({ store, product }: { store: Store; product: Listing }) {
  const off = offNow(store, product);
  if (!off) return <>{pricePill(product, store.currency)}</>;
  return (
    <>
      <s className="st-muted mr-1.5 font-normal">
        <span className="sr-only">Was </span>
        {formatMoney(product.priceCents, store.currency)}
      </s>
      <span className="sr-only">now </span>
      {formatMoney(salePrice(product.priceCents, off), store.currency)}
    </>
  );
}

/** "Black Friday: 30% off · Ends in 2 days", under the buy button while a sale covers it. */
export function SaleNote({ store, product }: { store: Store; product: Listing }) {
  const sale = saleNow(store, product);
  const fair = fairNow(store, product);
  // A fair price for the visitor's country, when it takes off more than the sale does.
  if (fair > sale) {
    return (
      <p className="mt-2 text-center text-sm font-semibold" style={{ color: "var(--st-accent-text)" }}>
        {`A fair price for ${countryName(store.visitorCountry ?? "")}: ${fair}% off`}
        <span className="st-muted block text-xs font-normal">
          {`${store.name} lowers prices where money buys less. Taken off on the payment page, no code needed${activePlan(product) ? "; the lower price is for paying in full" : ""}.`}
        </span>
      </p>
    );
  }
  const off = sale;
  if (!off) return null;
  const end = new Date(store.sale.ends * 1000);
  return (
    <p className="mt-2 text-center text-sm font-semibold" style={{ color: "var(--st-accent-text)" }}>
      {`${store.sale.name ? `${store.sale.name}: ` : ""}${off}% off · ${endsWords(store.sale.ends, saleClock())}`}
      <span className="st-muted block text-xs font-normal">
        {`Until ${end.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })}. Taken off on the payment page, no code needed${activePlan(product) ? "; the sale price is for paying in full" : ""}.`}
      </span>
    </p>
  );
}

/** What a card says about a call: one person, a group, or dated live sessions. */
function callLine(call: NonNullable<Listing["call"]>, now = Date.now()): string {
  if (call.kind === "live") {
    const coming = call.sessions.filter((s) => s.start > now).length;
    if (coming === 0) return "Live session, online, no dates scheduled";
    return `Live session, online, ${coming} ${coming === 1 ? "date" : "dates"} scheduled`;
  }
  if (call.seats > 1) return `Group call, ${call.minutes} minutes, up to ${call.seats} people, online`;
  return `${call.minutes}-minute call, online`;
}

/** Whether a call can still be booked: always for weekly hours, and for dated sessions while one is before its notice. */
export function hasDateOnSale(call: NonNullable<Listing["call"]>, now = Date.now()): boolean {
  if (call.kind !== "live") return true;
  return call.sessions.some((s) => s.start - call.noticeHours * 3600_000 > now);
}

/**
 * The line under the title that says what the pill cannot: the length of a
 * call, a course's lessons, a free trial, a set number of payments, a price
 * the buyer chooses. Every one of them is something the checkout will do.
 */
export function ProductFacts({
  store,
  product,
  linkCourse = true,
  bundleItems = null,
}: {
  store: Store;
  product: Listing;
  linkCourse?: boolean;
  /** For a bundle: what it hands over now (lib/bundles.ts, offeredItems). */
  bundleItems?: Listing[] | null;
}) {
  const pwyw = activePwyw(product);
  const options = sellableOptions(product);
  const facts: string[] = [];
  // A bundle: how many products, and — only when it is true — what they cost
  // on their own, from their prices today (lib/bundle-rules.ts).
  const inside = product.bundle && bundleItems && bundleItems.length >= MIN_BUNDLE_ITEMS ? bundleItems : null;
  if (inside) {
    const worth = worthWords(inside, product.priceCents, store.currency);
    facts.push(`Bundle of ${inside.length} products${worth ? ` \u00b7 ${worth}` : ""}`);
  }
  if (product.call) facts.push(callLine(product.call));
  if (product.podcast && product.podcast.episodes > 0) {
    const n = product.podcast.episodes;
    facts.push(`Private podcast, ${n} ${n === 1 ? "episode" : "episodes"}, in your own podcast app`);
  }
  if (product.recurring && (product.recurring.trialDays > 0 || product.recurring.payments > 0)) {
    const price = `${formatMoney(fromPriceCents(product), store.currency)}`;
    facts.push(`${options.length > 1 ? "From " : ""}${membershipPrice(product.recurring, price)}`.replace(/^([a-z])/, (c) => c.toUpperCase()));
  }
  if (pwyw) {
    facts.push(`Pay what you want, from ${formatMoney(product.priceCents, store.currency)}. Suggested: ${formatMoney(pwyw.suggestedCents, store.currency)}`);
  }
  const course = product.course && product.course.lessons > 0 ? product.course : null;
  if (facts.length === 0 && !course) return null;
  return (
    <>
      {facts.map((fact) => (
        <p key={fact} className="st-muted mt-1 text-sm font-semibold">
          {fact}
        </p>
      ))}
      {inside && linkCourse ? (
        <p className="st-muted mt-1 text-sm">
          {`Includes ${inside.slice(0, 4).map((p) => p.title).join(", ")}${inside.length > 4 ? ` and ${inside.length - 4} more` : ""}`}
        </p>
      ) : null}
      {course ? (
        <p className="mt-1 text-sm font-semibold">
          <span className="st-muted">{`Course · ${course.lessons} ${course.lessons === 1 ? "lesson" : "lessons"}`}</span>
          {linkCourse ? (
            <>
              <span className="st-muted">{" · "}</span>
              <Link prefetch={false} href={`/@${store.handle}/course/${product.id}`} className="underline underline-offset-2" style={{ color: "var(--st-text)" }}>
                See what is inside
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

/**
 * A weekly call's package, beside its single price (lib/call-package-rules.ts):
 * several sessions paid at once and booked one at a time.
 */
export function PackageOffer({ store, product }: { store: Store; product: Listing }) {
  const pkg = product.callPackage;
  if (!pkg || product.call?.kind !== "weekly") return null;
  const saving = packageSaving(pkg, product.priceCents);
  return (
    <form action="/api/store/package" method="post" target="_top" className="mt-3" data-checkout="">
      <input type="hidden" name="handle" value={store.handle} />
      <input type="hidden" name="product" value={product.id} />
      <button type="submit" className="btn btn-block" style={{ border: "1px solid var(--st-line-strong)", color: "var(--st-text)", background: "var(--st-card)" }}>
        {`Buy ${pkg.sessions} sessions — ${formatMoney(pkg.priceCents, store.currency)}`}
      </button>
      <p className="st-muted mt-2 text-center text-xs">
        {`${saving > 0 ? `${formatMoney(saving, store.currency)} less than ${pkg.sessions} booked one by one. ` : ""}Paid once, each booked when you like. ${packageLimitWords(pkg)}.`}
      </p>
    </form>
  );
}

/**
 * Which of a product's prices is being bought for somebody else: a list to
 * pick from, each with its price, opened on the creator's pick. Nothing for
 * a product sold at one price. The price charged is read on the server from
 * the option's id, never from this list.
 */
function GivenOptionPicker({ store, product, each = false }: { store: Store; product: Listing; each?: boolean }) {
  const options = givableOptions(product);
  if (options.length === 0) return null;
  return (
    <label className="block">
      <span className="st-label">Which one</span>
      <select className="st-field mt-2" name="option" required defaultValue={(startingOption(options) ?? options[0]).id}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {`${option.label} — ${formatMoney(option.priceCents, store.currency)}${each ? " per person" : ""}`}
          </option>
        ))}
      </select>
    </label>
  );
}

const GIFT_PROBLEMS: Record<string, string> = {
  email: "That does not look like an email address. Check the recipient's address and try again.",
  option: "Choose which one to give, then try again. Nothing was charged.",
  product: "This can no longer be bought as a gift.",
  unavailable: "Gifts are not available right now. Nothing was charged.",
};

/**
 * Buying a product for somebody else: their address, the buyer's name and a
 * message, then Stripe's page as for anything else (lib/gifts.ts). Folded
 * away under the buy box, because most buyers buy for themselves.
 */
export function GiftBox({ store, product, problem = "" }: { store: Store; product: Listing; problem?: string }) {
  return (
    <details id="gift" className="mt-4 scroll-mt-24 rounded-2xl px-4 py-3" style={{ border: "1px solid var(--st-line)" }} open={Boolean(problem)}>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold" style={{ color: "var(--st-text)" }}>
        Buy it as a gift
      </summary>
      <form action="/api/store/checkout" method="post" target="_top" className="mt-2 space-y-3 pb-1" data-checkout="">
        <input type="hidden" name="handle" value={store.handle} />
        <input type="hidden" name="product" value={product.id} />
        {problem && GIFT_PROBLEMS[problem] ? (
          <p className="st-note text-sm" role="alert">{GIFT_PROBLEMS[problem]}</p>
        ) : null}
        <GivenOptionPicker store={store} product={product} />
        <label className="block">
          <span className="st-label">Their email</span>
          <input className="st-field mt-2" type="email" name="gift_to" required maxLength={254} autoComplete="off" placeholder="friend@example.com" />
        </label>
        <label className="block">
          <span className="st-label">Your name, as they will see it</span>
          <input className="st-field mt-2" name="gift_from" maxLength={60} autoComplete="name" placeholder="Dana" />
        </label>
        <label className="block">
          <span className="st-label">A message (optional)</span>
          <textarea className="st-field mt-2" name="gift_message" rows={3} maxLength={500} />
        </label>
        <button type="submit" className="btn st-btn btn-block">
          {product.options.length > 0 ? "Buy as a gift" : `Buy as a gift — ${formatMoney(salePrice(product.priceCents, offNow(store, product)), store.currency)}`}
        </button>
        <p className="st-muted text-xs">
          {`You pay on Stripe's page. Right after, they get one email from ${store.name} with your name, your message and a link to open it on their own address. You get the receipt, not a copy.`}
        </p>
      </form>
    </details>
  );
}

const GROUP_PROBLEMS: Record<string, string> = {
  people: `Type how many people, from ${MIN_PEOPLE} to ${MAX_PEOPLE}. Nothing was charged.`,
  option: "Choose which one to buy for everyone, then try again. Nothing was charged.",
  amount: "That many at this price is more than one payment can carry. Try fewer people, or buy twice. Nothing was charged.",
  product: "This can no longer be bought for several people.",
  unavailable: "Buying for several people is not available right now. Nothing was charged.",
};

/**
 * Buying a product for several people at once: how many, then Stripe's page
 * as for anything else, and one link that hands out the places
 * (lib/group-buy.ts). Folded away under the buy box, like the gift, because
 * most buyers buy for themselves. The price shown is per person; the total
 * is on Stripe's page before anything is paid.
 */
export function GroupBox({ store, product, problem = "" }: { store: Store; product: Listing; problem?: string }) {
  const each = formatMoney(salePrice(product.priceCents, offNow(store, product)), store.currency);
  return (
    <details id="group" className="mt-4 scroll-mt-24 rounded-2xl px-4 py-3" style={{ border: "1px solid var(--st-line)" }} open={Boolean(problem)}>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold" style={{ color: "var(--st-text)" }}>
        Buy it for a team
      </summary>
      <form action="/api/store/checkout" method="post" target="_top" className="mt-2 space-y-3 pb-1" data-checkout="">
        <input type="hidden" name="handle" value={store.handle} />
        <input type="hidden" name="product" value={product.id} />
        {problem && GROUP_PROBLEMS[problem] ? (
          <p className="st-note text-sm" role="alert">{GROUP_PROBLEMS[problem]}</p>
        ) : null}
        <GivenOptionPicker store={store} product={product} each />
        <label className="block">
          <span className="st-label">How many people</span>
          <input
            className="st-field mt-2"
            type="number"
            name="people"
            required
            min={MIN_PEOPLE}
            max={MAX_PEOPLE}
            step={1}
            defaultValue={DEFAULT_PEOPLE}
            inputMode="numeric"
          />
        </label>
        <button type="submit" className="btn st-btn btn-block">
          {product.options.length > 0 ? "Buy for your team" : `Buy for your team — ${each} per person`}
        </button>
        <p className="st-muted text-xs">
          {`You pay once on Stripe's page, where the total is shown before you pay. Right after, you get one link to pass on: each person opens it, types their own email and has it on their own address. You take a place the same way.`}
        </p>
      </form>
    </details>
  );
}

/**
 * A product coming soon: an address for its waitlist, confirmed from the
 * inbox before it counts. The box to hear more from the creator starts
 * empty, like every such box here.
 */
export function WaitlistForm({ store, product }: { store: Store; product: Listing }) {
  return (
    <form id="waitlist" action="/api/store/waitlist/join" method="post" className="mt-4 scroll-mt-24 space-y-3">
      <input type="hidden" name="handle" value={store.handle} />
      <input type="hidden" name="product" value={product.id} />
      <div aria-hidden="true" className="hidden">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-sm font-bold" style={{ color: "var(--st-accent-text)" }}>Coming soon</p>
      <label htmlFor={`w-${product.id}`} className="st-label">
        Your email
      </label>
      <input
        id={`w-${product.id}`}
        type="email"
        name="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder="you@example.com"
        className="st-field"
      />
      <label htmlFor={`wc-${product.id}`} className="st-muted flex cursor-pointer items-start gap-3 text-sm">
        <input id={`wc-${product.id}`} type="checkbox" name="consent" value="yes" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{`Also send me other emails from ${store.name}. I can unsubscribe whenever I like.`}</span>
      </label>
      <button type="submit" className="btn st-btn btn-block">
        Tell me when it is out
      </button>
      <p className="st-muted text-xs">
        {`You confirm from your inbox, then get one email when it goes on sale, and that is all. Your address goes to ${store.name} only if you checked the box.`}
      </p>
    </form>
  );
}

/**
 * The part of a product a buyer acts on: the form that gives it away, the
 * button that books a call, or the form that opens a checkout, with its
 * price options, plan, box for the product offered alongside and box for the
 * creator's emails.
 *
 * The same on the store page and on the product's own page, because a buyer
 * who read more before buying must not meet different terms there. Every
 * form is plain HTML: it works with JavaScript turned off, and nothing it
 * sends can set a price.
 */
export function BuyBox({
  store,
  product,
  remaining,
  writes,
  selling,
  related,
  ready = true,
  soon = false,
  place = "",
}: {
  store: Store;
  product: Listing;
  /** Other products read with this one: the one its order bump offers, when it has one. */
  related: Listing[];
  /** Units left of a limited product, or null when it is not limited. */
  remaining: number | null;
  /** Whether buyers may be asked to hear from the creator. */
  writes: boolean;
  /** Whether the store can take a payment at all right now. */
  selling: boolean;
  /** For a bundle: whether it holds enough to hand over right now. */
  ready?: boolean;
  /** Coming soon: a waitlist instead of a way to pay (lib/waitlist.ts). */
  soon?: boolean;
  /**
   * Set when the same box is drawn twice on one page — the offer to a leaving
   * visitor (components/exit-offer-slot.tsx) beside the product's own card —
   * so the two forms' fields keep ids of their own.
   */
  place?: string;
}) {
  if (soon && !isFree(product)) return <WaitlistForm store={store} product={product} />;
  const options = sellableOptions(product);
  const every = product.recurring ? ` ${everyLabel(product.recurring.interval)}` : "";
  const soldOut = remaining === 0;
  // The boxes at checkout, each checked or not on its own (lib/product-extras.ts).
  const extras = activeBumps(related, product);
  const plan = activePlan(product);
  const pwyw = activePwyw(product);
  const trial = product.recurring && product.recurring.trialDays > 0 ? product.recurring.trialDays : 0;
  // A store-wide sale on this product right now (lib/store-sale.ts): its price everywhere below.
  const off = offNow(store, product);

  if (isFree(product)) {
    return canGiveProduct(store, product) ? (
      /*
        Given away for an address, and the address is only kept once its owner
        uses the link we email. The box starts empty and stays the visitor's
        to tick: wanting the file is not agreeing to more email.
      */
      <form action="/api/store/free" method="post" className="mt-4 space-y-3">
        <input type="hidden" name="handle" value={store.handle} />
        <input type="hidden" name="product" value={product.id} />
        <div aria-hidden="true" className="hidden">
          <label>
            Leave this empty
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label htmlFor={`e-${place}${product.id}`} className="st-label">
          Your email
        </label>
        <input
          id={`e-${place}${product.id}`}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          className="st-field"
        />
        <label htmlFor={`c-${place}${product.id}`} className="st-muted flex cursor-pointer items-start gap-3 text-sm">
          <input id={`c-${place}${product.id}`} type="checkbox" name="consent" value="yes" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{`Also send me emails from ${store.name}. I can unsubscribe whenever I like.`}</span>
        </label>
        <button type="submit" className="btn st-btn btn-block">
          Email it to me
        </button>
        <p className="st-muted text-xs">
          {`A link to it is emailed to you. Once you use it, ${store.name} gets your address, marked with whether you checked the box. Marktmorgen uses it for nothing else.`}
        </p>
      </form>
    ) : (
      <p className="st-muted mt-4 text-sm">Not available right now.</p>
    );
  }

  if (product.call && canSellProduct(store, product)) {
    // Dated sessions with none left to book: said here, rather than a button
    // to a page with nothing on it.
    if (!hasDateOnSale(product.call)) {
      return <p className="st-muted mt-4 text-sm">No dates on sale right now.</p>;
    }
    return (
      <>
        <Link prefetch={false} href={`/@${store.handle}/book/${product.id}`} className="btn st-btn btn-block mt-4">
          {`${product.call.kind === "live" ? "Pick a session" : "Pick a time"} — ${formatMoney(product.priceCents, store.currency)}`}
        </Link>
        <PackageOffer store={store} product={product} />
      </>
    );
  }

  if (soldOut) return null;

  // The creator's own PayPal, as well as Stripe or instead of it (lib/paypal-sales.ts).
  const withPayPal = ready && paypalReady(store, product);
  if (!canSellProduct(store, product) || !ready) {
    if (withPayPal) return <PayPalButton store={store} product={product} alone />;
    /*
      Sellable store, but this one has nothing attached to hand over. Better to
      say so than to take the money and work out the delivery afterward.
    */
    return selling ? <p className="st-muted mt-4 text-sm">Not on sale yet.</p> : null;
  }

  return (
    <>
    <form action="/api/store/checkout" method="post" target="_top" className="mt-4" data-checkout="">
      <input type="hidden" name="handle" value={store.handle} />
      <input type="hidden" name="product" value={product.id} />
      {/*
        target="_top", here and on every form that opens a payment page:
        Stripe and PayPal refuse to be drawn inside a frame, and the home
        page shows the demo store in one (components/home-parts.tsx). Without
        it the payment page lands in the frame and the buyer sees a blocked,
        empty panel. On a page that is not framed "_top" is the same window,
        so nothing changes. tests/demo-store.test.ts holds every such form.
      */}
      {/*
        Radio cards, and nothing else. The form sends the id of the option the
        buyer picked; what it costs is read from the creator's own record on
        the server, so the price cannot be sent from here. Plain radios also
        mean the choice works with JavaScript turned off.
      */}
      {options.length > LIST_ABOVE ? (
        /*
          Past a handful, a list to pick from rather than a wall of cards: a
          phone shows it as the system's own picker, and it still sends only
          the id. Each line carries its price, so nothing is hidden by it.
        */
        <div className="mb-4">
          <label htmlFor={`os-${product.id}`} className="st-label">{`Choose an option for ${product.title}`}</label>
          <select id={`os-${product.id}`} name="option" defaultValue={startingOption(options)?.id} className="st-field mt-2">
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {`${option.label} — ${formatMoney(option.priceCents, store.currency)}${every}${option.best ? " (recommended)" : ""}`}
              </option>
            ))}
          </select>
        </div>
      ) : options.length > 0 ? (
        <fieldset className="mb-4">
          <legend className="sr-only">{`Choose an option for ${product.title}`}</legend>
          {/*
            With what each includes written down, the cards stand side by side
            on a wide screen so the buyer can compare them; on a phone they
            stack. The creator's pick opens chosen and says so, in the
            creator's voice: "Recommended", never a claim about other buyers.
          */}
          <div className={comparable(options) ? `st-compare st-compare-${Math.min(options.length, 3)}` : "space-y-2"}>
            {options.map((option) => (
              <label key={option.id} htmlFor={`o-${option.id}`} className={comparable(options) ? "st-option st-option-card" : "st-option"}>
                <span className="flex items-center gap-3">
                  <input
                    id={`o-${option.id}`}
                    type="radio"
                    name="option"
                    value={option.id}
                    defaultChecked={option.id === startingOption(options)?.id}
                    className="h-4 w-4"
                  />
                  <span className="font-bold">{option.label}</span>
                  {option.best ? <span className="st-pick">Recommended</span> : null}
                </span>
                <span className="font-semibold tabular-nums">{`${formatMoney(option.priceCents, store.currency)}${every}`}</span>
                {option.details.length > 0 ? (
                  <ul className="st-includes">
                    {option.details.map((line, at) => (
                      <li key={at}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {plan ? (
        <fieldset className="mb-4">
          <legend className="sr-only">{`How to pay for ${product.title}`}</legend>
          <div className="space-y-2">
            <label htmlFor={`pf-${product.id}`} className="st-option">
              <span className="flex items-center gap-3">
                <input id={`pf-${product.id}`} type="radio" name="pay" value="full" defaultChecked className="h-4 w-4" />
                <span className="font-bold">Pay in full</span>
              </span>
              <span className="font-semibold tabular-nums">{`${formatMoney(salePrice(product.priceCents, off), store.currency)}`}</span>
            </label>
            <label htmlFor={`pp-${product.id}`} className="st-option">
              <span className="flex items-center gap-3">
                <input id={`pp-${product.id}`} type="radio" name="pay" value="plan" className="h-4 w-4" />
                <span className="font-bold">{planWords(plan, store.currency)}</span>
              </span>
              <span className="font-semibold tabular-nums">{`${formatMoney(plan.amountCents, store.currency)} today`}</span>
            </label>
          </div>
        </fieldset>
      ) : null}
      {extras.map((extra, slot) => (
        /*
          Never ticked for the buyer. The form sends which product the box
          offers and nothing else: what it costs is the creator's price for it
          here, read on the server.
        */
        <label key={extra.target.id} htmlFor={`b-${place}${product.id}-${slot}`} className={`st-option !items-start ${slot === extras.length - 1 ? "mb-4" : "mb-2"}`} style={{ borderStyle: "dashed" }}>
          <span className="flex items-start gap-3">
            <input id={`b-${place}${product.id}-${slot}`} type="checkbox" name="bump" value={extra.target.id} data-bump={slot} className="mt-1 h-4 w-4 shrink-0" />
            <span>
              <span className="block font-bold">{`Add ${extra.target.title} for ${formatMoney(salePrice(extra.bump.priceCents, off), store.currency)}`}</span>
              {extra.target.bundle ? (
                <span className="st-muted mt-0.5 block text-sm">{`A bundle of ${extra.target.bundle.length} products, each yours to open straight after paying.`}</span>
              ) : null}
              {extra.bump.pitch ? <span className="st-muted mt-0.5 block text-sm">{extra.bump.pitch}</span> : null}
              {extra.bump.priceCents < extra.target.priceCents ? (
                <span className="st-muted mt-0.5 block text-xs">{`${formatMoney(extra.target.priceCents, store.currency)} on its own`}</span>
              ) : null}
            </span>
          </span>
        </label>
      ))}
      {writes || syncTakesBuyer(store, product.id) ? (
        /* Starts empty, like every box here: buying is not agreeing to more email.
           Offered where the creator writes to their list here, or sends this
           product's buyers to their own email platform (lib/email-sync.ts). */
        <label htmlFor={`n-${product.id}`} className="st-muted mb-4 flex cursor-pointer items-start gap-3 text-sm">
          <input id={`n-${product.id}`} type="checkbox" name="news" value="yes" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{`Also send me emails from ${store.mail?.fromName || store.name}. I can unsubscribe whenever I like.`}</span>
        </label>
      ) : null}
      <button type="submit" className="btn st-btn btn-block">
        <span className="bump-off">
          {pwyw
            ? "Choose your price"
            : trial
              ? `Start the ${trial}-day free trial`
              : options.length > 0
                ? product.recurring
                  ? "Subscribe"
                  : "Continue with this option"
                : product.recurring
                  ? `Subscribe — ${formatMoney(product.priceCents, store.currency)}${every}`
                  : `Buy for ${formatMoney(salePrice(product.priceCents, off), store.currency)}`}
        </span>
        {/*
          With boxes checked, the button says the new total. One line is
          written for every combination of boxes, and the stylesheet shows
          the one that matches what is checked (app/globals.css, "Boxes at
          checkout"), so it is right with scripts turned off too.
        */}
        {plan ? <span className="plan-on">{`Start the plan: ${formatMoney(plan.amountCents, store.currency)} today`}</span> : null}
        {combinations(extras.length).map((picked) => {
          const chosen = extras.filter((_, slot) => picked.includes(slot));
          const added = chosen.reduce((sum, extra) => sum + salePrice(extra.bump.priceCents, off), 0);
          const code = [0, 1, 2].map((slot) => (picked.includes(slot) ? "1" : "0")).join("");
          const named = chosen.length === 1 ? chosen[0].target.title : `${chosen.length} added`;
          return (
            <span key={code}>
              {plan ? (
                <span className={`plan-bump-t pt-${code}`}>
                  {`Start the plan with ${named}: ${formatMoney(plan.amountCents + chosen.reduce((sum, extra) => sum + extra.bump.priceCents, 0), store.currency)} today`}
                </span>
              ) : null}
              <span className={`bump-t t-${code}`}>
                {options.length > 0
                  ? `Buy it with ${named}`
                  : `Buy ${COUNT_WORDS[chosen.length]} for ${formatMoney(salePrice(product.priceCents, off) + added, store.currency)}`}
              </span>
            </span>
          );
        })}
      </button>
      {pwyw ? (
        <p className="st-muted mt-2 text-center text-xs">
          {`You type the amount on the payment page: ${formatMoney(product.priceCents, store.currency)} or more, ${formatMoney(pwyw.suggestedCents, store.currency)} suggested.`}
        </p>
      ) : null}
      {trial && product.recurring ? (
        <p className="st-muted mt-2 text-center text-xs">
          {`You enter your card now, and nothing is charged for ${trial} days. Then ${membershipPrice(
            { ...product.recurring, trialDays: 0 },
            `${formatMoney(fromPriceCents(product), store.currency)}`,
          )}${product.recurring.payments > 0 ? "" : " until you cancel"}. Cancel before the trial ends and you pay nothing.`}
        </p>
      ) : null}
      {product.recurring && store.tiers.includes(product.id) ? (
        <p className="st-muted mt-2 text-center text-xs">You can switch to another of this store&apos;s plans later, up or down, and see the exact amount before anything is charged.</p>
      ) : null}
      <SaleNote store={store} product={product} />
    </form>
    {withPayPal ? <PayPalButton store={store} product={product} alone={false} /> : null}
    </>
  );
}

/**
 * Paying with PayPal, into the creator's own PayPal account: one product at
 * its one price, nothing added. A plain form; the price is read on the server.
 */
function PayPalButton({ store, product, alone }: { store: Store; product: Listing; alone: boolean }) {
  return (
    <form action="/api/store/paypal/checkout" method="post" target="_top" className={alone ? "mt-4" : "mt-3"}>
      <input type="hidden" name="handle" value={store.handle} />
      <input type="hidden" name="product" value={product.id} />
      <button type="submit" className={`btn btn-block ${alone ? "st-btn" : "st-btn-ghost"}`}>
        {`${alone ? "Buy" : "Or pay"} with PayPal — ${formatMoney(payPalPrice(store, product), store.currency)}`}
      </button>
      <p className="st-muted mt-2 text-center text-xs">
        {`Paid to ${store.name}'s own PayPal account. What you buy is sent to the email address of your PayPal account.`}
      </p>
      {alone ? <SaleNote store={store} product={product} /> : null}
    </form>
  );
}

/** "Buy both", "Buy all three", "Buy all four": the product and the boxes checked. */
const COUNT_WORDS = ["it", "both", "all three", "all four"] as const;

/** Every set of boxes a buyer can check, the empty one left out: [[0], [1], [0, 1], …]. */
function combinations(count: number): number[][] {
  const out: number[][] = [];
  for (let mask = 1; mask < 1 << count; mask += 1) out.push([0, 1, 2].filter((slot) => mask & (1 << slot)));
  return out;
}

/**
 * Where a button on a product's page of blocks leads, by the same rules as
 * the buy box: straight to Stripe's checkout when there is nothing to choose
 * first, to the buy box when there is (a price option, a payment plan, the
 * product offered alongside), to the booking page for a call, to the sign-up
 * form for something free, and nowhere — with the reason said — when it
 * cannot be bought right now. The label is what the button says when the
 * creator left it empty.
 */
export function pageAction(
  store: Store,
  product: Listing,
  remaining: number | null,
  selling: boolean,
  /** What its order bump offers, read by the page (lib/catalog.ts), as the buy box is given it. */
  related: Listing[],
  /** Coming soon: the buttons lead to its waitlist (lib/waitlist.ts). */
  soon = false,
): { action: PageAction; label: string } {
  if (soon && !isFree(product)) return { action: { kind: "link", href: "#waitlist" }, label: "Join the waitlist" };
  if (isFree(product)) {
    return canGiveProduct(store, product)
      ? { action: { kind: "link", href: "#get" }, label: "Get it free" }
      : { action: { kind: "none", text: "Not available right now." }, label: "" };
  }
  if (product.call) {
    return canSellProduct(store, product) && hasDateOnSale(product.call)
      ? { action: { kind: "link", href: `/@${store.handle}/book/${product.id}` }, label: product.call.kind === "live" ? "Pick a session" : "Pick a time" }
      : { action: { kind: "none", text: "No dates on sale right now." }, label: "" };
  }
  if (remaining === 0) return { action: { kind: "none", text: "Sold out." }, label: "" };
  if (!canSellProduct(store, product)) {
    // Sold through the creator's PayPal only: the buttons lead to the buy box, where PayPal's is.
    if (paypalReady(store, product)) return { action: { kind: "link", href: "#buy" }, label: `Buy for ${formatMoney(payPalPrice(store, product), store.currency)}` };
    return { action: { kind: "none", text: selling ? "Not on sale yet." : "This store cannot take payments yet." }, label: "" };
  }
  const trial = product.recurring && product.recurring.trialDays > 0 ? product.recurring.trialDays : 0;
  if (sellableOptions(product).length > 0 || activePlan(product) || activeBumps(related, product).length > 0) {
    return { action: { kind: "link", href: "#buy" }, label: trial ? `Start the ${trial}-day free trial` : "Choose and buy" };
  }
  const every = product.recurring ? ` ${everyLabel(product.recurring.interval)}` : "";
  return {
    action: { kind: "checkout", handle: store.handle, product: product.id },
    label: activePwyw(product)
      ? "Choose your price"
      : trial
        ? `Start the ${trial}-day free trial`
        : product.recurring
          ? `Subscribe — ${formatMoney(product.priceCents, store.currency)}${every}`
          : `Buy for ${formatMoney(salePrice(product.priceCents, offNow(store, product)), store.currency)}`,
  };
}

/**
 * One product on the store page, drawn in the style the creator picked.
 *
 *   Button   the card as it has always been, with a small picture beside the
 *            title when there is one;
 *   Callout  the picture beside the title, the summary and the price;
 *   Preview  the picture across the top of the card, then everything else.
 *
 * Every style carries the same facts and the same buy box. The title, and the
 * picture, lead to the product's own page, where the long description is.
 */
export function ProductCard({
  store,
  product,
  related,
  remaining,
  writes,
  selling,
  manageable,
  eager = false,
  first = false,
  rating = null,
  bundleItems = null,
  soon = false,
  sold = null,
}: {
  store: Store;
  product: Listing;
  /** Other products read with this one: the one its order bump offers, when it has one. */
  related: Listing[];
  remaining: number | null;
  writes: boolean;
  selling: boolean;
  manageable: boolean;
  /** Coming soon: a waitlist instead of a way to pay (lib/waitlist.ts). */
  soon?: boolean;
  /** Near the top of the page: the picture is fetched right away. */
  eager?: boolean;
  /**
   * The first product on the page: its picture is usually the biggest thing
   * a phone draws first, so the browser is told to fetch it ahead of
   * everything else it has found. One picture a page, or the hint means nothing.
   */
  first?: boolean;
  /** Its buyers' reviews, shown only when lib/reviews.ts says a page may. */
  rating?: Summary | null;
  /** For a bundle: what it hands over now (lib/bundles.ts, offeredItems). */
  bundleItems?: Listing[] | null;
  /** "Bought N times", from the creator's own Stripe account, when they chose to show it (lib/sold-count.ts). */
  sold?: string | null;
}) {
  const href = productPath(store, product);
  const image = product.image;
  const style = image ? product.display : "button";
  const plan = activePlan(product);
  const soldOut = remaining === 0;

  const picture = image ? (
    // A plain img: the picture was already sized in the creator's browser and
    // its address never changes, so there is nothing for an optimiser to add.
    // A phone is handed the smaller copy made beside it, when there is one,
    // and picks between the two itself (lib/product-image.ts, imageSrcSet).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(image)}
      srcSet={imageSrcSet(image)}
      sizes={image.small ? (style === "preview" ? IMAGE_SIZES.cover : IMAGE_SIZES.thumb) : undefined}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={first ? "high" : undefined}
      decoding="async"
      className={style === "preview" ? "st-cover" : style === "callout" ? "st-callout-img" : "st-thumb"}
      style={style === "preview" ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
    />
  ) : null;

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <h2 className="font-display min-w-0 text-lg font-semibold leading-snug">
        <Link prefetch={false} href={href} className="st-title-link">
          {product.title}
        </Link>
      </h2>
      <p className="st-price text-base"><PriceTag store={store} product={product} /></p>
    </div>
  );

  const summary = product.summary ? <p className="st-muted mt-2 leading-relaxed">{product.summary}</p> : null;
  const stars = rating ? <RatingLine summary={rating} href={`${href}#reviews`} className="mt-1" /> : null;
  const body = (
    <>
      {stars}
      {sold ? <p className="st-sold mt-1 text-sm font-semibold">{sold}</p> : null}
      <ProductFacts store={store} product={product} bundleItems={bundleItems} />
      {summary}
      {product.about || product.page ? (
        <p className="mt-2 text-sm font-semibold">
          <Link prefetch={false} href={href} className="underline underline-offset-4" style={{ color: "var(--st-text)" }}>
            Read more
          </Link>
        </p>
      ) : null}
    </>
  );

  const rest = (
    <>
      {plan && canSellProduct(store, product) && !soon ? (
        <p className="st-muted mt-1 text-sm font-semibold">{`or ${planWords(plan, store.currency)}`}</p>
      ) : null}
      {remaining !== null && !soon ? (
        <p className="mt-2 text-sm font-bold" style={{ color: "var(--st-accent-text)" }}>
          {soldOut ? "Sold out" : `${remaining.toLocaleString("en-US")} left`}
        </p>
      ) : null}
      <BuyBox
        store={store}
        product={product}
        related={related}
        remaining={remaining}
        writes={writes}
        selling={selling}
        ready={!product.bundle || (bundleItems?.length ?? 0) >= MIN_BUNDLE_ITEMS}
        soon={soon}
      />
      {product.recurring && manageable ? (
        <p className="mt-3 text-center text-sm">
          <Link href={`/@${store.handle}/manage`} className="st-footer-link font-semibold">
            {store.tiers.includes(product.id) ? "Already a member? Switch plan, manage or cancel" : "Already a member? Manage or cancel"}
          </Link>
        </p>
      ) : null}
    </>
  );

  if (style === "preview" && picture) {
    return (
      <li id={`p-${product.id}`} className="st-card scroll-mt-6 overflow-hidden">
        <Link prefetch={false} href={href} className="st-cover-link" tabIndex={-1} aria-label={image?.alt ? undefined : product.title}>
          {picture}
        </Link>
        <div className="p-5 sm:p-6">
          {heading}
          {body}
          {rest}
        </div>
      </li>
    );
  }

  if (style === "callout" && picture) {
    return (
      <li id={`p-${product.id}`} className="st-card scroll-mt-6 p-5 sm:p-6">
        <div className="flex gap-4 sm:gap-5">
          <Link prefetch={false} href={href} className="st-callout-link shrink-0" tabIndex={-1} aria-label={image?.alt ? undefined : product.title}>
            {picture}
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold leading-snug">
              <Link prefetch={false} href={href} className="st-title-link">
                {product.title}
              </Link>
            </h2>
            <p className="st-price mt-2 text-sm"><PriceTag store={store} product={product} /></p>
            {stars ? <div>{stars}</div> : null}
            <ProductFacts store={store} product={product} bundleItems={bundleItems} />
            {/* Beside the picture on a wide screen, where there is room for it. */}
            <div className="hidden sm:block">{summary}</div>
          </div>
        </div>
        <div className="sm:hidden">{summary}</div>
        {product.about || product.page ? (
          <p className="mt-2 text-sm font-semibold">
            <Link prefetch={false} href={href} className="underline underline-offset-4" style={{ color: "var(--st-text)" }}>
              Read more
            </Link>
          </p>
        ) : null}
        {rest}
      </li>
    );
  }

  return (
    <li id={`p-${product.id}`} className="st-card scroll-mt-6 p-5 sm:p-6">
      {picture ? (
        <div className="flex items-start gap-3">
          <Link prefetch={false} href={href} className="shrink-0" tabIndex={-1} aria-label={image?.alt ? undefined : product.title}>
            {picture}
          </Link>
          <div className="min-w-0 flex-1">{heading}</div>
        </div>
      ) : (
        heading
      )}
      {body}
      {rest}
    </li>
  );
}
