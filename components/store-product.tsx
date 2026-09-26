import Link from "next/link";
import { centsToPrice, isFree, type Product, type Store } from "@/lib/store";
import { canSellProduct, fromPriceCents, sellableOptions } from "@/lib/store-checkout";
import { everyLabel, membershipPrice } from "@/lib/product-recurring";
import { canGiveProduct } from "@/lib/free";
import { activeBump, activePlan, planWords } from "@/lib/product-extras";
import { activePwyw } from "@/lib/pay-what-you-want";
import { imageUrl } from "@/lib/product-image";

/**
 * Where a product's own page is, under the store's address.
 *
 * Links from a card to this page, to a booking page or to a course are not
 * prefetched: every one of those pages is drawn fresh for its visitor, so a
 * prefetch is a request to the server, and a store of two hundred products
 * would send hundreds of them from one visit that opens none.
 */
export function productPath(store: Store, product: Product): string {
  return `/@${store.handle}/p/${product.id}`;
}

/** The figure on the price pill: "$27", "from $9 a month", "$5+", "Free". */
export function pricePill(product: Product): string {
  if (isFree(product)) return "Free";
  if (activePwyw(product)) return `$${centsToPrice(product.priceCents)}+`;
  const options = sellableOptions(product);
  const every = product.recurring ? ` ${everyLabel(product.recurring.interval)}` : "";
  return `${options.length > 1 ? "from " : ""}$${centsToPrice(fromPriceCents(product))}${every}`;
}

/** What a card says about a call: one person, a group, or dated live sessions. */
function callLine(call: NonNullable<Product["call"]>, now = Date.now()): string {
  if (call.kind === "live") {
    const coming = call.sessions.filter((s) => s.start > now).length;
    if (coming === 0) return "Live session, online, no dates scheduled";
    return `Live session, online, ${coming} ${coming === 1 ? "date" : "dates"} scheduled`;
  }
  if (call.seats > 1) return `Group call, ${call.minutes} minutes, up to ${call.seats} people, online`;
  return `${call.minutes}-minute call, online`;
}

/** Whether a call can still be booked: always for weekly hours, and for dated sessions while one is before its notice. */
function hasDateOnSale(call: NonNullable<Product["call"]>, now = Date.now()): boolean {
  if (call.kind !== "live") return true;
  return call.sessions.some((s) => s.start - call.noticeHours * 3600_000 > now);
}

/**
 * The line under the title that says what the pill cannot: the length of a
 * call, a course's lessons, a free trial, a set number of payments, a price
 * the buyer chooses. Every one of them is something the checkout will do.
 */
