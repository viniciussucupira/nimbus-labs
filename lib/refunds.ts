/**
 * What a refund takes back, decided in one place.
 *
 * A buyer who is refunded in full has been given their money back, and what
 * they bought closes for them the same way everywhere Nimbus hands it over:
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
