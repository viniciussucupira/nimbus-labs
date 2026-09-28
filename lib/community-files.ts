/**
 * The real file store behind lib/community-image.ts: Vercel Blob, private,
 * the same one product pictures and paid files live in. Kept apart from the
 * checks so they can be tried against a stand-in without a network.
 */
import { createHash } from "node:crypto";
import { del, get, head } from "@/lib/blob";
import { redisPipeline } from "@/lib/redis";
import type { ImageStore } from "@/lib/community-image";

async function firstBytes(path: string): Promise<Uint8Array | null> {
  const found = await get(path, { access: "private" });
  if (!found || found.statusCode !== 200 || !found.stream) return null;
  const reader = found.stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < 16) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    length += value.length;
  }
  await reader.cancel().catch(() => {});
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

export const blobImages: ImageStore = {
  async head(path) {
    const found = await head(path);
    return { size: found.size, contentType: found.contentType };
  },
  firstBytes,
  async del(path) {
    await del(path);
  },
};

/** A day: the door is open five minutes, the post can be written later. */
const UPLOAD_TTL_SECONDS = 24 * 60 * 60;

function uploadKey(path: string): string {
  return `nl:cimg:${createHash("sha256").update(path).digest("hex").slice(0, 32)}`;
}

/** Notes who was given the door for a picture's path, when it is given. */
export async function noteCommunityUpload(path: string, author: string): Promise<void> {
  await redisPipeline([["SET", uploadKey(path), author, "NX", "EX", UPLOAD_TTL_SECONDS]]);
}

/**
 * Whether this picture was sent by this member and not used yet; it is then
 * theirs for this one post only. Somebody else's picture, or one already in
 * a post, is refused and left alone.
 */
export async function takeCommunityUpload(path: string, author: string): Promise<boolean> {
  const [held] = await redisPipeline([["GETDEL", uploadKey(path)]]);
  if (held === author) return true;
  if (typeof held === "string" && held) {
    await redisPipeline([["SET", uploadKey(path), held, "NX", "EX", UPLOAD_TTL_SECONDS]]).catch(() => null);
  }
  return false;
}

/** Deletes a picture a post no longer needs. Best effort: never throws. */
export async function dropCommunityImage(path: string | undefined | null): Promise<void> {
  if (!path) return;
  await del(path).catch((error: unknown) => console.error("could not delete a community picture", error));
}
