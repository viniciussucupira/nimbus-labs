import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { requestOrdersLink } from "@/lib/buyer-orders";

const MAX_BODY_BYTES = 2_000;

/**
 * A buyer asks for what they bought from this store, sent to their inbox.
 *
 * A plain HTML form, so it works with JavaScript turned off. The answer is
 * always the same page, whether or not the address bought anything here,
 * and the address typed never appears in the URL it leads to.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);

  const sender = request.headers.get("origin");
  const host = request.headers.get("host");
  if (sender && host) {
    try {
      if (new URL(sender).host !== host) return new Response("forbidden", { status: 403 });
    } catch {
      return new Response("forbidden", { status: 403 });
    }
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return new Response("Too large", { status: 413 });
  }

  const away = (path: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${origin}${path}`, "Cache-Control": "no-store" },
    });

  let handle = "";
  let email = "";
  let honeypot = "";
  try {
    const form = await request.formData();
    const read = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    handle = normaliseHandle(read("handle"));
    email = read("email").slice(0, 300);
    honeypot = read("website");
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!handle) return new Response("Bad request", { status: 400 });

  const store = await storeForHandle(handle);
  if (!store) return new Response("No such store.", { status: 404 });

  const page = `/@${store.handle}/orders`;
  // A field no person can see. Whatever filled it in is told it worked.
  if (honeypot.trim()) return away(`${page}?status=sent`);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    const result = await requestOrdersLink({ store, email, ip, origin });
    return away(`${page}?status=${result}`);
  } catch (error) {
    console.error("sending a purchases link failed", error);
    return away(`${page}?status=error`);
  }
}
