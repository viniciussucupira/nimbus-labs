import type { Store } from "@/lib/store";
import { speech } from "@/lib/buyer-words";
import { tipsWords } from "@/lib/buyer-words/tips";
import { tipAmounts, tipBounds } from "@/lib/store-tips";
import { moneyField } from "@/lib/money";

/**
 * "Support my work" on the store page (lib/store-tips.ts). A plain form, so
 * it works without JavaScript: each of the creator's amounts is a button that
 * goes straight to Stripe's page, and the box beside them takes another. The
 * creator's own heading and line when they wrote one, the store language's
 * words when not. `problem` is what the last try came back with, if anything.
 */
export function StoreTipBox({ store, problem, rehearsal }: { store: Store; problem: string; rehearsal: boolean }) {
  const w = tipsWords(store.language);
  const said = speech(store);
  const amounts = tipAmounts(store.tips, store.currency);
  const { min, max } = tipBounds(store.currency);
  const notice = problem ? w.notices[problem] ?? null : null;
  return (
    <section id="support" aria-labelledby="support-heading" className="st-card mt-8 scroll-mt-8 p-6 sm:p-7">
      <h2 id="support-heading" className="font-display text-xl font-semibold leading-snug">
        {store.tips.heading || w.heading}
      </h2>
      <p className="st-muted mt-2">{store.tips.line || w.line(store.name)}</p>
      {notice ? (
        <div className="st-note mt-4" role="alert">
          <p className="font-bold" style={{ color: "var(--st-text)" }}>{notice.title}</p>
          <p className="mt-1 text-sm">{notice.body}</p>
        </div>
      ) : null}
      <form action="/api/store/tip" method="post" target="_top" className="mt-5">
        <input type="hidden" name="handle" value={store.handle} />
        <fieldset>
          <legend className="text-sm font-semibold">{w.amounts}</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {amounts.map((amount) => (
              <button key={amount} type="submit" name="amount" value={String(amount)} className="btn st-btn w-full">
                {said.money(amount)}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
      {/* A form of its own, so pressing Enter in the box sends what was typed, not the first button's amount. */}
      <form action="/api/store/tip" method="post" target="_top" className="mt-4">
        <input type="hidden" name="handle" value={store.handle} />
        <label htmlFor="support-other" className="block text-sm font-semibold">
          {w.other}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="support-other"
            name="other"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            placeholder={moneyField(amounts[amounts.length - 1] * 2 <= max ? amounts[amounts.length - 1] * 2 : max, store.currency)}
            aria-describedby="support-range"
            className="st-field min-w-0 flex-1"
          />
          <button type="submit" className="btn st-btn-ghost shrink-0">
            {w.button}
          </button>
        </div>
        <p id="support-range" className="st-muted mt-2 text-sm">
          {w.range(said.money(min), said.money(max))} {w.secure}
        </p>
        {rehearsal ? <p className="st-muted mt-1 text-sm font-semibold">{w.testMode}</p> : null}
      </form>
    </section>
  );
}
