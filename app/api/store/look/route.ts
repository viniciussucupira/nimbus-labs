import type { NextRequest } from "next/server";
import { updateLook } from "@/lib/store";
import { isTheme, normaliseHex } from "@/lib/store-look";
import { guardStoreWrite } from "@/lib/store-request";

/** Changes the theme and the colour of the creator's public page. */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;

  const theme = guarded.body.theme;
  const accent = normaliseHex(guarded.body.accent);
  if (!isTheme(theme)) {
    return Response.json({ ok: false, error: "theme" }, { status: 400 });
  }
  if (!accent) {
    return Response.json({ ok: false, error: "accent" }, { status: 400 });
  }

  try {
    const result = await updateLook(guarded.email, { theme, accent });
    if (!result.ok) {
      return Response.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return Response.json({ ok: true, look: result.store.look });
  } catch (error) {
    console.error("saving the store look failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
