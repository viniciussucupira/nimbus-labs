import type { NextRequest } from "next/server";
import { storeForEmail } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";
import { originFrom } from "@/lib/request-origin";
import { withinLimit } from "@/lib/request-guard";
import { isDemoCheckoutConfigured } from "@/lib/demo-store";
import { checkPackageSession, openPackageSession, verifyTiers } from "@/lib/verify-stripe";

export const maxDuration = 60;

/**
 * Runs session packages and membership tiers against Stripe's test mode, on
 * the demo's sandbox account (lib/verify-stripe.ts), and answers what passed.
 * Only for somebody signed in to a studio, a few times an hour; it makes
 * test objects on the sandbox and nothing anywhere else.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings");
  if (!guarded.ok) return guarded.response;
  if (!isDemoCheckoutConfigured()) return Response.json({ ok: false, error: "no test mode" }, { status: 503 });
  const store = await storeForEmail(guarded.ref);
  if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
  if (!(await withinLimit("verify-stripe", store.handle, 12, 3600))) return Response.json({ ok: false, error: "slow" }, { status: 429 });
  const step = typeof guarded.body.step === "string" ? guarded.body.step : "";
  const origin = originFrom(request);
  try {
    if (step === "tiers") return Response.json({ ok: true, checks: await verifyTiers(store) });
    if (step === "package-open") {
      const opened = await openPackageSession(store, origin);
      return Response.json({ ok: true, checks: [...opened], url: opened.url, session: opened.session, coupon: opened.coupon });
    }
    if (step === "package-check") {
      const session = typeof guarded.body.session === "string" && /^cs_test_[A-Za-z0-9]{10,200}$/.test(guarded.body.session) ? guarded.body.session : "";
      const coupon = typeof guarded.body.coupon === "string" && /^[A-Za-z0-9_-]{4,80}$/.test(guarded.body.coupon) ? guarded.body.coupon : "";
      if (!session || !coupon) return Response.json({ ok: false, error: "session" }, { status: 400 });
      return Response.json({ ok: true, checks: await checkPackageSession(store, origin, session, coupon) });
    }
    return Response.json({ ok: false, error: "step" }, { status: 400 });
  } catch (error) {
    console.error("verifying against Stripe failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "error" }, { status: 500 });
  }
}
