/**
 * The door every /api/v1 request goes through.
 *
 * A key from the Authorization header, its store by the store's permanent id,
 * and a limit per key. Nothing else is read from the request to decide whose
 * data is returned: there is no store name, id or address in any URL here,
 * so there is nothing to change to reach another store's data. The key alone
 * says whose it is.
 *
 * No CORS headers, on purpose. These are keys for a creator's own server,
 * Zapier or Make — a key in a web page's script is a key anybody who opens the
 * page can copy, and a browser refusing the request is the kinder way to learn
 * that.
 */
import { keyFromHeader, resolveKey } from "@/lib/api-keys";
import { storeForId, type Store } from "@/lib/store";
import { withinLimit } from "@/lib/request-guard";

/** Requests one key may make in a minute. Generous for a sync, a wall for a runaway loop. */
export const API_RATE = 120;

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export function apiError(status: number, error: string, message: string, extra: Record<string, string> = {}): Response {
  return Response.json({ error, message }, { status, headers: { ...headers, ...extra } });
}

export function apiOk(body: unknown): Response {
  return Response.json(body, { headers });
}

/** The store this request may read, or the response that refuses it. */
export async function apiStore(request: Request): Promise<Store | Response> {
  const presented = keyFromHeader(request.headers.get("authorization"));
  const unauthorized = () =>
    apiError(401, "unauthorized", "Send your API key as: Authorization: Bearer nl_live_…", {
      "WWW-Authenticate": 'Bearer realm="Nimbus Labs API"',
    });
  if (!presented) return unauthorized();
  const found = await resolveKey(presented);
  // Missing, malformed, unknown and revoked all get the same answer, so the
  // API cannot be used to learn which keys ever existed.
  if (!found) return unauthorized();
  if (!(await withinLimit("api", found.id, API_RATE, 60))) {
    return apiError(429, "rate_limited", `At most ${API_RATE} requests a minute per key. Try again in a minute.`, { "Retry-After": "60" });
  }
  const store = await storeForId(found.sid);
  if (!store) return unauthorized();
  return store;
}
