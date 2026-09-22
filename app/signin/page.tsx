import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { SignInForm } from "@/components/signin-form";
import { isConnectConfigured } from "@/lib/stripe-connect";

export const metadata: Metadata = {
  title: "Start your store — Nimbus Labs",
  description:
    "Start a Nimbus Labs store, or open the one you have, with a link sent to your email. No password to invent.",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, { title: string; body: string }> = {
  expired: {
    title: "That link no longer works",
    body: "A sign-in link works once and lasts 15 minutes. Ask for a fresh one below.",
  },
  out: {
    title: "You are signed out",
    body: "Your session is closed on this device.",
  },
  "move-none": {
    title: "That move no longer makes sense",
    body: "The store it was carrying is not there any more. Nothing was changed.",
  },
  "move-same": {
    title: "That is already the address in charge",
    body: "Nothing was changed.",
  },
  "move-taken": {
    title: "That address already has a store",
    body: "An account cannot be moved on top of another one. Nothing was changed.",
  },
  "move-error": {
    title: "The move did not finish",
    body: "Nothing was changed. Sign in and try again.",
  },
  "out-everywhere": {
    title: "You are signed out everywhere",
    body: "Every session you had open is closed, on every device. A fresh link signs you back in.",
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const notice = NOTICES[status];

  return (
    <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="surface-night nb-grid-lines on-dark hidden flex-col justify-between p-10 lg:flex xl:p-14">
        <Link href="/" className="w-fit rounded-[10px]" aria-label="Nimbus Labs, home">
          <Logo tone="light" />
        </Link>
        <div className="max-w-md">
          <p className="t-h2 balance text-white">
            Your store. Your <span className="serif font-normal text-[#cfc4ff]">Stripe.</span> Your money.
          </p>
          <ul className="mt-10 space-y-5 text-white/75">
            {[
              { icon: "mail" as const, text: "No password. A link sent to your email signs you in." },
              { icon: "bank" as const, text: "Your buyers pay into your own Stripe account." },
              { icon: "percent" as const, text: "Nimbus takes 0% of your sales." },
            ].map((item) => (
              <li key={item.text} className="flex gap-3">
                <span className="icon-tile icon-tile-sm">
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="pt-1.5">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link href="/demo" className="link-arrow on-dark w-fit text-[0.9375rem]">
          See the live demo store first
          <Icon name="arrow-right" size={16} className="arrow" />
        </Link>
      </aside>

      <main id="content" className="flex min-h-screen flex-col px-4 py-8 sm:px-8 lg:min-h-0 lg:justify-center lg:py-16">
        <Link href="/" className="w-fit rounded-[10px] lg:hidden" aria-label="Nimbus Labs, home">
          <Logo />
        </Link>

        <div className="mx-auto w-full max-w-md flex-1 pt-12 lg:flex-none lg:pt-0">
          <h1 className="t-h1">Start your store</h1>
          <p className="mt-4 text-ink-soft">
            Type your email and we send a link. It opens your store if you already have one, and starts one if you do
            not. There is no password here, on purpose, and nothing to pay to begin.
          </p>

          {notice ? (
            <div className="notice notice-warn mt-6" role="status">
              <p className="font-semibold">{notice.title}</p>
              <p className="mt-1">{notice.body}</p>
            </div>
          ) : null}

          <div className="card mt-8 p-6 sm:p-8">
            <SignInForm />
          </div>

          <div className="mt-8 flex gap-3 text-[0.9375rem] text-ink-soft">
            <Icon name="info" size={18} className="mt-0.5 shrink-0 text-violet-deep" />
            <p>
              <span className="font-semibold text-ink">
                {isConnectConfigured() ? "Creator stores are open. " : "Creator stores are not open yet. "}
              </span>
              Behind this page you take your address, write your products, upload the file each one delivers and connect
              your own Stripe account.{" "}
              {isConnectConfigured()
                ? "Your buyers pay on that account, and the file is handed over the moment Stripe confirms it."
                : "What is still missing is the checkout itself — the page that charges your buyer on that account."}{" "}
              <Link href="/mission" className="link">
                What is built so far
              </Link>
            </p>
          </div>
        </div>

        <p className="mx-auto mt-12 w-full max-w-md text-sm text-ink-mute">
          By continuing you agree to the{" "}
          <Link href="/terms" className="link font-medium">
            Terms
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className="link font-medium">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
