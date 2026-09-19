import type { NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { productFile } from "@/lib/store";
import { isRedisConfigured } from "@/lib/redis";

/**
 * Gives the creator back the file they uploaded.
 *
 * A creator who cannot open what they just uploaded has no way of knowing
 * whether their buyers will get the right thing, so this exists before any
 * buyer does. It is the same path a sale will take later: the file is fetched
 * from the private store by us, after we have decided the asker is allowed it,
 * and streamed on. The blob's own URL is never handed out, because a URL that
 * works is a URL that can be forwarded.
 */
export async function GET(request: NextRequest) {
  const email = await emailForSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!email) return new Response("Sign in first.", { status: 401 });

  if (!isRedisConfigured()) {
    return new Response("Stores are not switched on yet.", { status: 503 });
  }

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) return new Response("Which file?", { status: 400 });

  const found = await productFile(email, id);
  if (!found) return new Response("No file on that product.", { status: 404 });

  try {
    const result = await get(found.file.pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response("The file is not there any more.", { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": found.file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${found.file.name}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("reading a file failed", error);
    return new Response("We could not fetch the file right now.", {
      status: 502,
    });
  }
}
