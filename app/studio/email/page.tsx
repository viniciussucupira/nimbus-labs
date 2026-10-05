import type { Metadata } from "next";
import { aiLeft, isAiConfigured } from "@/lib/ai";
import { productLink } from "@/lib/checkout-recovery";
import { readTitles } from "@/lib/catalog";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { studioPath, studioView } from "@/lib/studio-route";
import { StudioHeader } from "@/components/studio-header";
import { StudioStorePin } from "@/components/studio-store-pin";
import { listCounts } from "@/lib/contacts";
import { listBroadcasts } from "@/lib/broadcasts";
import { broadcastMoney, flowMoney, readMailRevenue } from "@/lib/mail-revenue";
import { flowStats, readFlows } from "@/lib/flows";
import { inTrial, monthlyAllowance, usedThisMonth } from "@/lib/mail";
import { PRO_MONTHLY_EMAILS, TRIAL_DAYS, TRIAL_MONTHLY_EMAILS, priceWords, yearSaving } from "@/lib/plan";
import { EmailStudio } from "@/components/email-studio";
import { listDrafts } from "@/lib/mail-drafts";
import { can } from "@/lib/team-roles";
import { trialOffered } from "@/lib/billing";

type Params = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export const metadata: Metadata = {
  title: "Email — Marktmorgen",
  robots: { index: false, follow: false },
};

/** Writing to the people who agreed to hear from the creator. */
export default async function StudioEmailPage({ searchParams }: Params) {
  const query = await searchParams;
  // Which store, and whether this person's role there has "draft" (lib/studio-route.ts).
  const found = await studioView(await cookies(), typeof query.store === "string" ? query.store : undefined, "draft");
  if (!found.ok) {
    if (found.reason === "signed_out") redirect("/signin");
    redirect(found.store ? studioPath(found.store, "team=forbidden") : "/studio");
  }
  const { view } = found;
  const { store } = view;

  const allowance = monthlyAllowance(store);
  const [counts, used, broadcasts, flows, listings, drafts] = await Promise.all([
    listCounts(store.listId),
    usedThisMonth(store.listId),
    listBroadcasts(store.listId),
    readFlows(store.listId),
    // The names of the products a flow or a broadcast can be about: one
    // command, where reading every card was one per product (lib/catalog.ts).
    readTitles(store),
    listDrafts(store.listId),
  ]);
  const role = view.role;
  // What each email sold, from the creator's own Stripe account, cached for
  // ten minutes (lib/mail-revenue.ts). Asked only when something was sent.
  const [stats, revenue] = await Promise.all([
    flowStats(flows),
    broadcasts.length || flows.length ? readMailRevenue(store) : Promise.resolve(null),
  ]);
  const trial = allowance > 0 && inTrial(store);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <StudioHeader
        current={store}
        role={view.role}
        stores={view.stores}
        owned={view.owned}
        action={{ href: studioPath(store), label: "Back to the studio", short: "Studio" }}
      />
      <StudioStorePin sid={store.sid}>

      <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
        <p className="eyebrow">Email</p>
        <h1 className="t-h2 mt-3">Write to your list</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Only the people who agreed to hear from you are written to: those who checked the box when they got
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
            {!can(role, "billing") ? (
              <p className="mt-5 rounded-[var(--r-md)] bg-sand p-4 text-sm text-ink-soft">
                The store&apos;s owner chooses its plan. When they move it to Pro, email opens here for you too.
              </p>
            ) : store.subscriptionActive ? (
              <form action={`/api/billing/switch?store=${store.sid}`} method="post" className="mt-5">
                <input type="hidden" name="tier" value="pro" />
                <input type="hidden" name="cycle" value={store.cycle} />
                <button type="submit" className="btn btn-primary">Move up to Pro</button>
              </form>
            ) : (
              <form action={`/api/billing/checkout?store=${store.sid}`} method="post" className="mt-5 flex flex-col items-start gap-3">
                <input type="hidden" name="tier" value="pro" />
                <button type="submit" name="cycle" value="month" className="btn btn-primary btn-wrap">
                  {trialOffered(store)
                    ? `Start the ${TRIAL_DAYS}-day trial on Pro — ${priceWords("pro", "month")} after that`
                    : `Start Pro — ${priceWords("pro", "month")}, from today`}
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
            email={view.email}
            canSend={can(role, "send")}
            canSettings={can(role, "settings")}
            canExport={can(role, "export")}
            drafts={drafts.map(({ id, subject, body, productId, by, savedAt }) => ({ id, subject, body, productId, by, savedAt }))}
            name={store.name}
            mail={store.mail}
            counts={counts}
            used={used}
            allowance={allowance}
            trial={trial}
            products={[...listings].map(([id, title]) => ({ id, title }))}
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
              tagged: b.tagged,
              money: broadcastMoney(revenue, b.id),
            }))}
            currency={store.currency}
            flows={flows.map((f) => ({ ...f, stats: stats.get(f.id) ?? { started: 0, sent: 0 }, money: flowMoney(revenue, f.id) }))}
            links={Object.fromEntries([...listings].map(([id]) => [id, productLink(store, id)]))}
            ai={isAiConfigured() && can(role, "draft") ? { on: true, left: await aiLeft(store).catch(() => 0) } : { on: false, left: 0 }}
          />
        )}
      </main>
      </StudioStorePin>
    </div>
  );
}
