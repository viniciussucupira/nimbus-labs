import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { storeForEmail } from "@/lib/store";
import { listCounts } from "@/lib/contacts";
import { listBroadcasts } from "@/lib/broadcasts";
import { flowStats, readFlows } from "@/lib/flows";
import { inTrial, monthlyAllowance, usedThisMonth } from "@/lib/mail";
import { PRO_MONTHLY_EMAILS, TRIAL_DAYS, TRIAL_MONTHLY_EMAILS, priceWords, yearSaving } from "@/lib/plan";
import { EmailStudio } from "@/components/email-studio";

export const metadata: Metadata = {
  title: "Email — Nimbus Labs",
  robots: { index: false, follow: false },
};

/** Writing to the people who agreed to hear from the creator. */
export default async function StudioEmailPage() {
  const cookieStore = await cookies();
  const email = await emailForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect("/signin");
  const store = await storeForEmail(email);
  if (!store) redirect("/studio");

  const allowance = monthlyAllowance(store);
  const [counts, used, broadcasts, flows] = await Promise.all([
    listCounts(store.listId),
    usedThisMonth(store.listId),
    listBroadcasts(store.listId),
    readFlows(store.listId),
  ]);
  const stats = await flowStats(flows);
  const trial = allowance > 0 && inTrial(store);

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
        <p className="eyebrow">Email</p>
        <h1 className="t-h2 mt-3">Write to your list</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Only the people who agreed to hear from you are written to: those who ticked the box when they got
          something free or bought from you, and those you import who agreed elsewhere. Every email carries a
          one-click unsubscribe, and anyone who leaves is never written to again.
        </p>

        {allowance === 0 ? (
          <div className="card mt-8 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold tracking-[-0.02em] text-ink">Part of Pro</p>
              <span className="tag tag-brand">{priceWords("pro", "month")}</span>
            </div>
            <ul className="mt-4 space-y-2 text-ink-soft">
              <li>One-off emails to everyone on your list, or only to those who got one product.</li>
              <li>Emails scheduled for the day and time you choose.</li>
              <li>Sequences that go out by themselves, hours or days after someone joins or buys.</li>
              <li>{`Up to ${PRO_MONTHLY_EMAILS.toLocaleString("en-US")} emails a month, sent from your name, with replies coming to you.`}</li>
              <li>Import the list you already have, and take it with you as a file whenever you like.</li>
            </ul>
            <p className="mt-4 text-sm text-ink-soft">
              {`${priceWords("pro", "month")}, or ${priceWords("pro", "year")} — $${yearSaving("pro") / 100} less. Everything else in your store stays exactly as it is.`}
            </p>
            {store.subscriptionActive ? (
              <form action="/api/billing/switch" method="post" className="mt-5">
                <input type="hidden" name="tier" value="pro" />
                <input type="hidden" name="cycle" value={store.cycle} />
                <button type="submit" className="btn btn-primary">Move up to Pro</button>
              </form>
            ) : (
              <form action="/api/billing/checkout" method="post" className="mt-5 flex flex-col items-start gap-3">
                <input type="hidden" name="tier" value="pro" />
                <button type="submit" name="cycle" value="month" className="btn btn-primary btn-wrap">
                  {`Start the ${TRIAL_DAYS}-day trial on Pro — ${priceWords("pro", "month")} after that`}
                </button>
                <button type="submit" name="cycle" value="year" className="btn btn-secondary btn-wrap">
                  {`Or Pro yearly: ${priceWords("pro", "year")}`}
                </button>
              </form>
            )}
            <p className="mt-3 text-sm text-ink-soft">
              {`During the free trial a store sends up to ${TRIAL_MONTHLY_EMAILS.toLocaleString("en-US")} emails a month; the full ${PRO_MONTHLY_EMAILS.toLocaleString("en-US")} opens with the first payment.`}
            </p>
          </div>
        ) : (
          <EmailStudio
            email={store.email}
            name={store.name}
            mail={store.mail}
            counts={counts}
            used={used}
            allowance={allowance}
            trial={trial}
            products={store.products.map((p) => ({ id: p.id, title: p.title }))}
            broadcasts={broadcasts.map((b) => ({
              id: b.id,
              subject: b.subject,
              status: b.status,
              sendAt: b.sendAt,
              finishedAt: b.finishedAt,
              total: b.total,
              sent: b.sent,
              note: b.note,
              productId: b.productId,
            }))}
            flows={flows.map((f) => ({ ...f, stats: stats.get(f.id) ?? { started: 0, sent: 0 } }))}
          />
        )}
      </main>
    </div>
  );
}
