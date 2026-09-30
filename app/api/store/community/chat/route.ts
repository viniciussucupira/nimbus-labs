import type { NextRequest } from "next/server";
import { fromAnotherSite } from "@/lib/studio-route";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { CREATOR, readMembers, within } from "@/lib/community";
import { communityViewer } from "@/lib/community-access";
import { MAX_CHAT_TEXT, clearRoom, room, say, unsay } from "@/lib/community-chat";

/**
 * The room: reading what is new, and saying something.
 *
 * JSON both ways, because this is the one part of a community a page has to
 * ask about again and again. A GET with `since` brings only what came after
 * that number, which is what makes asking every few seconds cheap enough to
 * do at all.
 *
 * Every rule is decided here and not on the page: whether the room exists,
 * whether this person may write in it, the cooldown between messages, and
 * whether a web address may be written. A page that hides its box is a
 * courtesy; this is the door.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const handle = normaliseHandle((url.searchParams.get("handle") ?? "").trim().slice(0, 60));
  const store = handle ? await storeForHandle(handle) : null;
  if (!store || !store.community) return Response.json({ ok: false, error: "none" }, { status: 404 });
  const viewer = await communityViewer(store, request.cookies);
  if (viewer.state !== "in") return Response.json({ ok: false, error: "out" }, { status: 403 });
  if (!viewer.config.chat.on) return Response.json({ ok: false, error: "off" }, { status: 404 });

  const id = store.community.id;
  const askedRaw = Number(url.searchParams.get("since"));
  const since = Number.isInteger(askedRaw) && askedRaw > 0 ? askedRaw : 0;
  const page = await room(id, since);
  // The names, so the page never has to ask separately and never sees an
  // address. A member who chose no name is "A member", as everywhere else.
  const members = await readMembers(id, page.messages.map((m) => m.a).filter((a) => a !== CREATOR));
  const names: Record<string, string> = {};
  for (const message of page.messages) {
    names[message.a] = message.a === CREATOR ? store.name : members.get(message.a)?.n || "A member";
  }
  return Response.json(
    { ok: true, messages: page.messages, cursor: page.cursor, names },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "bad" }, { status: 400 });
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

  const handle = normaliseHandle(text(body.handle, 60));
  const store = handle ? await storeForHandle(handle) : null;
  if (!store || !store.community) return Response.json({ ok: false, error: "none" }, { status: 404 });
  const viewer = await communityViewer(store, request.cookies);
  if (viewer.state !== "in") return Response.json({ ok: false, error: "out" }, { status: 403 });
  const { config, owner, key } = viewer;
  if (!config.chat.on) return Response.json({ ok: false, error: "off" }, { status: 404 });
  const id = store.community.id;
  const action = text(body.action, 20);

  if (action === "say") {
    // Muted means reads, does not write — here exactly as everywhere else,
    // with nothing extra for a member to learn.
    if (!owner && !viewer.canWrite) {
      return Response.json({ ok: false, error: viewer.member?.muted ? "muted" : "full" }, { status: 403 });
    }
    if (!owner && !viewer.member?.n) return Response.json({ ok: false, error: "name" }, { status: 403 });
    // The hourly ceiling on top of the cooldown: one stops a flood in a
    // minute, the other stops one over an afternoon.
    if (!owner && !(await within(id, key, "comment"))) {
      // "hourly", not "slow": the ceiling over an afternoon is a different
      // thing from the wait between two messages, and telling somebody they
      // are waiting thirty seconds when they are waiting an hour is a lie the
      // room used to tell.
      return Response.json({ ok: false, error: "hourly" }, { status: 429 });
    }
    const said = await say(id, config.chat, key, owner, text(body.text, MAX_CHAT_TEXT));
    if (!said.ok) {
      return Response.json({ ok: false, error: said.reason, wait: said.wait }, { status: said.reason === "slow" ? 429 : 400 });
    }
    const name = owner ? store.name : viewer.member?.n || "A member";
    return Response.json({ ok: true, message: said.message, name });
  }

  // Taking something out, and emptying the room: the creator's alone.
  if (!owner) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (action === "unsay") {
    const number = Number(body.number);
    if (!Number.isInteger(number) || number <= 0) return Response.json({ ok: false, error: "bad" }, { status: 400 });
    return Response.json({ ok: await unsay(id, number) });
  }
  if (action === "clear") {
    await clearRoom(id);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, error: "unknown" }, { status: 400 });
}
