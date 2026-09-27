import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Product, centsToPrice, normaliseHandle, storeForHandle } from "@/lib/store";
import { linkHost } from "@/lib/product-link";
import { everyLabel } from "@/lib/product-recurring";
import { DOWNLOAD_WINDOW_SECONDS, readOrder } from "@/lib/store-checkout";
import { lookStyle } from "@/lib/store-look";
import { canManage } from "@/lib/membership-manage";
import { canMove, confirmBooking, moveLink } from "@/lib/calls";
import { readableTime, roomFor, zoneName } from "@/lib/call-setup";
import { SITE_URL } from "@/lib/site-url";
import { StoreTracking } from "@/components/store-tracking";
import { confirmStock } from "@/lib/stock";
import { finishPlan } from "@/lib/plans";
import { cookies } from "next/headers";
import { UPSELL_COOKIE, funnelView, settleUpsells } from "@/lib/upsell";
import { imageUrl } from "@/lib/product-image";
import { noteSession } from "@/lib/affiliates";
import { recordEnrollment } from "@/lib/learn";
import { noteProduct, upsertContact } from "@/lib/contacts";
import { enroll } from "@/lib/flows";
import { canRecover } from "@/lib/buyer-orders";
import { after } from "next/server";
import { CONFIRM_WITHIN_SECONDS, canConfirm, confirmPurchase } from "@/lib/purchase-email";
import { readConfig } from "@/lib/community";
import { type SaleKey, activeKeys, keyForSale } from "@/lib/licence-keys";
import { renewPath } from "@/lib/membership-access";
import { LicenceKeyBox } from "@/components/licence-key-box";

export const metadata: Metadata = {
  title: "Your order — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  unpaid: {
    title: "This order has not been paid",
    body: "If you closed the card page before finishing, nothing was charged. You can start again from the store.",
  },
  processing: {
    title: "Your payment is on its way",
    body: "Your bank is still confirming it, which can take a few days. Nothing more is needed from you: when it clears, open this page again, or choose \u201cGet it again\u201d at the foot of the store with the address you paid with.",
  },
  expired: {
    title: "This link has expired",
    body: "A download link works for three days. You have not lost what you bought: type the address you paid with on the next page, and a link to all of it is emailed to you.",
  },
  invalid: {
    title: "We could not find this order",
    body: "Check the link you were given, or write to the store.",
  },
  unavailable: {
    title: "This store cannot take payments yet",
    body: "Nothing was charged.",
  },
  error: {
    title: "We could not check this order",
    body: "Nothing is lost. Try the link again in a moment.",
  },
  refunded: {
    title: "This order was refunded",
    body: "The payment was given back in full, so what it bought no longer opens here. If you think this is a mistake, reply to the receipt you were emailed when you paid.",
  },
};

/**
 * Where a buyer lands after paying.
 *
 * It says what was bought and gives the file, and it says nothing it has not
 * confirmed with Stripe first. Landing here is not proof of payment, so this
 * page never treats it as such.
 */
