import { type NextRequest, after } from "next/server";
import { noticeCreator } from "@/lib/account-notice";
import { isMeetProvider } from "@/lib/call-setup";
import { ACCOUNT_NAMES, disconnect, meetView } from "@/lib/meet-connect";
import { isConfigured } from "@/lib/meet-providers";
import { withinLimit } from "@/lib/request-guard";
import { guardStoreWrite } from "@/lib/store-request";

/** Changes a store may make here in a minute: each one reaches Google or Zoom. */
const PER_MINUTE = 20;

/**
 * Disconnects the store's Google Calendar or Zoom (lib/meet-connect.ts):
 * `{ action: "disconnect", provider }`. The access is given back to the
 * provider, the tokens are deleted, and the owner is told by email. Only the
 * owner and Admins ("settings", lib/team-roles.ts).
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "settings", 2_000);
  if (!guarded.ok) return guarded.response;
  const { store, body } = guarded;
  const provider = body.provider;
  if (body.action !== "disconnect" || !isMeetProvider(provider) || !isConfigured(provider)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!store.statsId) return Response.json({ ok: true, view: await meetView(null, store) });
  if (!(await withinLimit("meet-manage", store.statsId, PER_MINUTE, 60))) {
    return Response.json({ ok: false, error: "limited" }, { status: 429 });
  }
  try {
    const was = await disconnect(store.statsId, provider);
    if (was) after(() => noticeCreator(store, { kind: "meeting-disconnected", name: ACCOUNT_NAMES[provider], account: was.account }));
    return Response.json({ ok: true, view: await meetView(store.statsId, store) });
  } catch (error) {
    console.error("disconnecting a meeting account failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
