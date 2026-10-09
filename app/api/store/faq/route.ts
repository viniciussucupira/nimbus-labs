import type { NextRequest } from "next/server";
import { setFaq } from "@/lib/store";
import { guardStoreWrite } from "@/lib/store-request";
import { MAX_FAQ, MAX_FAQ_A, MAX_FAQ_Q } from "@/lib/store-faq";

/** Saves the store's own questions and answers: `{ items: [{ q, a }] }` (lib/store-faq.ts). Part of the page, so "page". */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request, "page", MAX_FAQ * (MAX_FAQ_Q + MAX_FAQ_A) * 2 + 2_000);
  if (!guarded.ok) return guarded.response;
  try {
    const store = await setFaq(guarded.ref, guarded.body.items);
    if (!store) return Response.json({ ok: false, error: "none" }, { status: 404 });
    return Response.json({ ok: true, faq: store.faq });
  } catch (error) {
    console.error("saving a store's questions failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
