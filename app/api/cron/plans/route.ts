import type { NextRequest } from "next/server";
import { cronAllowed } from "@/lib/request-guard";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { settlePlans } from "@/lib/plans";
import { isBillingConfigured } from "@/lib/billing";
import { syncSubscriptions } from "@/lib/billing-sync";

export const maxDuration = 60;

/**
 * Run on a schedule by Vercel, once a day, for the two jobs that keep money
 * where it was agreed to be:
 *
 *   - gives every paid payment plan its end, so no buyer is ever charged
 *     more payments than they agreed to;
 *   - brings every store's "paid up" snapshot in line with its subscription
 *     at Stripe (lib/billing-sync.ts), so a store that stopped paying us
 *     stops selling, and one that paid while its way back got lost is
 *     written down.
 *
 * Safe to run more than once: each job only writes what is still wrong, and
 * one run at a time.
 */
export async function GET(request: NextRequest) {
  // Vercel sends the secret with every scheduled run, compared here in
  // constant time. Without one set, only a local development server runs the
  // job on request; in production that is a closed door, not an open one.
  if (!(await cronAllowed(request))) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isRedisConfigured()) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  const [got] = await redisPipeline([["SET", "nl:plans:lock", "1", "NX", "EX", 120]]);
  if (got === null) return Response.json({ ok: true, busy: true });
  // Leaves time to answer inside maxDuration, whatever the jobs find.
  const deadline = Date.now() + 45_000;
  try {
    let plans = null;
    try {
      plans = await settlePlans();
    } catch (error) {
      console.error("settling payment plans failed", error);
    }
    let billing = null;
    if (isBillingConfigured()) {
      try {
        billing = await syncSubscriptions(deadline);
      } catch (error) {
        console.error("settling store subscriptions failed", error);
      }
    }
    const ok = plans !== null && (billing !== null || !isBillingConfigured());
    return Response.json({ ok, ...(plans ?? {}), billing }, { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
  } finally {
    await redisPipeline([["DEL", "nl:plans:lock"]]).catch(() => {});
  }
}
