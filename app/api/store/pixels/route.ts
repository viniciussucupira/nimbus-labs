import type { NextRequest } from "next/server";
import { setPixels } from "@/lib/store";
import { readPixels } from "@/lib/pixels";
import { guardStoreWrite } from "@/lib/store-request";

/**
 * Saves the creator's ad pixel ids. An empty field turns that pixel off; any
 * other value has to be an id in its platform's exact format.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;

  const read = readPixels(guarded.body.pixels);
  if (!read.ok) return Response.json({ ok: false, error: "format", bad: read.bad }, { status: 400 });

  try {
    const result = await setPixels(guarded.email, read.pixels);
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
    return Response.json({ ok: true, pixels: result.store.pixels });
  } catch (error) {
    console.error("saving pixels failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
