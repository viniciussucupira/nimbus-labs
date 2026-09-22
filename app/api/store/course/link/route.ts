import type { NextRequest } from "next/server";
import { originFrom } from "@/lib/request-origin";
import { fromAnotherSite } from "@/lib/studio-route";
import { normaliseHandle, storeForHandle } from "@/lib/store";
import { requestCourseLink } from "@/lib/learn";
import { clientIp } from "@/lib/visit";

/** "Send me a link": a student opening the course on another device. */
export async function POST(request: NextRequest) {
  const origin = originFrom(request);
  if (fromAnotherSite(request)) return new Response("forbidden", { status: 403 });

  let handle = "";
  let productId = "";
  let email = "";
  try {
    const form = await request.formData();
    handle = normaliseHandle(String(form.get("handle") ?? ""));
    productId = String(form.get("product") ?? "").slice(0, 40);
    email = String(form.get("email") ?? "").slice(0, 300);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const store = handle ? await storeForHandle(handle) : null;
  const product = store?.products.find((p) => p.id === productId && p.course);
  if (!store || !product) return new Response("Not found.", { status: 404 });

  let result: string;
  try {
    result = await requestCourseLink({ store, product, email, ip: clientIp(request), origin });
  } catch (error) {
    console.error("sending a course link failed", error);
    result = "error";
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `${origin}/@${store.handle}/course/${product.id}?link=${result}`, "Cache-Control": "no-store" },
  });
}
