import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { centsToPrice, storeForEmail } from "@/lib/store";
import { canBeBumped, isOneOff } from "@/lib/product-extras";
import { MAX_FUNNEL_STEPS } from "@/lib/funnel";
import { imageUrl } from "@/lib/product-image";
import { FunnelEditor } from "@/components/funnel-editor";

export const metadata: Metadata = {
  title: "Funnels — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

/**
 * What each product offers after it is paid for: up to five one-click offers
 * in a row, each with a way on for yes and for no thanks. On every plan.
 */
export default async function StudioFunnelsPage({ searchParams }: Params) {
  const cookieStore = await cookies();
  const email = await emailForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect("/signin");
  const store = await storeForEmail(email);
  if (!store) redirect("/studio");

  // Only a plain one-off sale can be followed by offers.
  const owners = store.products.filter((p) => isOneOff(p));
  const query = await searchParams;
  const asked = typeof query.product === "string" ? query.product : "";
  const selected =
    owners.find((p) => p.id === asked) ?? owners.find((p) => p.funnel !== null) ?? owners[0] ?? null;
  const offerable = store.products
    .filter((p) => canBeBumped(p))
    .map((p) => ({
      id: p.id,
      title: p.title,
      priceCents: p.priceCents,
    }));
  const pictures = store.products
    .filter((p) => p.image)
    .map((p) => ({ id: p.id, title: p.title, src: imageUrl(p.image!) }));

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
        <p className="eyebrow">Funnels</p>
        <h1 className="t-h2 mt-3">Offers after they pay</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {`Right after paying, the buyer sees one offer at a time on their thanks page, up to ${MAX_FUNNEL_STEPS} per product. Each offer has a yes and a no thanks, and you choose where each one leads: another offer, a cheaper one after a no, or the end. Yes charges the card they just used, in one press, on your own Stripe account.`}
        </p>

        {store.tax.enabled ? (
          <div className="notice notice-warn mt-6">
            <p className="font-bold text-ink">Nothing is offered after paying while sales tax is on</p>
            <p className="mt-1 text-sm text-ink-soft">
              A one-click charge cannot carry Stripe Tax, so buyers are not shown these offers. What you set here is kept and
              is shown again the moment tax is off.
            </p>
          </div>
        ) : null}

        {owners.length === 0 ? (
          <div className="card mt-8 p-6 sm:p-8">
            <p className="text-lg font-semibold tracking-[-0.02em] text-ink">Nothing to follow yet</p>
            <p className="mt-2 text-ink-soft">
              Offers follow a one-off paid product: a download, a link or a course. Add one in the studio and it appears here.
            </p>
            <Link href="/studio#products" className="btn btn-primary mt-5">Go to products</Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            <nav aria-label="Products" className="card min-w-0 p-3 lg:sticky lg:top-24">
              <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-mute">After buying</p>
              <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] lg:block lg:space-y-1 lg:overflow-visible">
                {owners.map((p) => {
                  const on = p.id === selected?.id;
                  const count = p.funnel?.steps.length ?? 0;
                  return (
                    <li key={p.id} className="shrink-0 lg:shrink">
                      <Link
                        href={`/studio/funnels?product=${p.id}`}
                        aria-current={on ? "page" : undefined}
                        className={`flex min-h-[44px] items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-sm transition-colors ${
                          on ? "bg-lilac text-violet-ink" : "text-ink-soft hover:bg-paper hover:text-ink"
                        }`}
                      >
                        <span className="max-w-[14rem] truncate font-semibold">{p.title}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                            count ? "bg-mint-soft text-mint-deep" : "bg-sand text-ink-mute"
                          }`}
                        >
                          {count ? `${count} ${count === 1 ? "offer" : "offers"}` : "None"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {selected ? (
              <FunnelEditor
                key={selected.id}
                owner={{ id: selected.id, title: selected.title, priceCents: selected.priceCents }}
                initial={selected.funnel}
                offerable={offerable.filter((p) => p.id !== selected.id)}
                pictures={pictures}
                ownerPrice={`$${centsToPrice(selected.priceCents)}`}
              />
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
