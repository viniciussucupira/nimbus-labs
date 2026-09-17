import type { NextRequest } from "next/server";
import {
  createDemoCheckout,
  findDemoOption,
  isDemoCheckoutConfigured,
} from "@/lib/demo-store";

const HOST_PATTERN = /^[a-z0-9.-]+(:\d+)?$/i;

function redirect(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

// The public address of this site, as the browser sees it.
function siteOrigin(request: NextRequest): string | null {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || !HOST_PATTERN.test(host)) return null;
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0];
  const proto = (forwarded ?? request.nextUrl.protocol).startsWith("https")
    ? "https"
    : "http";
  return `${proto}://${host}`;
}

// The buy button is a plain HTML form, so the store page needs no JavaScript.
export async function POST(request: NextRequest) {
  const site = siteOrigin(request);
  if (!site) return new Response("Bad request", { status: 400 });

  // Only accept purchases started from this site.
  const origin = request.headers.get("origin");
  if (origin && origin !== site) {
    return new Response("Forbidden", { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const option = findDemoOption(form.get("option"));
  if (!option) return new Response("Choose an option", { status: 400 });

  if (!isDemoCheckoutConfigured()) {
    return redirect(`${site}/demo/thanks?status=unavailable`);
  }

  try {
    return redirect(await createDemoCheckout(site, option));
  } catch (error) {
    console.error("Demo checkout failed", error);
    return redirect(`${site}/demo/thanks?status=error`);
  }
}
