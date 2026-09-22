import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { centsToPrice, normaliseHandle, storeForHandle } from "@/lib/store";
import { linkHost } from "@/lib/product-link";
import { everyLabel } from "@/lib/product-recurring";
import { readOrder } from "@/lib/store-checkout";
import { lookStyle } from "@/lib/store-look";
import { canManage } from "@/lib/membership-manage";
import { confirmBooking } from "@/lib/calls";
import { readableTime, zoneName } from "@/lib/call-setup";
import { SITE_URL } from "@/lib/site-url";
import { StoreTracking } from "@/components/store-tracking";
import { confirmStock } from "@/lib/stock";
import { cookies } from "next/headers";
import { activeUpsell } from "@/lib/product-extras";
import { UPSELL_COOKIE, offerOpen, readUpsell, settleUpsell, upsellDelivery } from "@/lib/upsell";

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
  expired: {
    title: "This link has expired",
    body: "A download link works for three days. Write to the store and they can sort it out with you.",
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
      ? { ...order.call, setup: order.product.call }
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
      origin: SITE_URL,
    }).catch((error) => console.error("confirming a booking failed", error));
  }

  // A limited product's unit becomes a sale the moment its buyer is back.
  if (order.state === "paid" && sessionId && order.product.stock !== null) {
    await confirmStock(store, order.product, sessionId).catch((error) => console.error("confirming stock failed", error));
  }

  // The one-click offer: settled first if the bank asked the buyer to confirm
  // it, then shown only to the browser that paid, within the hour, once.
  if (order.state === "paid" && sessionId && query.upsell === "back") await settleUpsell(store, sessionId);
  const upsellOffer = order.state === "paid" ? activeUpsell(store.products, order.product) : null;
  const upsellRecord = upsellOffer && sessionId ? await readUpsell(sessionId) : null;
  const upsellSecret = (await cookies()).get(UPSELL_COOKIE)?.value;
  const showOffer =
    order.state === "paid" && upsellOffer !== null && upsellRecord === null && offerOpen(order.created, upsellSecret, order.upsellKey ?? undefined);
  const upsold = order.state === "paid" && sessionId ? await upsellDelivery(store, sessionId) : null;
  const upsellMissed = upsellRecord !== null && upsellRecord.state !== "paid";

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
                {order.product.recurring ? "You subscribed to " : booked ? "You booked " : "You bought "}
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
                {store.name} for{" "}
                {order.product.recurring
                  ? `$${centsToPrice(order.amount)} ${everyLabel(
                      order.product.recurring.interval,
                    )}`
                  : `$${centsToPrice(order.amount)}`}
                .
              </p>
              {order.product.recurring ? (
                <p
                  className="mt-3 rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                >
                  {canManage(store) ? (
                    <>
                      {`This renews ${everyLabel(order.product.recurring.interval)} until you cancel it, and you can cancel it yourself at any time, without writing to anyone: `}
                      <Link href={`/@${store.handle}/manage`} className="font-semibold underline underline-offset-4">
                        manage your membership
                      </Link>
                      {" with the email you paid with."}
                    </>
                  ) : (
                    `This renews ${everyLabel(
                      order.product.recurring.interval,
                    )} until you cancel it. The charge is made by ${store.name}, on their own account: reply to the receipt Stripe emailed you and it reaches them.`
                  )}
                </p>
              ) : null}

              {booked ? (
                <>
                  <div
                    className="mt-6 rounded-2xl px-5 py-4"
                    style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                  >
                    <p className="text-lg font-semibold">{readableTime(booked.start, booked.buyerTz)}</p>
                    <p className="mt-1 text-sm">
                      {`${zoneName(booked.start, booked.buyerTz)} \u00b7 ${booked.setup.minutes} minutes`}
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {booked.setup.room ? (
                      <a
                        href={booked.setup.room}
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
                    {booked.setup.room
                      ? `Join at that time with the link above. It is also in your confirmation email, with a calendar file.`
                      : `${store.name} will send you the link to join before the call.`}
                    {order.email
                      ? ` A confirmation is on its way to ${order.email}; to move or cancel the call, reply to it.`
                      : ""}
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
                    {hours === 1 ? "hour" : "hours"}. Keep the page, or keep the
                    email Stripe sent you — it has the same link.
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
                </div>
              ) : null}
              {showOffer && upsellOffer ? (
                <form
                  action="/api/store/upsell"
                  method="post"
                  className="mt-7 rounded-2xl px-5 py-5"
                  style={{ background: "var(--st-accent-soft)", color: "var(--st-text)" }}
                >
                  <input type="hidden" name="handle" value={store.handle} />
                  <input type="hidden" name="session_id" value={sessionId ?? ""} />
                  <p className="st-label">One more thing</p>
                  <p className="mt-1 text-lg font-semibold">
                    {`${upsellOffer.target.title} for $${centsToPrice(upsellOffer.bump.priceCents)}`}
                  </p>
                  {upsellOffer.bump.pitch ? <p className="mt-1 text-sm">{upsellOffer.bump.pitch}</p> : null}
                  {upsellOffer.bump.priceCents < upsellOffer.target.priceCents ? (
                    <p className="st-muted mt-1 text-xs">{`$${centsToPrice(upsellOffer.target.priceCents)} on its own`}</p>
                  ) : null}
                  <button type="submit" className="btn st-btn mt-4">
                    {`Add it for $${centsToPrice(upsellOffer.bump.priceCents)}`}
                  </button>
                  <p className="st-muted mt-3 text-xs">
                    {`One press charges the card you just used, on ${store.name}'s own account. Nothing else is charged, and you can simply leave this page.`}
                  </p>
                </form>
              ) : null}
              {upsold ? (
                <div className="mt-6 rounded-2xl px-5 py-4" style={{ border: "1px solid var(--st-line)" }}>
                  <p className="st-label">Also yours</p>
                  <p className="mt-1 font-semibold">{upsold.product.title}</p>
                  {upsold.link ? (
                    <>
                      <a href={upsold.link} rel="noopener noreferrer nofollow" target="_blank" className="btn st-btn mt-3">
                        Open it
                      </a>
                      <p className="st-muted mt-3 break-all text-sm">{upsold.link}</p>
                    </>
                  ) : upsold.file ? (
                    <a
                      href={`/api/store/download?handle=${encodeURIComponent(store.handle)}&session_id=${encodeURIComponent(
                        sessionId ?? "",
                      )}&item=upsell`}
                      className="btn st-btn mt-3"
                    >
                      Download it
                    </a>
                  ) : null}
                </div>
              ) : upsellMissed && upsellOffer ? (
                <p className="st-note mt-6 text-sm" role="status">
                  {upsellRecord?.state === "pending"
                    ? `Your bank has not confirmed ${upsellOffer.target.title}, so it was not charged.`
                    : `${upsellOffer.target.title} was not charged: your card turned it down. You can still buy it from the store.`}
                </p>
              ) : null}
              {order.email ? (
                <p className="st-muted mt-2 text-sm">
                  Your receipt went to {order.email}. It comes from {store.name},
                  because the charge was made on their account, not ours.
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
