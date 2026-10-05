import type { NextRequest } from "next/server";
import { setRecovery, storeForEmail } from "@/lib/store";
import { MAX_RECOVERY_ADDRESS } from "@/lib/recovery-setting";
import { accountCountry } from "@/lib/checkout-recovery";
import { isSenderConfigured } from "@/lib/email";
import { guardStoreWrite, text } from "@/lib/store-request";

/**
 * Switches the abandoned-checkout reminder on or off.
 *
 * On only with a postal address to print at its foot. Which of its two halves
 * a store gets depends on where its Stripe account is: Stripe puts its own
 * consent box on the checkouts of US businesses only, so only a US account
 * has that one; every account has the reminder a buyer asks for themselves
 * on the way back from the checkout (lib/checkout-ask.ts). Off always works.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings");
  if (!guarded.ok) return guarded.response;
  const enabled = guarded.body.enabled === true;
  const address = text(guarded.body.address, MAX_RECOVERY_ADDRESS + 50).replace(/\s+/g, " ").trim();

  // Whether Stripe is asked for its own consent box: decided when the
  // reminder is switched on, from the account's country, and kept.
  let asks = true;
  try {
    if (enabled) {
      if (!address) return Response.json({ ok: false, error: "address" }, { status: 400 });
      if (address.length > MAX_RECOVERY_ADDRESS) return Response.json({ ok: false, error: "address_long" }, { status: 400 });
      if (!isSenderConfigured()) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
      const store = await storeForEmail(guarded.ref);
      if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
      if (!store.stripeAccountId) return Response.json({ ok: false, error: "stripe" }, { status: 400 });
      const country = await accountCountry(store);
      if (country.state !== "ok") return Response.json({ ok: false, error: "server_error" }, { status: 502 });
      asks = country.country === "US";
    }
    const result = await setRecovery(guarded.ref, { enabled, address, asks });
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, recovery: result.store.recovery });
  } catch (error) {
    console.error("saving the reminder setting failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
