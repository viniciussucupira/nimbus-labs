import { feedToken } from "@/lib/podcast-access";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Store, normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { linkHost } from "@/lib/product-link";
import { type BookedCall, type Delivery, type Purchase, callsFor, canRecover, ordersGrant, purchasesFor } from "@/lib/buyer-orders";
import { readableTime, zoneName } from "@/lib/call-setup";
import { canMove, icsLink, moveLink } from "@/lib/calls";
import { VIDEO_ROOM_NOTE, isVideoRoom, roomLabel } from "@/lib/call-rooms";
import { type SaleKey, activeKeys, keyForSale } from "@/lib/licence-keys";
import { renewPath } from "@/lib/membership-access";
import { LicenceKeyBox } from "@/components/licence-key-box";
import { readListing, readListings } from "@/lib/catalog";
import { reviewable } from "@/lib/review-proof";
import { takesReviews } from "@/lib/house-store";
import { type PurchaseItems } from "@/lib/buyer-orders";
import { BundleDelivery } from "@/components/bundle-delivery";

export const metadata: Metadata = {
  title: "Your purchases — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. Use the address you paid with: the one you typed at checkout.",
  },
  limited: {
    title: "Too many requests for now",
    body: "To keep this form from being used to flood somebody's inbox, it takes a limited number of requests an hour. Try again in an hour.",
  },
  unavailable: {
    title: "This store cannot look up purchases right now",
    body: "Its payments are not connected to Stripe right now. Reply to the order confirmation you were emailed when you paid, and it reaches the store.",
  },
  error: {
    title: "Something went wrong on our side",
    body: "Nothing was changed. Try again in a moment.",
  },
  expired: {
    title: "This link has expired",
    body: "A link to your purchases works for 24 hours. Ask for a new one below; it takes a few seconds.",
  },
};

const DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function DeliveryButton({
  handle,
  token,
  purchase,
  delivery,
  item,
}: {
  handle: string;
  token: string;
  purchase: Purchase;
  delivery: Delivery;
  item: "main" | "bump";
}) {
  if (delivery.link) {
    return (
      <span className="block">
        <a href={delivery.link} rel="noopener noreferrer" target="_blank" className="btn st-btn btn-block">
          {`Open ${item === "bump" ? delivery.title : "it"}`}
        </a>
        <span className="st-muted mt-2 block break-all text-xs">{`Kept on ${linkHost(delivery.link)}: ${delivery.link}`}</span>
      </span>
    );
  }
  const query = new URLSearchParams({ handle, ref: purchase.reference, token });
  if (item === "bump") query.set("item", "bump");
  return (
    <a href={`/api/store/download?${query}`} className="btn st-btn btn-block">
      {item === "bump" ? `Download ${delivery.title}` : "Download it"}
    </a>
  );
}

/**
 * A call still to come: when, in the buyer's own time zone, where to join,
 * and the calendar file and the way to move it, as in the booking email.
 */
