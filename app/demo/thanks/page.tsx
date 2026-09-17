import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
          {order.state === "paid" ? (
            <>
              <p className="text-sm font-medium uppercase tracking-wider text-teal-800">
                Payment confirmed
              </p>
              <h1 className="mt-2 text-2xl font-bold">
                Thank you! Your file is ready.
              </h1>
              <p className="mt-3 text-stone-700">
                You paid {formatPrice(order.amount)} for {DEMO_PRODUCT.name},{" "}
                {order.option.label}.
              </p>
              <a
                href={`/api/demo/download?session_id=${encodeURIComponent(sessionId ?? "")}`}
                className="mt-6 block rounded-full bg-teal-800 px-6 py-4 text-center text-lg font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                Download the PDF
              </a>
              <p className="mt-3 text-center text-sm text-stone-600">
                {order.option.detail}. This link works for 3 days.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">
                {NOT_PAID[order.state].title}
              </h1>
              <p className="mt-3 text-stone-700">
                {NOT_PAID[order.state].body}
              </p>
            </>
          )}
        </div>

        <p className="mt-8 text-center">
          <Link
            href="/demo"
            className="inline-block py-2 font-medium underline underline-offset-2"
          >
            Back to the store
          </Link>
        </p>
      </main>
    </div>
  );
}
