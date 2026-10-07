/**
 * The pass a member's page shows to read what is new in a room.
 *
 * What is new is answered by the CDN for everybody in the room at once
 * (lib/chat-pace.ts), so the address that answers cannot ask who is asking:
 * no cookie is read there. What it asks for instead is this pass, which
 * only a page drawn for somebody who is in the community is handed
 * (lib/chat-grant.ts). It is made from the community's id and the ten
 * minutes it was made in, with a key of this deployment's own
 * (lib/secret-box.ts), so it cannot be worked out from the id, and it is
 * good for those ten minutes and the ten after. A member who leaves, or is
 * taken out, is handed no new one: what they could read ends within twenty
 * minutes, with nothing to revoke.
 *
 * Everybody in a room at one time holds the same pass, on purpose: it is
 * part of the address, and the same address is what lets one answer serve
 * them all.
 *
 * Empty where this deployment has no key to make it from. The page then
 * asks the old way, by name, at the new pace.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { GRANT_MS } from "@/lib/chat-pace";
import { COMMUNITY_ID } from "@/lib/community-text";
import { deriveKey } from "@/lib/secret-box";

/** The ten minutes a moment falls in, numbered. */
export function slotOf(now: number): number {
  return Math.floor(now / GRANT_MS);
}

function passOf(id: string, slot: number): string {
  const key = deriveKey("chat-pass");
  if (!key || !COMMUNITY_ID.test(id)) return "";
  return createHmac("sha256", key).update(`${id}:${slot}`).digest("hex").slice(0, 32);
}

/** The pass for a room, made now. */
export function roomPass(id: string, now = Date.now()): string {
  return passOf(id, slotOf(now));
}

/** Whether a pass opens a room now: made in these ten minutes or the ten before. */
export function passFits(id: string, pass: string, now = Date.now()): boolean {
  if (typeof pass !== "string" || !/^[0-9a-f]{32}$/.test(pass)) return false;
  const slot = slotOf(now);
  return [slot, slot - 1].some((one) => {
    const made = passOf(id, one);
    return made.length === pass.length && timingSafeEqual(Buffer.from(made), Buffer.from(pass));
  });
}
