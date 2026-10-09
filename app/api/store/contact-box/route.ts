import type { NextRequest } from "next/server";
import { setContact } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";

/** Switches the contact form on the store page and saves its words: `{ on, heading, line }` (lib/store-contact.ts). */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page", 2_000);
  if (!guarded.ok) return guarded.response;
  try {
    const store = await setContact(guarded.ref, guarded.body);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 404 });
    return Response.json({ ok: true, contact: store.contact });
  } catch (error) {
    console.error("saving the contact form failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
