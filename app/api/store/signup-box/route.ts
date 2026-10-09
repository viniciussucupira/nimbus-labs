import type { NextRequest } from "next/server";
import { setJoin } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";

/**
 * Switches the sign-up box on the store page and saves its words:
 * `{ on, heading, line }` (lib/store-join.ts). It is part of the page, so it
 * needs the "page" permission.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page", 2_000);
  if (!guarded.ok) return guarded.response;
  try {
    const store = await setJoin(guarded.ref, guarded.body);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 404 });
    return Response.json({ ok: true, join: store.join });
  } catch (error) {
    console.error("saving the sign-up box failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
