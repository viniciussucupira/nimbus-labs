/**
 * What every studio form says when the store's own checks turn a change
 * away (lib/studio-route.ts): each form's own words for these come first.
 */
export const STUDIO_MESSAGES: Record<string, string> = {
  role: "Your role on this store does not include this. The store's owner can change your role.",
  store_gone: "This store was deleted, or you are no longer on its team. Reload the page to see your stores.",
  // What an upload of a file that is sold can be told (lib/sold-file-upload.ts).
  storage_full: "Your store is holding as much as one store can hold. Delete a file you no longer sell to make room — nothing already bought is affected.",
  upload_stopped: "The upload stopped before the end, and could not go on. Check your connection and upload the file again.",
  slow_down: "That is a lot of uploads in one hour. Try again a little later.",
  files_unavailable: "Files cannot be taken in just now. Try again in a few minutes.",
};
