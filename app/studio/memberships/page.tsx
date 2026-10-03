import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { studioPath, studioView } from "@/lib/studio-route";
import { StudioHeader } from "@/components/studio-header";
import { StudioStorePin } from "@/components/studio-store-pin";
import { membershipNumbers } from "@/lib/membership-numbers";
import { readListings } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Membership numbers — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

const percent = (n: number) => `${Math.round(n * 1000) / 10}%`;

/**
 * Recurring revenue, members, churn and trials (lib/membership-numbers.ts),
 * read from the creator's own Stripe account. Whoever may see the store's
 * numbers sees this.
 */
export default async function StudioMembershipsPage({ searchParams }: Params) {
  const query = await searchParams;
  const found = await studioView(await cookies(), typeof query.store === "string" ? query.store : undefined, "stats");
  if (!found.ok) {
    if (found.reason === "signed_out") redirect("/signin");
    redirect(found.store ? studioPath(found.store, "team=forbidden") : "/studio");
  }
  const { view: access } = found;
  const { store } = access;
  const numbers = await membershipNumbers(store, query.fresh === "1").catch((error) => {
    console.error("reading membership numbers failed", error);
    return null;
  });
  const titles = numbers ? new Map((await readListings(store, numbers.byProduct.map((p) => p.product))).map((p) => [p.id, p.title])) : new Map();
  const money = (cents: number) => formatMoney(cents, numbers?.currency ?? store.currency);
  const when = numbers
    ? new Date(numbers.at * 1000).toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })
    : "";

  const tiles = numbers
    ? [
        { label: "Monthly recurring revenue", value: money(numbers.mrr), note: `${money(numbers.mrr * 12)} a year at this rate` },
        { label: "Paying members", value: String(numbers.paying), note: numbers.trialing ? `and ${numbers.trialing} in a free trial` : "none in a free trial" },
        {
          label: "Churn, last 30 days",
          value: numbers.churn30 === null ? "—" : percent(numbers.churn30),
          note: `${numbers.ended30} ended, ${money(numbers.endedMrr30)} a month`,
        },
        {
          label: "Trials that became paying",
          value: numbers.trialsEnded ? percent(numbers.trialsConverted / numbers.trialsEnded) : "—",
          note: numbers.trialsEnded ? `${numbers.trialsConverted} of ${numbers.trialsEnded} in the last 90 days` : "no trial ended in the last 90 days",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <StudioHeader
        current={store}
        role={access.role}
        stores={access.stores}
        owned={access.owned}
        action={{ href: studioPath(store), label: "Back to the studio", short: "Studio" }}
      />
      <StudioStorePin sid={store.sid}>
        <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
          <p className="eyebrow">Membership numbers</p>
          <h1 className="t-h2 mt-3">How your memberships are doing</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Read from your own Stripe account: every membership of this store it holds. Payment plans are not memberships and
            are left out.
          </p>

          {!store.stripeAccountId ? (
            <p className="notice notice-info mt-6">Connect your Stripe account, and your memberships are counted here.</p>
          ) : numbers === null ? (
            <p className="notice notice-error mt-6" role="alert">
              Stripe could not be read just now. Nothing was changed. Try again in a moment.
            </p>
          ) : (
            <>
              <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tiles.map((t) => (
                  <div key={t.label} className="card p-5">
                    <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-mute">{t.label}</dt>
                    <dd className="mt-2 text-2xl font-semibold tabular-nums text-ink">{t.value}</dd>
                    <dd className="mt-1 text-sm text-ink-soft">{t.note}</dd>
                  </div>
                ))}
              </dl>

              {numbers.atRisk > 0 ? (
                <p className="notice notice-warn mt-6">
                  {`${numbers.atRisk} paying ${numbers.atRisk === 1 ? "member's" : "members'"} latest payment failed and Stripe is retrying it: ${money(numbers.atRiskMrr)} a month. `}
                  Each is emailed once with a link that pays it.
                </p>
              ) : null}

              <section aria-labelledby="by-title" className="card mt-8 p-6 sm:p-8">
                <h2 id="by-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">By membership</h2>
                {numbers.byProduct.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">No membership is running right now.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-[0.08em] text-ink-mute">
                          <th scope="col" className="py-2 pr-4 font-semibold">Membership</th>
                          <th scope="col" className="py-2 pr-3 text-right font-semibold">Paying</th>
                          <th scope="col" className="py-2 pr-4 text-right font-semibold">Trial</th>
                          <th scope="col" className="py-2 text-right font-semibold">Monthly</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {numbers.byProduct.map((p) => (
                          <tr key={p.product}>
                            <th scope="row" className="py-2.5 pr-4 font-semibold text-ink">{titles.get(p.product) ?? "A membership you have since removed"}</th>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{p.members}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{p.trialing}</td>
                            <td className="py-2.5 text-right tabular-nums">{money(p.mrr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section aria-labelledby="how-title" className="card mt-8 p-6 sm:p-8">
                <h2 id="how-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">How each number is worked out</h2>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                  <li>Monthly recurring revenue: every paying membership at its list price, before discounts and tax, as a month — a yearly one counts a twelfth. Members in a free trial are not in it until they pay.</li>
                  <li>Churn: of the memberships that were paying 30 days ago, the share that has ended since.</li>
                  <li>Trials that became paying: of the free trials that ended in the last 90 days, those still running a day after.</li>
                  {numbers.elsewhere ? <li>{`${numbers.elsewhere} running ${numbers.elsewhere === 1 ? "membership is" : "memberships are"} in a currency other than your store's, and ${numbers.elsewhere === 1 ? "is" : "are"} not in the sums.`}</li> : null}
                  {!numbers.complete ? <li>Your Stripe account holds more memberships than one reading takes, so the oldest are not counted.</li> : null}
                </ul>
                <p className="mt-4 text-sm text-ink-soft">
                  {`As read at ${when}. `}
                  <Link href={studioPath(store, "fresh=1", "memberships")} className="font-semibold text-violet-deep underline underline-offset-4">
                    Read it again now
                  </Link>
                </p>
              </section>
            </>
          )}
        </main>
      </StudioStorePin>
    </div>
  );
}
