import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { formatMoney } from "@/lib/money";
import { previewSwitch } from "@/lib/tier-switch";

export const metadata: Metadata = {
  title: "Switch your membership — Nimbus Labs",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const PROBLEMS: Record<string, { title: string; body: string }> = {
  expired: { title: "This link has expired", body: "A link to your membership works for one hour. Ask for a new one on your membership page." },
  gone: { title: "This membership cannot switch", body: "It may be canceled, set to end, waiting on a payment, or no longer yours on this link. Nothing was changed." },
  tier: { title: "That plan is not offered anymore", body: "Go back to your membership page to see the plans you can switch to now. Nothing was changed." },
  error: { title: "Stripe could not work out the price just now", body: "Nothing was changed. Try again in a moment." },
};

/**
 * What a switch to another tier costs, in Stripe's own figures, before
 * anything happens (lib/tier-switch.ts). Opening this page changes nothing;
 * only its button does.
 */
export default async function SwitchPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const query = await searchParams;
  const read = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
  const token = read("token");
  const sub = read("sub");
  const to = read("to");
  const result = await previewSwitch(store, token, sub, to);
  const back = `/@${store.handle}/manage${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen overflow-hidden`} style={lookStyle(store.look) as React.CSSProperties}>
      <main id="content" className="relative mx-auto max-w-xl px-4 py-14 sm:py-20">
        <p className="st-muted text-center text-sm font-semibold">{store.name}</p>
        <div className="st-card mt-6 p-6 sm:p-9">
          {result.ok ? (
            <>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">{`Switch to ${result.preview.to.title}`}</h1>
              <ul className="mt-6 space-y-3">
                <li className="st-row">
                  <div className="min-w-0">
                    <p className="st-muted text-xs font-semibold uppercase tracking-wide">Now</p>
                    <p className="font-bold" style={{ color: "var(--st-text)" }}>{result.preview.from.title}</p>
                    <p className="st-muted text-sm">{result.preview.from.words}</p>
                  </div>
                </li>
                <li className="st-row">
                  <div className="min-w-0">
                    <p className="st-muted text-xs font-semibold uppercase tracking-wide">After the switch</p>
                    <p className="font-bold" style={{ color: "var(--st-text)" }}>{result.preview.to.title}</p>
                    <p className="st-muted text-sm">{result.preview.to.words}</p>
                  </div>
                </li>
              </ul>
              <div className="st-note mt-6">
                <p className="font-bold" style={{ color: "var(--st-text)" }}>
                  {result.preview.trialing
                    ? "Nothing is charged now"
                    : result.preview.due > 0
                      ? `${formatMoney(result.preview.due, result.preview.currency)} charged today`
                      : result.preview.due < 0
                        ? `${formatMoney(-result.preview.due, result.preview.currency)} comes off your next payments`
                        : "Nothing is charged today"}
                </p>
                <p className="mt-1 text-sm">
                  {result.preview.trialing
                    ? "You are in your free trial. The new plan opens now, and its price starts when the trial ends."
                    : result.preview.due > 0
                      ? "The new price, less what was left of your last payment, to the card you pay with. The new plan opens as soon as it is paid."
                      : result.preview.due < 0
                        ? "What was left of your last payment becomes a credit with the store, taken off your next payments. The new plan opens now."
                        : "The new plan opens now."}
                </p>
              </div>
              <form action="/api/store/manage/switch" method="post" className="mt-6">
                <input type="hidden" name="handle" value={store.handle} />
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="sub" value={result.preview.sub} />
                <input type="hidden" name="to" value={result.preview.to.id} />
                <input type="hidden" name="at" value={String(result.preview.at)} />
                <button type="submit" className="btn st-btn btn-lg btn-block">
                  {result.preview.due > 0 && !result.preview.trialing ? `Switch and pay ${formatMoney(result.preview.due, result.preview.currency)}` : "Switch now"}
                </button>
              </form>
              <p className="st-muted mt-4 text-sm">
                {`This price holds for 15 minutes. Charged by ${store.name} on their own Stripe account. Anything only ${result.preview.from.title} includes closes when you switch.`}
              </p>
            </>
          ) : (
            <div className="st-note">
              <p className="font-bold" style={{ color: "var(--st-text)" }}>{PROBLEMS[result.reason].title}</p>
              <p className="mt-1 text-sm">{PROBLEMS[result.reason].body}</p>
            </div>
          )}
        </div>
        <div className="mt-8 text-center">
          <Link href={back} className="st-footer-link text-sm font-semibold">
            Back to your membership
          </Link>
        </div>
      </main>
    </div>
  );
}
