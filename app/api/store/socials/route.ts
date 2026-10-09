import type { NextRequest } from "next/server";
import { setSocials } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";
import { MAX_SOCIALS, parseSocials } from "@/lib/store-socials";

/**
 * Saves the creator's profiles elsewhere (lib/store-socials.ts):
 * `{ socials: [{ network, url }] }`, where url is what was typed, a handle or
 * an address. Each one is rebuilt as the address it opens, and any that is
 * not one for its network is refused by name, so nothing is dropped
 * without the creator knowing. They show under the store's name, so this
 * needs the "page" permission.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page", 8_000);
  if (!guarded.ok) return guarded.response;
  const { body } = guarded;
  const fail = (error: string, status = 400, extra: object = {}) => Response.json({ ok: false, error, ...extra }, { status });
  const sent = Array.isArray(body.socials) ? body.socials.slice(0, MAX_SOCIALS + 1) : null;
  if (!sent) return fail("invalid");
  if (sent.length > MAX_SOCIALS) return fail("too_many");
  // Which ones did not make an address, so the studio can say so beside them.
  const bad: number[] = [];
  sent.forEach((entry, index) => {
    if (parseSocials([entry]).length === 0) bad.push(index);
  });
  if (bad.length) return fail("not_a_profile", 400, { bad });
  try {
    const store = await setSocials(guarded.ref, sent);
    if (!store) return fail("none", 404);
    return Response.json({ ok: true, socials: store.socials });
  } catch (error) {
    console.error("saving the store's profiles failed", error);
    return fail("server_error", 500);
  }
}
