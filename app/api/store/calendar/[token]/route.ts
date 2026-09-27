import { storeForHandle } from "@/lib/store";
import { paidCalls } from "@/lib/calls";
import { bookedCalendar, cachedBookedCalendar, storeIdForToken } from "@/lib/calendar-sync";

/**
 * A store's bookings as a calendar to subscribe to, at its private address
 * (/api/store/calendar/<token>.ics). The token is the only key, so the
 * address is kept out of every page and can be replaced from the studio,
 * which turns this one off at once. Made at most every five minutes; Stripe
 * is the record of who booked what, and is read for it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const missing = () =>
    new Response("Not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  const token = raw.replace(/\.ics$/i, "");
  const owner = await storeIdForToken(token).catch(() => null);
  if (!owner) return missing();
  const store = await storeForHandle(owner.handle).catch(() => null);
  if (!store || store.statsId !== owner.statsId) return missing();

  try {
    const ics = await cachedBookedCalendar(owner.statsId, async () => bookedCalendar(store, store.stripeAccountId ? await paidCalls(store) : []));
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="bookings.ics"',
        "Cache-Control": "private, max-age=300",
        "X-Robots-Tag": "noindex",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Stripe did not answer. A calendar app keeps what it had and asks again.
    console.error("making a booking calendar failed", error);
    return new Response("Try again in a few minutes.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
}
