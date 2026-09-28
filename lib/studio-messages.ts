/**
 * What every studio form says when the store's own checks turn a change
 * away (lib/studio-route.ts): each form's own words for these come first.
 */
export const STUDIO_MESSAGES: Record<string, string> = {
  role: "Your role on this store does not include this. The store's owner can change your role.",
  store_gone: "This store was deleted, or you are no longer on its team. Reload the page to see your stores.",
};
