import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { centsToPrice, normaliseHandle, storeForHandle } from "@/lib/store";
import { linkHost } from "@/lib/product-link";
import { readOrder } from "@/lib/store-checkout";

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

  const notice = order.state !== "paid" ? NOTICES[order.state] : null;
  const hours = order.state === "paid" ? Math.floor(order.secondsLeft / 3600) : 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-mint-brand/25 blur-3xl"
      />

      <main id="content" className="relative mx-auto max-w-xl px-4 py-16">
        <div className="rounded-[2rem] border-2 border-ink/5 bg-white p-7 shadow-xl shadow-ink/5 sm:p-10">
          {order.state === "paid" ? (
            <>
              <p className="inline-flex items-center gap-2 rounded-full bg-mint-brand px-4 py-1.5 text-sm font-black text-mint-deep">
                <span aria-hidden="true">✓</span> Paid
              </p>
              <h1 className="font-display mt-5 text-3xl font-black leading-tight sm:text-4xl">
                Thank you
              </h1>
              <p className="mt-4 text-lg text-ink-soft">
                You bought{" "}
                <strong className="text-ink">{order.product.title}</strong> from{" "}
                {store.name} for {`$${centsToPrice(order.amount)}`}.
              </p>

              {order.product.link ? (
                <>
                  {/* Shown rather than followed. A buyer who has paid should
                      see where they are about to go before they go there, and
                      this address belongs to the creator, not to us. */}
                  <a
                    href={order.product.link}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="mt-7 inline-block rounded-full bg-ink px-7 py-4 text-base font-bold text-white transition hover:-translate-y-0.5"
                  >
                    Open what you bought
                  </a>
                  <p className="mt-5 text-sm text-ink-soft">
                    {`It is kept on ${linkHost(order.product.link)} by ${store.name}, not here. Save the address: `}
                    <span className="break-all font-semibold text-ink">
                      {order.product.link}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <a
                    href={`/api/store/download?handle=${encodeURIComponent(
                      store.handle,
                    )}&session_id=${encodeURIComponent(sessionId ?? "")}`}
                    className="mt-7 inline-block rounded-full bg-ink px-7 py-4 text-base font-bold text-white transition hover:-translate-y-0.5"
                  >
                    Download it
                  </a>

                  <p className="mt-5 text-sm text-ink-soft">
                    This link works for about {hours} more{" "}
                    {hours === 1 ? "hour" : "hours"}. Keep the page, or keep the
                    email Stripe sent you — it has the same link.
                  </p>
                </>
              )}
              {order.email ? (
                <p className="mt-2 text-sm text-ink-soft">
                  Your receipt went to {order.email}. It comes from {store.name},
                  because the charge was made on their account, not ours.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">
                {notice?.title ?? "We could not find this order"}
              </h1>
              <p className="mt-4 text-lg text-ink-soft">
                {notice?.body ?? "Check the link you were given."}
              </p>
            </>
          )}

          <div className="mt-8">
            <Link
              href={`/@${store.handle}`}
              className="text-sm font-semibold text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Back to {store.name}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
