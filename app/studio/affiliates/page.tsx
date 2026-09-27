import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { storeForEmail } from "@/lib/store";
import { affiliateLink, readBook } from "@/lib/affiliates";
import { isSenderConfigured } from "@/lib/email";
import { canSell } from "@/lib/store-checkout";
import { AffiliateStudio } from "@/components/affiliate-studio";

export const metadata: Metadata = {
  title: "Affiliates — Nimbus Labs",
  robots: { index: false, follow: false },
};

/**
 * The creator's affiliate programme: its terms, who applied, who is owed
 * what, and a record of what the creator paid them. On every plan. The money
 * never passes through Nimbus: the creator pays their affiliates themselves.
 */
export default async function StudioAffiliatesPage() {
  const cookieStore = await cookies();
  const email = await emailForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect("/signin");
  const store = await storeForEmail(email);
  if (!store) redirect("/studio");

  const book = await readBook(store).catch((error) => {
    console.error("reading the affiliate book failed", error);
    return null;
  });
  const titles = new Map(store.products.map((p) => [p.id, p.title]));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-3">
          <Link href="/" className="shrink-0 rounded-[10px]" aria-label="Nimbus Labs, home">
            <Logo />
          </Link>
          <Link href="/studio" className="btn btn-secondary btn-sm">Back to the studio</Link>
        </div>
      </header>

      <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
        <p className="eyebrow">Affiliates</p>
        <h1 className="t-h2 mt-3">People who sell for you</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Anyone can apply on your affiliate page; you decide who is in. Each affiliate gets their own link, and a single
          purchase made through it within your window earns them the share you set, worked out from what the buyer paid
          before tax and taken back if you refund the sale.
        </p>

        {!canSell(store) ? (
          <div className="notice notice-warn mt-6">
            <p className="font-bold text-ink">Your store is not selling yet</p>
            <p className="mt-1 text-sm text-ink-soft">
              You can set the programme up now. Sales are credited to affiliates once your Stripe account is connected and
              your plan is running.
            </p>
          </div>
        ) : null}
        {!isSenderConfigured() ? (
          <div className="notice notice-warn mt-6">
            <p className="font-bold text-ink">Applications are closed on this deployment</p>
            <p className="mt-1 text-sm text-ink-soft">Email is not switched on here, and applying works through an emailed link.</p>
          </div>
        ) : null}
        {book === null ? (
          <p className="notice notice-error mt-6" role="alert">
            We could not read your affiliates just now. Nothing was changed. Try again in a moment.
          </p>
        ) : null}

        <AffiliateStudio
          handle={store.handle}
          setting={store.affiliates}
          products={store.products
            .filter((p) => p.priceCents > 0)
            .map((p) => ({ id: p.id, title: p.title, credited: p.recurring === null }))}
          rows={(book?.rows ?? []).map((row) => ({
            ...row,
            link: affiliateLink(store, row.affiliate.code),
          }))}
          lines={(book?.lines ?? []).slice(0, 100).map((line) => ({
            ref: line.ref,
            at: line.at,
            title: line.title || titles.get(line.product) || "A product that is no longer listed",
            aff: line.aff,
            base: line.base,
            refunded: line.refunded,
            rate: line.rate,
            commission: line.commission,
            status: line.status,
          }))}
          payouts={book?.payouts ?? []}
          refundsChecked={book?.refundsChecked ?? true}
          today={new Date().toISOString().slice(0, 10)}
        />
      </main>
    </div>
  );
}
