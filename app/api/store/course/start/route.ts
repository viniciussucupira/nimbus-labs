import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { fromAnotherSite } from "@/lib/studio-route";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { readOrder } from "@/lib/store-checkout";
import {
  BUYER_COOKIE,
  buyerFingerprint,
  mintPass,
  passCookie,
  recordEnrollment,
  sendCourseLink,
  touchStudent,
} from "@/lib/learn";

/**
 * The thanks page's "Start the course" button.
 *
 * In the browser that paid, the course opens at once: the checkout left a
 * secret here and its fingerprint is on the charge, so this browser is the
 * buyer's. Anywhere else — a thanks link opened on another device — the way
 * in goes to the address that paid instead, because a link can be forwarded
 * and an inbox cannot.
 */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });
  const away = (path: string, cookie?: string) => {
    const headers = new Headers({ Location: `${origin}${path}`, "Cache-Control": "no-store" });
    if (cookie) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 303, headers });
  };

  let handle = "";
  let sessionId = "";
  try {
    const form = await request.formData();
    handle = normaliseHandle(String(form.get("handle") ?? ""));
    sessionId = String(form.get("session_id") ?? "");
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const store = handle ? await storeForHandle(handle) : null;
  if (!store) return new Response("No such store.", { status: 404 });

  const order = await readOrder(store, sessionId);
  if (order.state !== "paid" || !order.product.course) return away(`/@${store.handle}`);
  const product = order.product;
  const course = product.course!;
  const path = `/@${store.handle}/course/${product.id}`;
  if (!order.email) return away(`${path}?link=ask`);

  await recordEnrollment(store, order.email, product.id, order.created);
  const secret = request.cookies.get(BUYER_COOKIE)?.value ?? "";
  if (secret && order.buyerKey && buyerFingerprint(secret) === order.buyerKey) {
    await touchStudent(course.id, order.email, order.created);
    const token = await mintPass(store, order.email, [course.id]);
    return away(path, passCookie(store, token, origin.startsWith("https://")));
  }
  const sent = await sendCourseLink(store, product, order.email, origin);
  return away(`${path}?link=${sent ? "sent" : "error"}`);
}
