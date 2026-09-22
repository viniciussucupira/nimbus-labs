import type { NextRequest } from "next/server";
import { setDomain, storeForEmail } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import {
  canUseDomain,
  connectDomain,
  disconnectDomain,
  domainStatus,
  isDomainsConfigured,
  verifyDomain,
} from "@/lib/domains";

/**
 * The store's own domain, from the studio:
 *
 *   { action: "connect", name }   adds it, and answers with the records to add
 *   { action: "check" }           looks again, after the creator added them
 *   { action: "remove" }          takes it off; the nimbuslabsai.com address stays
 *
 * Only the signed-in creator's own store is touched: nothing in the request
 * names a store.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, 2_000);
  if (!guarded.ok) return guarded.response;
  const { email, body } = guarded;
  const action = text(body.action, 20);
  const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

  try {
    const store = await storeForEmail(email);
    if (!store) return fail("none");

    if (action === "remove") {
      if (!store.domain) return Response.json({ ok: true });
      if (!(await disconnectDomain(store.domain.name))) return fail("unavailable", 502);
      await setDomain(email, null);
      return Response.json({ ok: true });
    }

    if (!canUseDomain(store)) return fail("plan", 403);
    if (!isDomainsConfigured()) return fail("unavailable", 503);

    if (action === "connect") {
      const result = await connectDomain(store, text(body.name, 300));
      if (!result.ok) return fail(result.reason);
      const now = new Date().toISOString();
      await setDomain(email, { name: result.name, addedAt: now, liveAt: "" });
      const status = await domainStatus(result.name);
      return Response.json({ ok: true, status });
    }

    if (action === "check") {
      if (!store.domain) return fail("none");
      let status = await domainStatus(store.domain.name);
      // A domain that needed proving: ask Vercel to look at the TXT record now.
      if (status && !status.live && status.records.some((r) => r.type === "TXT")) {
        await verifyDomain(store.domain.name);
        status = await domainStatus(store.domain.name);
      }
      if (!status) return fail("unavailable", 502);
      if (status.live && !store.domain.liveAt) {
        await setDomain(email, { ...store.domain, liveAt: new Date().toISOString() });
      } else if (!status.live && store.domain.liveAt) {
        await setDomain(email, { ...store.domain, liveAt: "" });
      }
      return Response.json({ ok: true, status });
    }

    return fail("invalid");
  } catch (error) {
    console.error("a domain action failed", error);
    return fail("server_error", 500);
  }
}
