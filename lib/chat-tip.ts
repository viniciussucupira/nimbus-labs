/**
 * The pass a member's page shows to ask whether a room has anything new.
 *
 * The question itself is answered by the CDN for everybody at once
 * (lib/chat-pace.ts), so it cannot ask who is asking: no cookie is read. What
 * it asks for instead is this pass, which only a page drawn for somebody who
 * is in the community carries. It is made from the community's id with a key
 * of this deployment's own (lib/secret-box.ts), so it cannot be worked out
 * from the id, and it opens nothing but one number: how many messages the
 * room has had. The messages are still asked for by name.
 *
 * Empty where this deployment has no key to make it from. The page then
 * asks the old way, at the new pace.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { COMMUNITY_ID } from "@/lib/community-text";
import { deriveKey } from "@/lib/secret-box";

export function roomPass(id: string): string {
  const key = deriveKey("chat-tip");
  if (!key || !COMMUNITY_ID.test(id)) return "";
  return createHmac("sha256", key).update(id).digest("hex").slice(0, 32);
}

export function passFits(id: string, pass: string): boolean {
  const made = roomPass(id);
  if (!made || typeof pass !== "string" || pass.length !== made.length) return false;
  return timingSafeEqual(Buffer.from(made), Buffer.from(pass));
}
