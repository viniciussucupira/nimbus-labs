import type { NextRequest } from "next/server";
import { shareFor } from "@/lib/chat-pace";
import { passFits } from "@/lib/chat-tip";
import { tip } from "@/lib/community-chat";
import { COMMUNITY_ID } from "@/lib/community-text";
import { isRedisConfigured } from "@/lib/redis";

const NOTHING = { "Cache-Control": "no-store" };

/**
 * Whether a room has anything new: the number of its last message, and how
 * long ago it was said.
 *
 * Asked every few seconds by every open room (lib/chat-pace.ts), so it is
 * made to cost next to nothing. It reads no cookie and knows nobody: it is
 * opened by the pass a member's page carries (lib/chat-tip.ts), answers one
 * number, and says the CDN may give everybody the same answer for a few
 * seconds, longer the quieter the room is. A hundred readers of one room are
 * then one read of the database every few seconds, not a hundred.
 *
 * The messages themselves are asked for at the route above this one, by
 * somebody the server knows, and only when this number has moved.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("c") ?? "").slice(0, 40);
  const pass = (url.searchParams.get("p") ?? "").slice(0, 80);
  if (!COMMUNITY_ID.test(id) || !passFits(id, pass)) return Response.json({ ok: false }, { status: 404, headers: NOTHING });
  if (!isRedisConfigured()) return Response.json({ ok: false }, { status: 503, headers: NOTHING });
  try {
    const last = await tip(id);
    // A room nobody has spoken in is as quiet as a room can be.
    const quiet = last.at > 0 ? Math.max(0, Date.now() - last.at * 1000) : Number.POSITIVE_INFINITY;
    return Response.json(
      { ok: true, n: last.n, q: Number.isFinite(quiet) ? Math.floor(quiet / 1000) : -1 },
      { headers: { "Cache-Control": `public, max-age=0, s-maxage=${shareFor(quiet)}` } },
    );
  } catch (error) {
    console.error("reading a room's last message failed", error);
    return Response.json({ ok: false }, { status: 503, headers: NOTHING });
  }
}
