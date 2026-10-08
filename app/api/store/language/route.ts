import type { NextRequest } from "next/server";
import { setLanguage } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";
import { isLanguage } from "@/lib/store-language";

/**
 * The language the store speaks to its buyers in (lib/store-language.ts), from
 * the studio: `{ language }`, one of the languages there is. Anything else is
 * refused rather than read as English, so a slip never changes a store. The
 * "settings" permission, as the store's look and prices are.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings", 2_000);
  if (!guarded.ok) return guarded.response;
  if (!isLanguage(guarded.body.language)) return Response.json({ ok: false, error: "language" }, { status: 400 });
  try {
    const store = await setLanguage(guarded.ref, guarded.body.language);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 400 });
    return Response.json({ ok: true, language: store.language });
  } catch (error) {
    console.error("saving the store's language failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
