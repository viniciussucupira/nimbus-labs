import type { NextRequest } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { filesOnProduct, setProductStamp, storeForEmail } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import { stampProblems } from "@/lib/pdf-stamp";

/**
 * Stamping a product's PDFs with each buyer's email.
 *
 * GET `?id=<product>`: which of its PDFs are handed over unstamped, and why —
 * too big to stamp, or a file the stamp could not be written into.
 * POST `{ id, on }`: switches it on or off.
 */
export async function GET(request: NextRequest) {
  const email = await emailForSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!email) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  try {
    const store = await storeForEmail(email);
    const product = store?.products.find((p) => p.id === id);
    if (!store || !product) return Response.json({ ok: false, error: "unknown" }, { status: 404 });
    const files = filesOnProduct(product);
    const problems = await stampProblems(files);
    return Response.json(
      {
        ok: true,
        problems: files
          .filter((file) => problems.has(file.pathname))
          .map((file) => ({ name: file.name, bytes: file.bytes, reason: problems.get(file.pathname) })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("reading stamp notes failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;
  const id = text(guarded.body.id, 40);
  if (!id) return Response.json({ ok: false, error: "unknown" }, { status: 400 });
  try {
    const result = await setProductStamp(guarded.email, id, guarded.body.on === true);
    if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: result.reason === "unknown" ? 404 : 400 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("changing stamping failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
