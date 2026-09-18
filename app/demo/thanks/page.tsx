import type { Metadata } from "next";
import Link from "next/link";
import { rememberOrder } from "@/lib/demo-recover";
import {
  DEMO_PRODUCT,
  formatPrice,
  getDemoOrder,
  type DemoOrder,
} from "@/lib/demo-store";

export const metadata: Metadata = {
  title: "Your order — Harbor Kitchen demo store",
  robots: { index: false, follow: false },
};

const NOT_PAID: Record<
  Exclude<DemoOrder["state"], "paid">,
  { title: string; body: string }
> = {
  unpaid: {
    title: "Payment not confirmed yet",
    body: "Stripe has not confirmed this payment, so the file is not available. If you just paid, refresh this page in a moment.",
  },
  expired: {
    title: "This download link has expired",
    body: "Download links work for 3 days after checkout.",
  },
  invalid: {
    title: "We could not find this order",
    body: "The link may be incomplete. Go back to the store and try again.",
  },
  unavailable: {
    title: "The demo checkout is not set up yet",
    body: "The store owner still needs to connect Stripe test mode. Please try again later.",
  },
  error: {
    title: "We could not check your order",
    body: "Something went wrong on our side. Refresh this page in a moment.",
  },
};

export default async function DemoThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : undefined;
  const status = typeof params.status === "string" ? params.status : "";

  const order: DemoOrder =
    status === "unavailable" || status === "error"
      ? { state: status }
      : await getDemoOrder(sessionId);

  // Remember which order this address bought, so the buyer can ask for the
  // link again later instead of losing what they paid for. It lives exactly as
  // long as the download does.
  if (order.state === "paid" && sessionId) {
    await rememberOrder(order.email, sessionId, order.secondsLeft);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <div
        aria-hidden="true"
        className="nb-blob absolute -left-16 top-0 h-56 w-56 bg-violet-brand/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="nb-blob absolute -right-16 top-32 h-56 w-56 bg-pink-brand/20 blur-3xl"
      />
      <main id="content" className="relative mx-auto w-full max-w-md px-4 py-16">
        <div className="rounded-3xl border-2 border-ink/10 bg-white p-8 shadow-xl shadow-ink/5">
          {order.state === "paid" ? (
            <>
              <p aria-hidden="true" className="nb-float text-4xl">
                🎉
              </p>
              <p className="mt-2 text-sm font-bold uppercase tracking-wider text-mint-deep">
                Payment confirmed
              </p>
              <h1 className="font-display mt-2 text-2xl font-black">
                Thank you! Your file is ready.
              </h1>
              <p className="mt-3 text-ink-soft">
                You paid {formatPrice(order.amount)} for {DEMO_PRODUCT.name},{" "}
                {order.option.label}.
              </p>
              <a
                href={`/api/demo/download?session_id=${encodeURIComponent(sessionId ?? "")}`}
                className="mt-6 block rounded-full bg-gradient-to-r from-violet-brand to-pink-brand px-6 py-4 text-center text-lg font-bold text-white shadow-lg shadow-violet-brand/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-brand"
              >
                Download the PDF
              </a>
              <p className="mt-3 text-center text-sm text-ink-soft">
                {order.option.detail}. This link works for 3 days.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-black">
                {NOT_PAID[order.state].title}
              </h1>
              <p className="mt-3 text-ink-soft">
                {NOT_PAID[order.state].body}
              </p>
              {order.state === "expired" || order.state === "invalid" ? (
                <Link
                  href="/demo/recover"
                  className="mt-6 block rounded-full bg-ink px-6 py-3.5 text-center font-bold text-white transition hover:-translate-y-0.5"
                >
                  Send me the link again
                </Link>
              ) : null}
            </>
          )}
        </div>

        <p className="mt-8 text-center text-sm">
          <Link
            href="/demo"
            className="inline-block py-2 font-bold text-violet-deep underline underline-offset-2"
          >
            Back to the store
          </Link>
          <span aria-hidden="true" className="px-2 text-ink-soft">
            ·
          </span>
          <Link
            href="/demo/recover"
            className="inline-block py-2 font-bold text-violet-deep underline underline-offset-2"
          >
            Lost your download?
          </Link>
        </p>
      </main>
    </div>
  );
}
