import type { NextRequest } from "next/server";
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH, updateDetails } from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";

/** Changes the name and the description shown on the creator's public page. */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;

  const name = text(guarded.body.name, MAX_NAME_LENGTH);
  const bio = text(guarded.body.bio, MAX_BIO_LENGTH);

  try {
    const result = await updateDetails(guarded.email, name, bio);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return Response.json({
      ok: true,
      name: result.store.name,
      bio: result.store.bio,
    });
  } catch (error) {
    console.error("saving the store details failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
