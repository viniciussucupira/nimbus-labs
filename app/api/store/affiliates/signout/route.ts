import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { affiliateCookieName, endAffiliateSession } from "@/lib/affiliates";
import { fromAnotherSite, limited } from "@/lib/request-guard";

/** An affiliate leaving their page on this browser. */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  // Refused before anything else is read: another site, by Origin or by
  // Sec-Fetch-Site (lib/request-guard.ts).
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  let handle = "";
  try {
    const form = await (await limited(request, 8_000)).formData();
    const h = form.get("handle");
    handle = typeof h === "string" ? normaliseHandle(h) : "";
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const store = handle ? await storeForHandle(handle) : null;
  if (!store) return new Response("No such store.", { status: 404 });
  const name = affiliateCookieName(store.handle);
  await endAffiliateSession(request.cookies.get(name)?.value).catch(() => {});
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${origin}/@${store.handle}/affiliates?status=signedout`,
      "Cache-Control": "no-store",
      "Set-Cookie": `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    },
  });
}
