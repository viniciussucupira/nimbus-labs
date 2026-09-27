import type { NextRequest } from "next/server";
import { releaseHandle } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";

const MAX_BODY_BYTES = 2_000;

/** Lets go of an address the signed-in creator's store used before. */
export async function POST(request: NextRequest) {
  // Another site, the size of the body, the session, the store the studio
  // page was drawn for, and the role's "settings" (lib/store-request.ts).
  const guarded = await guardStoreWrite(request, "settings", MAX_BODY_BYTES);
  if (!guarded.ok) return guarded.response;
  const { ref, body } = guarded;

  const handle = typeof body.handle === "string" ? body.handle : "";

  try {
    const result = await releaseHandle(ref, handle);
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.reason },
        { status: result.reason === "current" ? 409 : 400 },
      );
    }
    return Response.json({ ok: true, handle });
  } catch (error) {
    console.error("releasing an address failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
