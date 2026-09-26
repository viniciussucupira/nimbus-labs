import type { NextRequest } from "next/server";
import { setRecovery, storeForEmail } from "@/lib/store";
import { MAX_RECOVERY_ADDRESS } from "@/lib/recovery-setting";
import { accountCountry } from "@/lib/checkout-recovery";
import { isSenderConfigured } from "@/lib/email";
import { guardStoreWrite, text } from "@/lib/store-request";

/**
 * Switches the abandoned-checkout reminder on or off.
 *
 * On only with a postal address to print at its foot, and only for a Stripe
 * account in the United States: Stripe asks buyers for consent to promotional
 * email only on checkouts of US businesses, and without that consent nothing
 * would ever be sent. Off always works, for anyone.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;
  const enabled = guarded.body.enabled === true;
  const address = text(guarded.body.address, MAX_RECOVERY_ADDRESS + 50).replace(/\s+/g, " ").trim();

  try {
    if (enabled) {
      if (!address) return Response.json({ ok: false, error: "address" }, { status: 400 });
      if (address.length > MAX_RECOVERY_ADDRESS) return Response.json({ ok: false, error: "address_long" }, { status: 400 });
      if (!isSenderConfigured()) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
      const store = await storeForEmail(guarded.email);
      if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
      if (!store.stripeAccountId) return Response.json({ ok: false, error: "stripe" }, { status: 400 });
      const country = await accountCountry(store);
      if (country.state !== "ok") return Response.json({ ok: false, error: "server_error" }, { status: 502 });
      if (country.country !== "US") {
        return Response.json({ ok: false, error: "country", country: country.country }, { status: 400 });
      }
    }
    const result = await setRecovery(guarded.email, { enabled, address });
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, recovery: result.store.recovery });
  } catch (error) {
    console.error("saving the reminder setting failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