export default async function ThanksPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const sessionId =
    typeof query.session_id === "string" ? query.session_id : undefined;
  const order = await readOrder(store, sessionId);

  // A paid call: the time is written down and the two emails go out, once,
  // however many times this page is opened.
  const booked =
    order.state === "paid" && order.call && order.product.call
      ? {
          ...order.call,
          setup: order.product.call,
          room: roomFor(order.product.call, order.call.start),
          minutes: Math.round((order.call.end - order.call.start) / 60_000),
        }
      : null;
  if (booked && sessionId && order.state === "paid" && order.product.call) {
    await confirmBooking({
      store,
      product: { ...order.product, call: order.product.call },
      session: sessionId,
      start: booked.start,
      end: booked.end,
      buyerEmail: order.email,
      buyerTz: booked.buyerTz,
      moves: booked.moves,
      answers: order.answers,
      origin: SITE_URL,
    }).catch((error) => console.error("confirming a booking failed", error));
  }

  // A payment plan, or a membership with a set number of payments, is given
  // its end the moment its buyer is back; the daily job does the same for
  // anyone who never came back.
  if (order.state === "paid" && sessionId && (order.plan || order.endsAfter > 0) && store.stripeAccountId) {
    await finishPlan(store.stripeAccountId, sessionId).catch((error) => console.error("finishing a plan failed", error));
  }

  // A course is written down as bought, so the student list and the emails
  // about modules opening know about this student from today.
  if (order.state === "paid" && order.product.course && order.email) {
    await recordEnrollment(store, order.email, order.product.id, order.created).catch((error) =>
      console.error("recording a course purchase failed", error),
    );
  }

  // A buyer who ticked the box joins the creator's list, and any sequence
  // that starts with joining or with this product starts for them.
  if (order.state === "paid" && order.news && order.email && store.listId) {
    try {
      const added = await upsertContact(store.listId, order.email, {
        agreed: true,
        explicit: true,
        source: "buyer",
        productId: order.product.id,
        title: order.product.title,
      });
      await enroll(store, order.email, { joined: added.joined, productId: order.product.id });
    } catch (error) {
      console.error("adding a buyer to a list failed", error);
    }
  } else if (order.state === "paid" && order.email && store.listId) {
    // Someone already on the list who buys without the box: nobody new is
    // added, but a sequence about this product starts for them.
    try {
      if (await noteProduct(store.listId, order.email, order.product.id, order.product.title)) {
        await enroll(store, order.email, { joined: false, productId: order.product.id });
      }
    } catch (error) {
      console.error("noting a purchase on a list failed", error);
    }
  }

  // The buyer's confirmation email, sent once whichever of this page and the
  // five-minute job gets there first (lib/purchase-email.ts). After the page
  // is on its way, so it never waits on the sender. A booked call has its own.
  const confirming =
    order.state === "paid" &&
    !booked &&
    canConfirm(store) &&
    Boolean(order.email) &&
    // How old the order is, from what readOrder already worked out.
    DOWNLOAD_WINDOW_SECONDS - order.secondsLeft <= CONFIRM_WITHIN_SECONDS;
  if (confirming && sessionId) {
    after(() =>
      confirmPurchase(store, sessionId).catch((error) => console.error("sending a purchase confirmation failed", error)),
    );
  }

  // A limited product's unit becomes a sale the moment its buyer is back.
  if (order.state === "paid" && sessionId && order.product.stock !== null) {
    await confirmStock(store, order.product, sessionId).catch((error) => console.error("confirming stock failed", error));
  }

  // A sale through an affiliate's link is written down for them, once,
  // with what was paid before tax (the five-minute job does the same for a
  // buyer who never comes back here).
  if (order.state === "paid" && order.record.metadata) {
    await noteSession(store, order.record as Parameters<typeof noteSession>[1]).catch((error) =>
      console.error("noting an affiliate sale failed", error),
    );
  }

  // The offers after paying: any still waiting on an answer are settled
  // first — the bank asked the buyer to confirm one, or Stripe's reply was
  // lost — then the one the buyer is at is shown only to the browser that
  // paid, within the hour, and only after an order paid in one go with a
  // card it can be charged to.
  if (order.state === "paid" && sessionId) await settleUpsells(store, sessionId);
  const upsellSecret = (await cookies()).get(UPSELL_COOKIE)?.value;
  const funnel =
    order.state === "paid" && sessionId
      ? await funnelView({
          store,
          session: sessionId,
          product: order.product,
          alsoOwned: order.bump ? [order.bump.product.id] : [],
          eligible: order.amount > 0 && !order.plan,
          created: order.created,
          secret: upsellSecret,
          upsellKey: order.upsellKey,
        })
      : null;
  const offer = funnel?.offer ?? null;

  // A purchase that opens the creator's community says so, with the way in —
  // counting what was ticked at checkout and what was added after paying, as
  // the community's own door does (lib/community-access.ts).
  const community =
    order.state === "paid" && store.community?.on
      ? await readConfig(store.community.id).catch(() => null)
      : null;
  const opensCommunity =
    order.state === "paid" && community !== null && order.membership !== "ended" &&
    [order.product.id, ...(order.bump ? [order.bump.product.id] : []), ...(funnel?.taken ?? []).map((added) => added.product.id)].some(
      (id) => community.access.includes(id),
    );

  // A membership that has ended hands nothing over, here or anywhere else.
  const ended = order.state === "paid" && order.membership === "ended";

  // Each licence key this order earns: given here if the five-minute job
  // that sends the confirmation has not given it already. A sale only ever
  // gets one key, however many times this page is opened.
  const keyOf = async (product: Product, reference: string): Promise<SaleKey | null | "error"> => {
    if (order.state !== "paid" || ended || !activeKeys(product)) return null;
    try {
      return await keyForSale(store, product, reference, order.email ?? "");
    } catch (error) {
      console.error("giving a licence key failed", error);
      return "error";
    }
  };
  const [mainKey, bumpKey, ...takenKeys] =
    order.state === "paid"
      ? await Promise.all([
          keyOf(order.product, order.reference),
          order.bump ? keyOf(order.bump.product, order.reference) : Promise.resolve(null),
          ...(funnel?.taken ?? []).map((added) => keyOf(added.product, added.reference)),
        ])
      : [null, null];
  const upsellKey = takenKeys.some((found) => found !== null);
  const keyBox = (found: SaleKey | null | "error", title?: string) =>
    found === null ? null : (
      <LicenceKeyBox
        title={title}
        storeName={store.name}
        value={found !== "error" && found.state === "issued" ? found.key : null}
        revoked={found !== "error" && found.state === "issued" && found.revoked}
        waiting={found !== "error" && found.state === "waiting"}
      />
    );

  const notice = order.state !== "paid" ? NOTICES[order.state] : null;
  const hours = order.state === "paid" ? Math.floor(order.secondsLeft / 3600) : 0;

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="st-card p-7 sm:p-10">
          {order.state === "paid" ? (
            <>
              <p className="st-price text-sm">
                Paid
              </p>
              <h1 className="font-display mt-5 text-3xl font-semibold leading-tight sm:text-4xl">
                {booked ? "You are booked" : "Thank you"}
              </h1>
              <p className="st-muted mt-4 text-lg">
                {order.product.recurring
                  ? order.trialDays > 0
                    ? "You started a free trial of "
                    : "You subscribed to "
                  : booked
                    ? "You booked "
                    : "You bought "}
                <strong style={{ color: "var(--st-text)" }}>
                  {order.option
                    ? `${order.product.title} (${order.option.label})`
                    : order.product.title}
                </strong>
                {order.bump ? (
                  <>
                    {" and "}
                    <strong style={{ color: "var(--st-text)" }}>{order.bump.product.title}</strong>
                  </>
                ) : null}{" "}
                from{" "}
                {store.name}
                {order.product.recurring && order.trialDays > 0
                  ? ". Nothing was charged today"
                  : ` for ${
                      order.product.recurring
                        ? `$${centsToPrice(order.amount)} ${everyLabel(order.product.recurring.interval)}`
                        : order.plan
                          ? `$${centsToPrice(order.amount)} today`
                          : `$${centsToPrice(order.amount)}`
                    }`}
                .
              </p>
              {order.product.recurring && order.trialDays > 0 && !ended ? (
                <p
                  className="mt-3 rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                >
                  {`Your first payment of $${centsToPrice(order.option ? order.option.priceCents : order.product.priceCents)}${store.tax.enabled && !store.tax.included ? " plus any sales tax" : ""} is taken when the ${order.trialDays}-day trial ends, on ${new Date((order.created + order.trialDays * 86400) * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}, from the card you gave. Cancel before then and you are not charged at all.`}
                </p>
              ) : null}
              {order.plan ? (
                <p
                  className="mt-3 rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                >
                  {`This is the first of ${order.plan.payments} ${order.plan.interval === "week" ? "weekly" : "monthly"} payments. The other ${order.plan.payments - 1} are charged to the same card on ${store.name}'s own account, and it stops by itself after the last one. To change the card or ask about a payment, reply to the receipt Stripe emailed you.`}
                </p>
              ) : null}
              {order.product.recurring && !ended ? (
                <p
                  className="mt-3 rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                >
                  {canManage(store) ? (
                    <>
                      {order.endsAfter > 0
                        ? `This renews ${everyLabel(order.product.recurring.interval)} for ${order.endsAfter} payments in all and then ends by itself. You can cancel it yourself before that, without writing to anyone: `
                        : `This renews ${everyLabel(order.product.recurring.interval)} until you cancel it, and you can cancel it yourself at any time, without writing to anyone: `}
                      <Link href={`/@${store.handle}/manage`} className="font-semibold underline underline-offset-4">
                        manage your membership
                      </Link>
                      {" with the email you paid with."}
                    </>
                  ) : (
                    `This renews ${everyLabel(order.product.recurring.interval)} ${
                      order.endsAfter > 0 ? `for ${order.endsAfter} payments in all and then ends by itself, unless you cancel it first` : "until you cancel it"
                    }. The charge is made by ${store.name}, on their own account: reply to the receipt Stripe emailed you and it reaches them.`
                  )}
                </p>
              ) : null}

              {ended ? (
                <div className="st-note mt-7" role="status">
                  <p className="font-bold" style={{ color: "var(--st-text)" }}>Your membership has ended</p>
                  <p className="mt-1 text-sm">
                    {`Stripe says this membership is no longer running, so what it gave is closed now. Join again and it opens straight away.`}
                  </p>
                  <Link href={renewPath(store, order.product)} className="btn st-btn mt-4">
                    Renew your membership
                  </Link>
                </div>
              ) : booked ? (
                <>
                  <div
                    className="mt-6 rounded-2xl px-5 py-4"
                    style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                  >
                    <p className="text-lg font-semibold">{readableTime(booked.start, booked.buyerTz)}</p>
                    <p className="mt-1 text-sm">
                      {`${zoneName(booked.start, booked.buyerTz)} \u00b7 ${booked.minutes} minutes`}
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {booked.room ? (
                      <a
                        href={booked.room}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                        className="btn st-btn"
                      >
                        The link to join
                      </a>
                    ) : null}
                    <a
                      href={`/api/store/ics?handle=${encodeURIComponent(store.handle)}&session_id=${encodeURIComponent(sessionId ?? "")}`}
                      className="btn btn-secondary"
                    >
                      Add to your calendar
                    </a>
                  </div>
                  <p className="st-muted mt-5 text-sm">
                    {booked.room
                      ? `Join at that time with the link above. It is also in your confirmation email, with a calendar file.`
                      : `${store.name} will send you the link to join before the call.`}
                    {order.email
                      ? ` A confirmation is on its way to ${order.email}, and a reminder follows a day and an hour before; to cancel, reply to it.`
                      : ""}
                  </p>
                  {sessionId && canMove(booked.setup, booked.start, booked.moves) ? (
                    <p className="st-muted mt-3 text-sm">
                      {"Need another time? "}
                      <a
                        href={moveLink("", store, order.product.id, sessionId)}
                        className="font-semibold underline underline-offset-4"
                        style={{ color: "var(--st-text)" }}
                      >
                        Move your booking
                      </a>
                      {`, up to ${Math.max(booked.setup.noticeHours, 1)} ${Math.max(booked.setup.noticeHours, 1) === 1 ? "hour" : "hours"} before it starts.`}
                    </p>
                  ) : null}
                </>
              ) : order.product.course ? (
                <>
                  <form action="/api/store/course/start" method="post">
                    <input type="hidden" name="handle" value={store.handle} />
                    <input type="hidden" name="session_id" value={sessionId ?? ""} />
                    <button type="submit" className="btn st-btn btn-lg mt-7">Start the course</button>
                  </form>
                  <p className="st-muted mt-5 text-sm">
                    {`On this device it opens straight away. On any other, open ${store.name}'s store, find the course and ask for a link: it goes to ${order.email ?? "the address you paid with"}. No password to make.`}
                  </p>
                </>
              ) : order.link ? (
                <>
                  {/* Shown rather than followed. A buyer who has paid should
                      see where they are about to go before they go there, and
                      this address belongs to the creator, not to us. */}
                  <a
                    href={order.link}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="btn st-btn btn-lg mt-7"
                  >
                    Open what you bought
                  </a>
                  <p className="st-muted mt-5 text-sm">
                    {`It is kept on ${linkHost(order.link)} by ${store.name}, not here. Save the address: `}
                    <span className="break-all font-semibold" style={{ color: "var(--st-text)" }}>
                      {order.link}
                    </span>
                  </p>
                </>
              ) : order.file ? (
                <>
                  <a
                    href={`/api/store/download?handle=${encodeURIComponent(
                      store.handle,
                    )}&session_id=${encodeURIComponent(sessionId ?? "")}`}
                    className="btn st-btn btn-lg mt-7"
                  >
                    Download it
                  </a>

                  <p className="st-muted mt-5 text-sm">
                    This link works for about {hours} more{" "}
                    {hours === 1 ? "hour" : "hours"}. After that it is not lost:
                    choose &ldquo;Get it again&rdquo; at the foot of {store.name}&rsquo;s
                    page, type the address you paid with, and a new link is emailed to you.
                  </p>
                </>
              ) : (
                /*
                  Paid, and there is nothing behind it: the creator took the
                  option away between the payment and this page. Saying so,
                  with the address to write to, is the only honest answer —
                  the money reached the creator's own account, so the creator
                  is who can fix it.
                */
                <p className="mt-7 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-ink">
                  <strong>Your payment went through, and this one has
                  nothing attached to send.</strong> That is on {store.name} to
                  put right, and the charge is on their own Stripe account, so
                  reply to the receipt Stripe emailed you and they will see it.
                </p>
              )}
              {/* What is theirs first — the product, what was ticked at checkout and
                  what was added after paying, each with its key — then the way into
                  the community, and only then the next offer. */}
              {keyBox(mainKey, bumpKey || upsellKey ? order.product.title : undefined)}
              {order.bump ? (
                <div className="mt-6 rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line)" }}>
                  <p className="st-label">Also yours</p>
                  <p className="mt-1 font-semibold">{order.bump.product.title}</p>
                  {order.bump.link ? (
                    <>
                      <a
                        href={order.bump.link}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                        className="btn st-btn mt-3"
                      >
                        Open it
                      </a>
                      <p className="st-muted mt-3 break-all text-sm">{order.bump.link}</p>
                    </>
                  ) : order.bump.file ? (
                    <a
                      href={`/api/store/download?handle=${encodeURIComponent(store.handle)}&session_id=${encodeURIComponent(
                        sessionId ?? "",
                      )}&item=bump`}
                      className="btn st-btn mt-3"
                    >
                      Download it
                    </a>
                  ) : (
                    <p className="st-muted mt-2 text-sm">
                      {`This one has nothing attached right now. Reply to your receipt and ${store.name} will send it.`}
                    </p>
                  )}
                  {keyBox(bumpKey, order.bump.product.title)}
                </div>
              ) : null}
              {funnel?.taken.map((added, index) => (
                <div
                  key={added.slot || "first"}
                  className="mt-6 rounded-2xl px-5 py-4"
                  style={{ border: "1px solid var(--st-line)" }}
                >
                  <p className="st-label">Also yours</p>
                  <p className="mt-1 font-semibold">{added.product.title}</p>
                  {added.product.link ? (
                    <>
                      <a href={added.product.link} rel="noopener noreferrer nofollow" target="_blank" className="btn st-btn mt-3">
                        Open it
                      </a>
                      <p className="st-muted mt-3 break-all text-sm">{added.product.link}</p>
                    </>
                  ) : added.product.file ? (
                    <a
                      href={`/api/store/download?handle=${encodeURIComponent(store.handle)}&session_id=${encodeURIComponent(
                        sessionId ?? "",
                      )}&item=upsell${added.slot ? `&step=${added.slot}` : ""}`}
                      className="btn st-btn mt-3"
                    >
                      Download it
                    </a>
                  ) : null}
                  {keyBox(takenKeys[index] ?? null, added.product.title)}
                </div>
              ))}
              {opensCommunity && community ? (
                <div className="mt-6 rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line)" }}>
                  <p className="st-label">Also yours</p>
                  <p className="mt-1 font-semibold">{community.name}</p>
                  <p className="st-muted mt-1 text-sm">
                    {`This purchase opens ${store.name}'s members' community. Come in with ${order.email ?? "the address you paid with"}: a link is sent there, and there is no password to make.`}
                  </p>
                  <Link href={`/@${store.handle}/community`} className="btn st-btn mt-3">
                    Go to the community
                  </Link>
                </div>
              ) : null}
              {offer && sessionId ? (
                <section
                  aria-labelledby="offer-title"
                  className="mt-7 overflow-hidden rounded-2xl"
                  style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                >
                  {offer.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(offer.image)}
                      alt={offer.image.alt}
                      width={offer.image.width}
                      height={offer.image.height}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : null}
                  <form action="/api/store/upsell" method="post" className="px-5 py-5 sm:px-6">
                    <input type="hidden" name="handle" value={store.handle} />
                    <input type="hidden" name="session_id" value={sessionId} />
                    <input type="hidden" name="step" value={offer.step.id} />
                    <p className="st-label">{offer.afterNo ? "Before you go" : "One more thing"}</p>
                    <h2 id="offer-title" className="mt-1 text-xl font-semibold leading-snug tracking-[-0.01em]">
                      {offer.step.headline || `${offer.target.title} for $${centsToPrice(offer.step.priceCents)}`}
                    </h2>
                    {offer.step.headline ? (
                      <p className="mt-1 text-sm font-semibold">
                        {`${offer.target.title} for $${centsToPrice(offer.step.priceCents)}`}
                      </p>
                    ) : null}
                    {offer.step.text ? <p className="mt-2 text-sm leading-relaxed">{offer.step.text}</p> : null}
                    {offer.step.priceCents < offer.target.priceCents ? (
                      <p className="st-muted mt-1 text-xs">{`$${centsToPrice(offer.target.priceCents)} on its own`}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <button type="submit" name="answer" value="yes" className="btn st-btn">
                        {`Yes, add it for $${centsToPrice(offer.step.priceCents)}`}
                      </button>
                      <button
                        type="submit"
                        name="answer"
                        value="no"
                        className="st-footer-link min-h-[44px] px-1 text-sm font-semibold"
                      >
                        No thanks
                      </button>
                    </div>
                    <p className="st-muted mt-3 text-xs">
                      {`Yes charges the card you just used, once, on ${store.name}'s own account. No thanks charges nothing. You can also simply leave this page.`}
                    </p>
                  </form>
                </section>
              ) : null}
              {funnel?.notes.map((note) => (
                <p key={`${note.state}-${note.title}`} className="st-note mt-6 text-sm" role="status">
                  {note.state === "checking"
                    ? `We are still hearing back from Stripe about ${note.title}. Open this page again in a minute: it is charged once at most, and it appears here as soon as it is paid.`
                    : note.state === "unconfirmed"
                      ? `Your bank has not confirmed ${note.title}, so it was not charged.`
                      : `${note.title} was not charged: your card turned it down. You can still buy it from the store.`}
                </p>
              ))}
              {confirming && order.email ? (
                <p className="st-muted mt-2 text-sm">
                  {`A confirmation from ${store.name} is on its way to ${order.email}, with how to get back to this later. The charge was made on ${store.name}'s own Stripe account, not ours.`}
                </p>
              ) : order.email ? (
                <p className="st-muted mt-2 text-sm">
                  {`You paid with ${order.email}. The charge was made on ${store.name}'s own Stripe account, not ours, so any receipt comes from them.`}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                {notice?.title ?? "We could not find this order"}
              </h1>
              <p className="st-muted mt-4 text-lg">
                {notice?.body ?? "Check the link you were given."}
              </p>
              {order.state === "expired" && canRecover(store) ? (
                <Link href={`/@${store.handle}/orders`} className="btn st-btn btn-lg mt-7">
                  Get what you bought again
                </Link>
              ) : null}
            </>
          )}

          <div className="mt-8">
            <Link
              href={`/@${store.handle}`}
              className="st-footer-link text-sm font-semibold"
            >
              Back to {store.name}
            </Link>
            <StoreTracking
              store={store}
              event={
                order.state === "paid" && sessionId
                  ? {
                      type: "purchase",
                      id: sessionId,
                      value: order.amount / 100,
                      productId: order.product.id,
                      title: order.product.title,
                    }
                  : null
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
