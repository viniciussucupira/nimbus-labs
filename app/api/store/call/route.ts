import type { NextRequest } from "next/server";
import { setProductCall } from "@/lib/store";
import { readSetup } from "@/lib/call-setup";
import { guardStoreWrite, text } from "@/lib/store-request";

/**
 * Makes a product a paid call, changes its hours, or turns it back.
 *
 * `{ id, call: {...} }` sets it; `{ id, remove: true }` turns it back into an
 * ordinary product. Every field of the setup is checked here, whatever the
 * studio already checked.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, 6_000);
  if (!guarded.ok) return guarded.response;

  const id = text(guarded.body.id, 40);
  if (!id) return Response.json({ ok: false, error: "unknown" }, { status: 400 });

  let setup = null;
  if (guarded.body.remove !== true) {
    const read = readSetup(guarded.body.call);
    if (typeof read === "string") {
      return Response.json({ ok: false, error: read }, { status: 400 });
    }
    setup = read;
  }

  try {
    const result = await setProductCall(guarded.email, id, setup);
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, store: result.store });
  } catch (error) {
    console.error("saving a call failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
