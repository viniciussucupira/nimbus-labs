import type { NextRequest } from "next/server";
import { setTax, storeForEmail } from "@/lib/store";
import { taxStatus } from "@/lib/tax";
import { guardStoreWrite } from "@/lib/store-request";

/**
 * Switches Stripe Tax on or off for the store's checkouts. On only once
 * Stripe says the creator's tax setup is complete.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;
  const enabled = guarded.body.enabled === true;
  const included = guarded.body.included === true;

  try {
    if (enabled) {
      const store = await storeForEmail(guarded.email);
      if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
      if (!store.stripeAccountId) return Response.json({ ok: false, error: "stripe" }, { status: 400 });
      const status = await taxStatus(store);
      if (status.state !== "active") {
        return Response.json(
          { ok: false, error: status.state === "pending" ? "setup" : "server_error", missing: status.state === "pending" ? status.missing : [] },
          { status: status.state === "pending" ? 400 : 502 },
        );
      }
    }
    const result = await setTax(guarded.email, { enabled, included });
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, tax: result.store.tax });
  } catch (error) {
    console.error("saving the tax setting failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
