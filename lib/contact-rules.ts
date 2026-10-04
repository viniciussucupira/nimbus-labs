/**
 * The published limits of a store's list.
 *
 * They live apart from lib/contacts.ts because that file opens a Redis
 * connection and hashes addresses, and a marketing page that cannot import
 * the real number ends up retyping it — which is how a site starts
 * advertising a limit the code does not hold. Nothing here reads an
 * environment variable or a secret, so a client component may import it.
 */

/** How many addresses one store's list may hold, on either plan. */
export const MAX_LEADS = 100_000;

/** How many addresses one paste-import may bring at a time. */
export const MAX_IMPORT = 5_000;

/** "100,000", for a sentence. */
export function listSizeWords(): string {
  return MAX_LEADS.toLocaleString("en-US");
}
