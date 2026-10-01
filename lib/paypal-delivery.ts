/**
 * Hands over what a PayPal payment bought (lib/paypal-sales.ts) with the same
 * pieces a Stripe sale uses: the store's sender and address, the course
 * dated from the payment, and a signed link to the list of purchases.
 */
import { ordersLinkFor } from "@/lib/buyer-orders";
import { readListing } from "@/lib/catalog";
import { dropEnrollment, recordEnrollment } from "@/lib/learn";
import { type Paid, deliverPayPal, watchPayPal } from "@/lib/paypal-sales";
import { fromStore, storeBase } from "@/lib/purchase-email";
import type { Store } from "@/lib/store";

/** Gives the buyer what they paid for and emails the receipt. False when the product is gone. */
export async function handOverPayPal(store: Store, paid: Paid): Promise<boolean> {
  const product = await readListing(store, paid.product);
  if (!product) {
    console.error("a PayPal purchase named a product the store no longer has", store.handle, paid.order);
    return false;
  }
  const base = storeBase(store);
  await deliverPayPal({
    store,
    paid,
    product,
    base,
    from: fromStore(store),
    recordStart: async (email, productId, start) => {
      const course = productId === product.id ? product : await readListing(store, productId);
      if (course?.course) await recordEnrollment(store, email, productId, start);
    },
    ordersLink: (email) => ordersLinkFor(store, email, base),
  });
  return true;
}

/** The checkout sweep's PayPal part for one store: pending payments cleared, refunds taken back. */
export function sweepPayPal(store: Store, deadline: number): Promise<{ cleared: number; revoked: number }> {
  return watchPayPal(store, deadline, {
    handOver: async (paid) => {
      await handOverPayPal(store, paid);
    },
    dropStart: (email, productId) => dropEnrollment(store, email, productId),
  });
}
