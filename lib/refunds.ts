/**
 * What a refund takes back, decided in one place.
 *
 * A buyer who is refunded in full has been given their money back, and what
 * they bought closes for them the same way everywhere Marktmorgen hands it over:
 *
 *   - the download on the thanks page, and the emailed link to it, stop
 *     working on the next request (lib/store-checkout.ts, readOrder, which
 *     reads the payment from Stripe every time);
 *   - the list of purchases leaves it off (lib/buyer-orders.ts);
 *   - the course closes within ten minutes, the time Stripe's answer about a
 *     student is kept (lib/learn.ts);
 *   - the community closes within five, for the same reason
 *     (lib/community-access.ts);
 *   - a licence key given for it is marked revoked by the five-minute job,
 *     which reads the refunds made on the creator's account
 *     (lib/licence-keys.ts, revokeRefunded), so the creator's own software
 *     hears "revoked" from the public check.
 *
 * The rule is the same for all of them: the payment was refunded in full,
 * as Stripe says on the charge. A partial refund keeps access, because the
 * creator chose to keep part of the price, and the buyer keeps what it paid
 * for. A payment added in one click after checkout is its own payment and
 * is judged on its own; a product ticked at checkout is part of the
 * checkout's payment and goes with it.
 *
 * What a refund cannot take back: a file already saved, and a product
 * delivered as a link to somewhere else — once the buyer has the address,
 * only the creator can close it there.
 */
import { onAccount } from "@/lib/stripe-account";

type ChargeLike = { refunded?: unknown; amount?: unknown; amount_refunded?: unknown };

function chargeRefunded(charge: ChargeLike): boolean {
  if (charge.refunded === true) return true;
  const amount = typeof charge.amount === "number" ? charge.amount : 0;
  const back = typeof charge.amount_refunded === "number" ? charge.amount_refunded : 0;
  return amount > 0 && back >= amount;
}

/**
 * Whether Stripe says this payment was given back in full.
 *
 * Takes a PaymentIntent read with its latest charge expanded, or a Charge
 * itself. Anything Stripe did not expand, or did not send, counts as not
 * refunded: only Stripe saying so closes a door.
 */
export function refundedInFull(payment: unknown): boolean {
  if (!payment || typeof payment !== "object") return false;
  const value = payment as { object?: unknown; latest_charge?: unknown } & ChargeLike;
  if (value.object === "charge") return chargeRefunded(value);
  const charge = value.latest_charge;
  if (charge && typeof charge === "object") return chargeRefunded(charge as ChargeLike);
  return false;
}

type SessionLike = {
  mode?: unknown;
  invoice?: unknown;
  payment_intent?: unknown;
  metadata?: Record<string, string> | null | unknown;
};

const INVOICE_ID = /^in_[A-Za-z0-9]{8,255}$/;
const INTENT_ID = /^pi_[A-Za-z0-9]{8,255}$/;

const idOf = (value: unknown): string =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string"
      ? ((value as { id: string }).id)
      : "";

/**
 * Whether a payment plan's purchase was given back in full: a plan runs as a
 * subscription, so its checkout carries no payment of its own, and the one
 * that counts is its first invoice's. Read from Stripe; any answer it does
 * not give counts as not refunded, as everywhere else.
 */
async function planRefundedInFull(account: string, session: SessionLike): Promise<boolean> {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  if (session.mode !== "subscription" || meta.kind !== "plan") return false;
  const invoice =
    typeof session.invoice === "string" ? session.invoice : (session.invoice as { id?: unknown } | null)?.id;
  if (typeof invoice !== "string" || !INVOICE_ID.test(invoice)) return false;
  try {
    // Whichever way this account's API version names it: on the invoice
    // itself (older versions), or as the invoice's payments (newer ones).
    const read = await onAccount("GET", account, `/invoices/${encodeURIComponent(invoice)}`);
    const intents: string[] = [];
    const direct = idOf(read.payment_intent);
    if (INTENT_ID.test(direct)) intents.push(direct);
    else {
      const listed = await onAccount("GET", account, `/invoice_payments?${new URLSearchParams({ invoice, limit: "10" })}`);
      for (const row of Array.isArray(listed.data) ? (listed.data as Record<string, unknown>[]) : []) {
        if (row.status !== "paid") continue;
        const payment = row.payment && typeof row.payment === "object" ? (row.payment as Record<string, unknown>) : null;
        const pi = idOf(payment?.payment_intent);
        if (INTENT_ID.test(pi)) intents.push(pi);
      }
    }
    if (!intents.length) return false;
    const checked = await Promise.all(
      intents.map(async (intent) =>
        refundedInFull(await onAccount("GET", account, `/payment_intents/${encodeURIComponent(intent)}?expand[]=latest_charge`)),
      ),
    );
    return checked.every(Boolean);
  } catch (error) {
    console.error("reading a payment plan's first payment failed", error);
    return false;
  }
}

/**
 * Whether a checkout's purchase was given back in full: its payment, or for a
 * payment plan its first invoice's. The one rule for every door.
 */
export async function purchaseRefunded(account: string | null | undefined, session: SessionLike): Promise<boolean> {
  if (refundedInFull(session.payment_intent)) return true;
  return account ? planRefundedInFull(account, session) : false;
}
