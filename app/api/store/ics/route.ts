import type { NextRequest } from "next/server";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { readOrder } from "@/lib/store-checkout";
import { callInvite } from "@/lib/calls";
import { VIDEO_ROOM_NOTE, isVideoRoom, roomOf } from "@/lib/call-rooms";
import { linkUpdates } from "@/lib/meet-links";

/**
 * The calendar file for a booked call, for the "Add to your calendar" button.
 *
 * The session id is the key, exactly as on the thanks page, and it is checked
 * against Stripe before anything is handed over. It is also linked from the
 * reminder emails, so it answers until the call is over, at the time the
 * booking has now if its buyer moved it.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const handle = normaliseHandle(url.searchParams.get("handle") ?? "");
  const sessionId = url.searchParams.get("session_id") ?? "";
  const store = handle ? await storeForHandle(handle) : null;
  if (!store) return new Response("Not found.", { status: 404 });

  const order = await readOrder(store, sessionId);
  if (order.state !== "paid" || !order.call || !order.product.call) {
    return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const room = await roomOf(store.callsId, {
    product: order.product.id,
    setup: order.product.call,
    session: sessionId,
    start: order.call.start,
    end: order.call.end,
  });
  const ics = callInvite({
    // A link replaced after a failure counts, like a move (lib/meet-links.ts).
    sequence: order.call.moves + (await linkUpdates(store.callsId, { session: sessionId, product: order.product.id, start: order.call.start })),
    uid: sessionId,
    start: order.call.start,
    end: order.call.end,
    title: order.product.title,
    storeName: store.name,
    room,
    note: room ? `Join: ${room}${isVideoRoom(room) ? `\n\n${VIDEO_ROOM_NOTE}` : ""}` : `${store.name} will send the link to join.`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="call.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
