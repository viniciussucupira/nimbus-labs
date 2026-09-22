import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { photoUrl } from "@/lib/photo-limits";
import { linkHost } from "@/lib/product-link";
import { type Delivery, type Purchase, canRecover, ordersGrant, purchasesFor } from "@/lib/buyer-orders";

export const metadata: Metadata = {
  title: "Your purchases — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const NOTICES: Record<string, { title: string; body: string }> = {
  email: {
    title: "That does not look like an email address",
    body: "Check it and try again. Use the address you paid with; it is the one your receipt went to.",
  },
  limited: {
    title: "Too many requests for now",
    body: "To keep this form from being used to flood somebody's inbox, it takes a limited number of requests an hour. Try again in an hour.",
  },
  unavailable: {
    title: "This store cannot do this here",
    body: "Its payments are not connected to Stripe right now. Reply to the receipt you were emailed when you paid, and it reaches the store.",
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

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

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
  const store = await storeForHandle(normaliseHandle(decoded));
  if (!store) notFound();

  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const status = typeof query.status === "string" ? query.status : "";
  const email = token ? await ordersGrant(store, token) : null;
  const available = canRecover(store);

  let purchases: Purchase[] | null = null;
  let failed = false;
  if (email) {
    try {
      purchases = await purchasesFor(store, email);
    } catch (error) {
      console.error("listing purchases failed", error);
      failed = true;
    }
  }
  const notice = token && !email ? NOTICES.expired : failed ? NOTICES.error : NOTICES[status] ?? null;

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
        {`If that address bought something from ${store.name}, a link to all of it arrives in a minute and works for 24 hours. We say the same thing whether or not it did, so nobody can use this page to find out who bought what.`}
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
              {purchases.length === 0 ? (
                <p className="st-muted mt-4 text-lg leading-relaxed">
                  {`There is nothing to open here any more. A purchase that was refunded, or a membership that has ended, is no longer listed. If something is missing, reply to the receipt you were emailed when you paid, and it reaches ${store.name}.`}
                </p>
              ) : (
                <>
                  <p className="st-muted mt-4 leading-relaxed">
                    {`Everything ${store.name} sold to this address that can be opened again, newest first. Each download starts a fresh copy, so there is nothing to keep.`}
                  </p>
                  <ul className="mt-7 space-y-4">
                    {purchases.map((purchase) => (
                      <li key={purchase.reference} className="rounded-2xl p-5" style={{ border: "1px solid var(--st-line)" }}>
                        <p className="font-semibold">{purchase.title}</p>
                        <p className="st-muted mt-1 text-sm">
                          {[
                            purchase.option,
                            purchase.member ? "Membership, still running" : null,
                            purchase.kind === "upsell" ? "Added after paying" : null,
                            purchase.paidAt ? `Bought on ${DATE.format(new Date(purchase.paidAt * 1000))}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <div className="mt-4 space-y-3">
                          {purchase.courseProduct ? (
                            <Link href={`/@${store.handle}/course/${purchase.courseProduct}`} className="btn st-btn btn-block">
                              Open the course
                            </Link>
                          ) : null}
                          {purchase.main ? (
                            <DeliveryButton handle={store.handle} token={token} purchase={purchase} delivery={purchase.main} item="main" />
                          ) : null}
                          {purchase.bump ? (
                            <DeliveryButton handle={store.handle} token={token} purchase={purchase} delivery={purchase.bump} item="bump" />
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="st-muted mt-6 text-sm">
                    This page works for 24 hours from the email. After that, ask again below whenever you need it.
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
                {`If that address bought something from ${store.name}, the link is on its way. It comes from ${store.name} via Nimbus Labs and usually arrives within a minute. If it is not there, look in spam.`}
              </p>
              <p className="st-muted mt-4 text-sm">
                Nothing arrived? You may have paid with a different address. It is the one your receipt went to. Try that one below.
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
                  ? `Lost a download, or changed phone? Type the email you paid ${store.name} with and we send you a link to everything you bought here. No account and no password.`
                  : `${store.name} cannot take payments through Stripe right now, so there is nothing to look up from here. Reply to the receipt you were emailed when you paid, and it reaches them.`}
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
