import type { NextRequest } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { storeForEmail } from "@/lib/store";
import { readAllTimeSales } from "@/lib/stats";

/**
 * All-time sales, read from the creator's own Stripe account when they ask
 * for them in the studio — the one reading too long to make on every visit
 * to it — and kept ten minutes.
 */
export async function GET(request: NextRequest) {
  const email = await emailForSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!email) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
  const store = await storeForEmail(email);
  if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
  if (!store.stripeAccountId) return Response.json({ ok: false, error: "stripe" }, { status: 400 });
  try {
    const sales = await readAllTimeSales(store);
    return Response.json({ ok: true, sales }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("reading all-time sales failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 502 });
  }
}
