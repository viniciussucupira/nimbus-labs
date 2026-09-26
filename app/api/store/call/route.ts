import type { NextRequest } from "next/server";
import { setProductCall, storeForEmail } from "@/lib/store";
import { type CallSetup, readSetup } from "@/lib/call-setup";
import { checkCallChange } from "@/lib/calls";
import { guardStoreWrite, text } from "@/lib/store-request";

/**
 * Makes a product a paid call, changes its hours, or turns it back.
 *
 * `{ id, call: {...} }` sets it; `{ id, remove: true }` turns it back into an
 * ordinary product. Every field of the setup is checked here, whatever the
 * studio already checked, and so is what buyers already booked
 * (checkCallChange): a booked session is not moved from under them.
 */
export async function POST(request: NextRequest) {
  // Fifty dated sessions, each with its own meeting link, fit well inside this.
  const guarded = await guardStoreWrite(request, 40_000);
  if (!guarded.ok) return guarded.response;

  const id = text(guarded.body.id, 40);
  if (!id) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  let setup: CallSetup | null = null;
  if (guarded.body.remove !== true) {
    const read = readSetup(guarded.body.call);
    if (typeof read === "string") {
      return Response.json({ ok: false, error: read }, { status: 400 });
    }
    setup = read;
  }

  try {
    if (setup) {
      const store = await storeForEmail(guarded.email);
      if (store) {
        const checked = await checkCallChange(store, id, setup);
        if (typeof checked === "string") {
          return Response.json({ ok: false, error: checked }, { status: checked === "error" ? 503 : 400 });
        }
        setup = checked;
      }
    }
    const result = await setProductCall(guarded.email, id, setup);
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, store: result.store });
  } catch (error) {
    console.error("saving a call failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
