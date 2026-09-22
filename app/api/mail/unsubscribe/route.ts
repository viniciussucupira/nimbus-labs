import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { UNSUB_TOKEN, unsubscribe } from "@/lib/contacts";

/**
 * Leaving a creator's list. A mail app's own unsubscribe button posts here
 * with no page at all (RFC 8058); the link in the email reaches the same
 * thing through a page with one button. Either way it takes one press, it is
 * kept for good, and nobody is asked why.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  const token = (request.nextUrl.searchParams.get("t") ?? "").slice(0, 60);
  let fromPage = false;
  if (!UNSUB_TOKEN.test(token)) return new Response("Not found.", { status: 404 });
  try {
    const form = await request.formData();
    fromPage = form.get("from") === "page";
  } catch {
    fromPage = false;
  }
  const done = await unsubscribe(token);
  if (fromPage) {
    return new Response(null, {
      status: 303,
      headers: { Location: `${origin}/unsubscribe?t=${token}&done=${done ? "1" : "0"}`, "Cache-Control": "no-store" },
    });
  }
  return new Response(done ? "Unsubscribed." : "Not found.", {
    status: done ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** A link opened by hand goes to the page with the button, never straight through. */
export async function GET(request: NextRequest) {
  const origin = originFrom(request);
  const token = (request.nextUrl.searchParams.get("t") ?? "").slice(0, 60);
  return new Response(null, { status: 303, headers: { Location: `${origin}/unsubscribe?t=${encodeURIComponent(token)}` } });
}