function BookedCallCard({ call, store }: { call: BookedCall; store: Store }) {
  const video = isVideoRoom(call.room);
  const minutes = Math.round((call.end - call.start) / 60_000);
  return (
    <li className="rounded-2xl p-5" style={{ border: "1px solid var(--st-line)" }}>
      <p className="font-semibold">{call.title}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--st-text)" }}>
        {readableTime(call.start, call.buyerTz)}
      </p>
      <p className="st-muted text-sm">{`${zoneName(call.start, call.buyerTz)} \u00b7 ${minutes} minutes`}</p>
      <div className="mt-4 space-y-3">
        {call.room ? (
          <a href={call.room} rel="noopener noreferrer nofollow" target="_blank" className="btn st-btn btn-block">
            {roomLabel(call.room)}
          </a>
        ) : (
          <p className="st-muted text-sm">{`${store.name} sends you the link to join before the call.`}</p>
        )}
        {video ? <p className="st-muted text-xs leading-relaxed">{VIDEO_ROOM_NOTE}</p> : null}
        <a href={icsLink("", store, call.session)} className="btn btn-secondary btn-block">
          Add it to your calendar
        </a>
        {canMove(call.setup, call.start, call.moves) ? (
          <p className="text-center text-sm">
            <a href={moveLink("", store, call.productId, call.session)} className="st-footer-link font-semibold">
              Move it to another time
            </a>
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Where a buyer gets back what they bought, without an account.
 *
 * Two visits to the same page. The first asks for the address they paid with.
 * The second comes from the link in the email and lists every purchase that
 * address made here, each read from the creator's own Stripe account as the
 * page opens.
 */
export default async function OrdersPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const status = typeof query.status === "string" ? query.status : "";
  const email = token ? await ordersGrant(store, token) : null;
  const available = canRecover(store);

  let purchases: Purchase[] | null = null;
  let calls: BookedCall[] = [];
  let failed = false;
  if (email) {
    try {
      [purchases, calls] = await Promise.all([purchasesFor(store, email), callsFor(store, email)]);
    } catch (error) {
      console.error("listing purchases failed", error);
      failed = true;
    }
  }
  const notice = token && !email ? NOTICES.expired : failed ? NOTICES.error : NOTICES[status] ?? null;

  // A private podcast opens as this address's own feed (lib/podcast-access.ts).
  const feeds = new Map<string, string>();
  if (email && purchases) {
    for (const pid of new Set(purchases.filter((p) => p.podcastProduct && !p.ended).map((p) => p.podcastProduct as string))) {
      const feed = await feedToken(store, pid, email).catch(() => null);
      if (feed) feeds.set(pid, feed);
    }
  }

  // The license key of each purchase that has one, read — or given, if the
  // thanks page and the confirmation email never got the chance — per sale.
  const keys = new Map<string, SaleKey | "error">();
  if (email && purchases) {
    const wanted: { slot: string; productId: string; reference: string }[] = [];
    for (const purchase of purchases) {
      // Nothing brought over from another platform was sold here, so no key is given for it.
      if (purchase.ended || purchase.kind === "imported") continue;
      wanted.push({ slot: `${purchase.reference}|main`, productId: purchase.productId, reference: purchase.reference });
      if (purchase.bumpId) wanted.push({ slot: `${purchase.reference}|bump`, productId: purchase.bumpId, reference: purchase.reference });
      // Each product of a bundle has its own key, under the same order.
      for (const line of [...(purchase.items?.lines ?? []), ...(purchase.bumpItems?.lines ?? [])]) {
        wanted.push({ slot: `${purchase.reference}|item|${line.productId}`, productId: line.productId, reference: purchase.reference });
      }
    }
    await Promise.all(
      wanted.map(async ({ slot, productId, reference }) => {
        const product = await readListing(store, productId);
        if (!product || !activeKeys(product)) return;
        try {
          const key = await keyForSale(store, product, reference, email);
          if (key) keys.set(slot, key);
        } catch (error) {
          console.error("reading a license key failed", error);
          keys.set(slot, "error");
        }
      }),
    );
  }
  // Which of them can be reviewed, their products read in one go (lib/catalog.ts):
  // what was bought, what was ticked with it and what a bundle held. Not what
  // was brought over from another platform: no payment here proves it.
  const inOrder = (purchase: Purchase) => [
    purchase.productId,
    ...(purchase.bumpId ? [purchase.bumpId] : []),
    ...(purchase.items?.lines ?? []).map((line) => line.productId),
    ...(purchase.bumpItems?.lines ?? []).map((line) => line.productId),
  ];
  const canReview = new Set(
    email && purchases && takesReviews(store)
      ? (await readListings(store, purchases.filter((p) => p.kind !== "imported").flatMap(inOrder))).filter(reviewable).map((p) => p.id)
      : [],
  );
  const reviewableIn = (purchase: Purchase) => purchase.kind !== "imported" && inOrder(purchase).some((id) => canReview.has(id));
  const contents = (purchase: Purchase, items: PurchaseItems | null, bump: boolean) =>
    items ? (
      <BundleDelivery
        storeName={store.name}
        missing={items.missing}
        heading={bump ? `Inside ${purchase.bump?.title ?? "what you added"}` : "What is inside"}
        lines={items.lines.map((line) => ({
          product: { id: line.productId, title: line.title, link: line.delivery?.link ?? null },
          download: line.delivery?.file
            ? `/api/store/download?${new URLSearchParams({ handle: store.handle, ref: purchase.reference, token, pid: line.productId, ...(bump ? { item: "bump" } : {}) })}`
            : null,
          course: line.courseProduct ? { href: `/@${store.handle}/course/${line.courseProduct}` } : null,
          keyBox: keyBox(`${purchase.reference}|item|${line.productId}`, line.title),
        }))}
      />
    ) : null;
  const keyBox = (slot: string, title?: string) => {
    const found = keys.get(slot);
    if (!found) return null;
    return (
      <LicenceKeyBox
        title={title}
        storeName={store.name}
        value={found !== "error" && found.state === "issued" ? found.key : null}
        revoked={found !== "error" && found.state === "issued" && found.revoked}
        waiting={found !== "error" && found.state === "waiting"}
      />
    );
  };

  const form = (
    <form action="/api/store/orders" method="post" className="mt-7 space-y-3">
      <input type="hidden" name="handle" value={store.handle} />
      <div aria-hidden="true" className="hidden">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label htmlFor="orders-email" className="st-label">
        The email you paid with
      </label>
      <input
        id="orders-email"
        type="email"
        name="email"
        required
        maxLength={254}
        autoComplete="email"
        placeholder="you@example.com"
        className="st-field"
      />
      <button type="submit" className="btn st-btn btn-block">
        Email me my purchases
      </button>
      <p className="st-muted text-sm">
        {`If that address bought something from ${store.name}, a link to all of it usually arrives within a minute and works for 24 hours. We say the same thing whether or not it did, so nobody can use this page to find out who bought what.`}
      </p>
    </form>
  );

  return (
    <div
      className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`}
      style={lookStyle(store.look) as React.CSSProperties}
    >
      <main id="content" className="relative mx-auto max-w-xl px-4 py-14 sm:py-20">
        <div className="text-center">
          {store.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(store.photoId)} alt="" width={72} height={72} className="st-avatar" style={{ width: 72, height: 72 }} />
          ) : (
            <p aria-hidden="true" className="st-avatar st-avatar-initial" style={{ width: 72, height: 72, fontSize: "1.75rem" }}>
              {store.name.slice(0, 1).toUpperCase()}
            </p>
          )}
          <p className="st-muted mt-4 text-sm font-semibold">{store.name}</p>
        </div>

        <div className="st-card mt-6 p-6 sm:p-9">
          {email && purchases ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                Your purchases
              </h1>
              {calls.length > 0 ? (
                <section aria-labelledby="calls-title" className="mt-6">
                  <h2 id="calls-title" className="font-display text-xl font-semibold">
                    {calls.length === 1 ? "Your booked call" : "Your booked calls"}
                  </h2>
                  <ul className="mt-4 space-y-4">
                    {calls.map((call) => (
                      <BookedCallCard key={call.session} call={call} store={store} />
                    ))}
                  </ul>
                </section>
              ) : null}
              {purchases.length === 0 && calls.length > 0 ? null : purchases.length === 0 ? (
                <p className="st-muted mt-4 text-lg leading-relaxed">
                  {`There is nothing to open here anymore. A purchase that was refunded in full is no longer listed. If something is missing, reply to the order confirmation you were emailed when you paid, and it reaches ${store.name}.`}
                </p>
              ) : (
                <>
                  <p className="st-muted mt-4 leading-relaxed">
                    {`Everything ${store.name} sold to this address that can be opened again, newest first. Open or download any of it again whenever you need it.`}
                  </p>
                  <ul className="mt-7 space-y-4">
                    {purchases.map((purchase) => (
                      <li key={purchase.reference} className="rounded-2xl p-5" style={{ border: "1px solid var(--st-line)" }}>
                        <p className="font-semibold">{purchase.title}</p>
                        <p className="st-muted mt-1 text-sm">
                          {[
                            purchase.option,
                            purchase.member ? "Membership, still running" : null,
                            purchase.ended ? "Membership, ended" : null,
                            purchase.kind === "upsell" ? "Added after paying" : null,
                            purchase.kind === "imported" && purchase.giftFrom
                              ? `A gift from ${purchase.giftFrom}${purchase.paidAt ? `, on ${DATE.format(new Date(purchase.paidAt * 1000))}` : ""}`
                              : purchase.place
                              ? `A place somebody bought for you${purchase.paidAt ? `, taken on ${DATE.format(new Date(purchase.paidAt * 1000))}` : ""}`
                              : purchase.paidWith === "paypal"
                              ? `Bought on ${DATE.format(new Date(purchase.paidAt * 1000))}, paid with PayPal`
                              : purchase.kind === "imported"
                              ? `Brought over from another platform${purchase.paidAt ? ` on ${DATE.format(new Date(purchase.paidAt * 1000))}` : ""}`
                              : purchase.paidAt
                                ? `Bought on ${DATE.format(new Date(purchase.paidAt * 1000))}`
                                : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <div className="mt-4 space-y-3">
                          {purchase.ended ? (
                            <>
                              <p className="st-muted text-sm">
                                This membership is no longer running, so what it gave you access to is closed now. Renew it and everything opens again right away.
                              </p>
                              <Link href={renewPath(store, { id: purchase.productId })} className="btn st-btn btn-block">
                                Renew your membership
                              </Link>
                            </>
                          ) : null}
                          {purchase.courseProduct ? (
                            <Link href={`/@${store.handle}/course/${purchase.courseProduct}`} className="btn st-btn btn-block">
                              Open the course
                            </Link>
                          ) : null}
                          {typeof purchase.packageLeft === "number" ? (
                            purchase.packageBook ? (
                              <Link href={purchase.packageBook} className="btn st-btn btn-block">
                                {`Book a session (${purchase.packageLeft} left)`}
                              </Link>
                            ) : (
                              <p className="st-muted text-sm">{purchase.packageExpired ? "The time to book this package's sessions has passed." : "Every session of this package is booked."}</p>
                            )
                          ) : null}
                          {purchase.podcastProduct && feeds.has(purchase.podcastProduct) ? (
                            <Link href={`/@${store.handle}/podcast/${purchase.podcastProduct}?t=${feeds.get(purchase.podcastProduct)}`} className="btn st-btn btn-block">
                              Add the podcast to your app
                            </Link>
                          ) : null}
                          {purchase.main ? (
                            <DeliveryButton handle={store.handle} token={token} purchase={purchase} delivery={purchase.main} item="main" />
                          ) : null}
                          {purchase.bump ? (
                            <DeliveryButton handle={store.handle} token={token} purchase={purchase} delivery={purchase.bump} item="bump" />
                          ) : null}
                        </div>
                        {purchase.kind === "imported" && !purchase.giftFrom && !purchase.paidWith && !purchase.place ? (
                          <p className="st-muted mt-3 text-xs leading-relaxed">
                            {`${store.name} moved this here from the platform you bought it on. Nothing was charged here and there is no receipt from this store for it.`}
                          </p>
                        ) : null}
                        {contents(purchase, purchase.items, false)}
                        {contents(purchase, purchase.bumpItems, true)}
                        {keyBox(`${purchase.reference}|main`, keys.has(`${purchase.reference}|bump`) ? purchase.title : undefined)}
                        {purchase.bump ? keyBox(`${purchase.reference}|bump`, purchase.bump.title) : null}
                        {!purchase.ended && reviewableIn(purchase) ? (
                          <p className="mt-4 text-sm">
                            <Link
                              prefetch={false}
                              href={`/@${store.handle}/review?${new URLSearchParams({ token, ref: purchase.reference })}`}
                              className="st-footer-link font-semibold underline underline-offset-4"
                            >
                              {purchase.bump || purchase.items ? "Review what you bought" : `Review ${purchase.title}`}
                            </Link>
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="st-muted mt-6 text-sm">
                    This page works for 24 hours from the email. After that, open it again and ask for a new link whenever you need one.
                  </p>
                </>
              )}
            </>
          ) : status === "sent" ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                Check your inbox
              </h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {`If that address bought something from ${store.name}, the link is on its way. It comes from ${store.name} via Marktmorgen and usually arrives within a minute. If it is not there, look in spam.`}
              </p>
              <p className="st-muted mt-4 text-sm">
                Nothing arrived? You may have paid with a different address: the one you typed at checkout. Try that one below.
              </p>
              {available ? form : null}
            </>
          ) : (
            <>
              {notice ? (
                <div className="st-note mb-6" role={notice === NOTICES.error ? "alert" : undefined}>
                  <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
                  <p className="mt-1 text-sm">{notice.body}</p>
                </div>
              ) : null}
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
                Get what you bought again
              </h1>
              <p className="st-muted mt-4 text-lg leading-relaxed">
                {available
                  ? `Lost a download, or got a new phone? Type the email you paid ${store.name} with, and we will email you a link to everything you bought here. No account and no password.`
                  : `${store.name} cannot take payments through Stripe right now, so there is nothing to look up from here. Reply to the order confirmation you were emailed when you paid, and it reaches them.`}
              </p>
              {available ? form : null}
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href={`/@${store.handle}`} className="st-footer-link text-sm font-semibold">
            {`Back to ${store.name}`}
          </Link>
        </div>
      </main>
    </div>
  );
}