export function ProductFacts({ store, product, linkCourse = true }: { store: Store; product: Product; linkCourse?: boolean }) {
  const pwyw = activePwyw(product);
  const options = sellableOptions(product);
  const facts: string[] = [];
  if (product.call) facts.push(callLine(product.call));
  if (product.recurring && (product.recurring.trialDays > 0 || product.recurring.payments > 0)) {
    const price = `$${centsToPrice(fromPriceCents(product))}`;
    facts.push(`${options.length > 1 ? "From " : ""}${membershipPrice(product.recurring, price)}`.replace(/^([a-z])/, (c) => c.toUpperCase()));
  }
  if (pwyw) {
    facts.push(`Pay what you want, from $${centsToPrice(product.priceCents)}. Suggested: $${centsToPrice(pwyw.suggestedCents)}`);
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
}: {
  store: Store;
  product: Product;
  /** Units left of a limited product, or null when it is not limited. */
  remaining: number | null;
  /** Whether buyers may be asked to hear from the creator. */
  writes: boolean;
  /** Whether the store can take a payment at all right now. */
  selling: boolean;
}) {
  const options = sellableOptions(product);
  const every = product.recurring ? ` ${everyLabel(product.recurring.interval)}` : "";
  const soldOut = remaining === 0;
  const extra = activeBump(store.products, product);
  const plan = activePlan(product);
  const pwyw = activePwyw(product);
  const trial = product.recurring && product.recurring.trialDays > 0 ? product.recurring.trialDays : 0;

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
        <label htmlFor={`e-${product.id}`} className="st-label">
          Your email
        </label>
        <input
          id={`e-${product.id}`}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          className="st-field"
        />
        <label htmlFor={`c-${product.id}`} className="st-muted flex cursor-pointer items-start gap-3 text-sm">
          <input id={`c-${product.id}`} type="checkbox" name="consent" value="yes" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{`Also send me emails from ${store.name}. I can unsubscribe whenever I like.`}</span>
        </label>
        <button type="submit" className="btn st-btn btn-block">
          Email it to me
        </button>
        <p className="st-muted text-xs">
          {`We email you a link to it. ${store.name} gets your address, marked with whether you ticked the box, and Nimbus uses it for nothing else.`}
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
      <Link prefetch={false} href={`/@${store.handle}/book/${product.id}`} className="btn st-btn btn-block mt-4">
        {`${product.call.kind === "live" ? "Pick a session" : "Pick a time"} — $${centsToPrice(product.priceCents)}`}
      </Link>
    );
  }

  if (soldOut) return null;

  if (!canSellProduct(store, product)) {
    /*
      Sellable store, but this one has nothing attached to hand over. Better to
      say so than to take the money and work out the delivery afterwards.
    */
    return selling ? <p className="st-muted mt-4 text-sm">Not ready to buy yet.</p> : null;
  }

  return (
    <form action="/api/store/checkout" method="post" className="mt-4" data-checkout="">
      <input type="hidden" name="handle" value={store.handle} />
      <input type="hidden" name="product" value={product.id} />
      {/*
        Radio cards, and nothing else. The form sends the id of the option the
        buyer picked; what it costs is read from the creator's own record on
        the server, so the price cannot be sent from here. Plain radios also
        mean the choice works with JavaScript turned off.
      */}
      {options.length > 0 ? (
        <fieldset className="mb-4">
          <legend className="sr-only">{`Choose an option for ${product.title}`}</legend>
          <div className="space-y-2">
            {options.map((option, index) => (
              <label key={option.id} htmlFor={`o-${option.id}`} className="st-option">
                <span className="flex items-center gap-3">
                  <input
                    id={`o-${option.id}`}
                    type="radio"
                    name="option"
                    value={option.id}
                    defaultChecked={index === 0}
                    className="h-4 w-4"
                  />
                  <span className="font-bold">{option.label}</span>
                </span>
                <span className="font-semibold tabular-nums">{`$${centsToPrice(option.priceCents)}${every}`}</span>
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
              <span className="font-semibold tabular-nums">{`$${centsToPrice(product.priceCents)}`}</span>
            </label>
            <label htmlFor={`pp-${product.id}`} className="st-option">
              <span className="flex items-center gap-3">
                <input id={`pp-${product.id}`} type="radio" name="pay" value="plan" className="h-4 w-4" />
                <span className="font-bold">{planWords(plan)}</span>
              </span>
              <span className="font-semibold tabular-nums">{`$${centsToPrice(plan.amountCents)} today`}</span>
            </label>
          </div>
        </fieldset>
      ) : null}
      {extra ? (
        /* Never ticked for the buyer. What it costs is the creator's price for it here, read on the server. */
        <label htmlFor={`b-${product.id}`} className="st-option mb-4 !items-start" style={{ borderStyle: "dashed" }}>
          <span className="flex items-start gap-3">
            <input id={`b-${product.id}`} type="checkbox" name="bump" value="yes" className="mt-1 h-4 w-4 shrink-0" />
            <span>
              <span className="block font-bold">{`Add ${extra.target.title} for $${centsToPrice(extra.bump.priceCents)}`}</span>
              {extra.bump.pitch ? <span className="st-muted mt-0.5 block text-sm">{extra.bump.pitch}</span> : null}
              {extra.bump.priceCents < extra.target.priceCents ? (
                <span className="st-muted mt-0.5 block text-xs">{`$${centsToPrice(extra.target.priceCents)} on its own`}</span>
              ) : null}
            </span>
          </span>
        </label>
      ) : null}
      {writes ? (
        /* Starts empty, like every box here: buying is not agreeing to more email. */
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
                  : "Buy the one you picked"
                : product.recurring
                  ? `Subscribe — $${centsToPrice(product.priceCents)}${every}`
                  : `Buy for $${centsToPrice(product.priceCents)}`}
        </span>
        {/* With the box ticked, the button says the new total. */}
        {plan ? <span className="plan-on">{`Start the plan: $${centsToPrice(plan.amountCents)} today`}</span> : null}
        {plan && extra ? (
          <span className="plan-bump-on">
            {`Start the plan with ${extra.target.title}: $${centsToPrice(plan.amountCents + extra.bump.priceCents)} today`}
          </span>
        ) : null}
        {extra ? (
          <span className="bump-on">
            {options.length > 0
              ? `Buy it with ${extra.target.title}`
              : `Buy both for $${centsToPrice(product.priceCents + extra.bump.priceCents)}`}
          </span>
        ) : null}
      </button>
      {pwyw ? (
        <p className="st-muted mt-2 text-center text-xs">
          {`You type the amount on the payment page: $${centsToPrice(product.priceCents)} or more, $${centsToPrice(pwyw.suggestedCents)} suggested.`}
        </p>
      ) : null}
      {trial && product.recurring ? (
        <p className="st-muted mt-2 text-center text-xs">
          {`Your card is asked for now and nothing is charged for ${trial} days. Then ${membershipPrice(
            { ...product.recurring, trialDays: 0 },
            `$${centsToPrice(fromPriceCents(product))}`,
          )}${product.recurring.payments > 0 ? "" : " until you cancel"}. Cancel before the trial ends and you pay nothing.`}
        </p>
      ) : null}
    </form>
  );
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
  remaining,
  writes,
  selling,
  manageable,
  eager = false,
}: {
  store: Store;
  product: Product;
  remaining: number | null;
  writes: boolean;
  selling: boolean;
  manageable: boolean;
  /** Near the top of the page: the picture is fetched straight away. */
  eager?: boolean;
}) {
  const href = productPath(store, product);
  const image = product.image;
  const style = image ? product.display : "button";
  const plan = activePlan(product);
  const soldOut = remaining === 0;

  const picture = image ? (
    // A plain img: the picture was already sized in the creator's browser and
    // its address never changes, so there is nothing for an optimiser to add.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(image)}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
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
      <p className="st-price text-base">{pricePill(product)}</p>
    </div>
  );

  const summary = product.summary ? <p className="st-muted mt-2 leading-relaxed">{product.summary}</p> : null;
  const body = (
    <>
      <ProductFacts store={store} product={product} />
      {summary}
      {product.about ? (
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
      {plan && canSellProduct(store, product) ? (
        <p className="st-muted mt-1 text-sm font-semibold">{`or ${planWords(plan)}`}</p>
      ) : null}
      {remaining !== null ? (
        <p className="mt-2 text-sm font-bold" style={{ color: "var(--st-accent-text)" }}>
          {soldOut ? "Sold out" : `${remaining.toLocaleString("en-US")} left`}
        </p>
      ) : null}
      <BuyBox store={store} product={product} remaining={remaining} writes={writes} selling={selling} />
      {product.recurring && manageable ? (
        <p className="mt-3 text-center text-sm">
          <Link href={`/@${store.handle}/manage`} className="st-footer-link font-semibold">
            Already a member? Manage or cancel
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
            <p className="st-price mt-2 text-sm">{pricePill(product)}</p>
            <ProductFacts store={store} product={product} />
            {/* Beside the picture on a wide screen, where there is room for it. */}
            <div className="hidden sm:block">{summary}</div>
          </div>
        </div>
        <div className="sm:hidden">{summary}</div>
        {product.about ? (
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
