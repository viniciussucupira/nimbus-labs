/**
 * The numbers a store photo is held to, kept apart from the code that stores
 * it so the studio can read them in the browser without pulling that in.
 */

/** The most a photo may weigh once the browser has shrunk it. */
export const MAX_PHOTO_BYTES = 200_000;

/** The side, in pixels, the browser shrinks the square crop to. */
export const PHOTO_SIDE = 480;

/** What a photo id looks like: 32 hex characters, and nothing else. */
export const PHOTO_ID_PATTERN = /^[0-9a-f]{32}$/;

/** Where a photo is served from. It never changes for a given photo. */
export function photoUrl(id: string): string {
  return `/api/photo/${id}`;
}
