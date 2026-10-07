/**
 * The address a creator's email to people goes out from.
 *
 * An inbox decides where an email lands largely by who it is from: the
 * address, and the domain that signed it. Until October 7, 2026 every email
 * this site sent had the same one. A creator's newsletter and the link
 * somebody logs in with both came from hello@ on the site's own domain, so a
 * reader who marked one creator's email as spam taught their mail service
 * something about the address every login link and every receipt comes
 * from, and about every other creator's email too. Google's guidelines for
 * senders ask for the opposite: a different address for each kind of email
 * (support.google.com/a/answer/81126, read that day).
 *
 * So, when a domain is set apart for it, each creator writes from an address
 * of their own on that domain, made from the store's handle:
 *
 *   "Harbor Kitchen" <harborkitchen@mail.marktmorgen.com>
 *
 * and the site's own email (login links, receipts, files, notices) stays on
 * the address it always had. What a reader thinks of one creator's email is
 * then kept against that creator's address, and against a domain no login
 * link is sent from.
 *
 * One setting, and it is not a secret:
 *
 *   MARKETING_FROM_DOMAIN   the domain creators write from: a subdomain of
 *                           the site's, proved at each service that sends
 *                           (its own DKIM record, and the records for the
 *                           address bounces come back to)
 *
 * Without it, or with a value that is not a domain or is the very domain
 * the site's own email comes from, everything is sent as before: a setting
 * left out or mistyped must never stop an email.
 *
 * At Resend a key may be held to one domain. The key this site sends with
 * (RESEND_API_KEY) may send from every domain of its account, the creators'
 * included; a second key held to the creators' domain alone can be given as
 * RESEND_CREATORS_API_KEY and is used for it when it is there. And if
 * Resend ever refuses the creators' domain for the key it is given (a key
 * narrowed again, a domain taken off the account), the same email goes at
 * once from the site's own address instead (lib/email.ts): late to its
 * right address is better than not sent.
 *
 * Replies never go to this address: every one of these emails carries
 * Reply-To with the creator's own.
 */

const DOMAIN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/** The domain of an address, or of a "Name <address>" line; "" when there is none. */
export function domainOf(line: string): string {
  const match = line.match(/<([^>]+)>/);
  const address = (match ? match[1] : line).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  return at > 0 ? address.slice(at + 1) : "";
}

/**
 * The domain creators write from, or null when none is set apart.
 * `siteFrom` is the line the site's own email is sent from.
 */
export function creatorDomain(siteFrom: string, raw = process.env.MARKETING_FROM_DOMAIN): string | null {
  const domain = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!DOMAIN.test(domain)) return null;
  // On the site's own domain a store called "hello" would be the address
  // login links come from.
  if (domain === domainOf(siteFrom)) return null;
  return domain;
}

/**
 * A store's own address on that domain, or null when there is no domain or
 * the handle cannot be the first half of an address.
 */
export function creatorAddress(handle: string, siteFrom: string, raw = process.env.MARKETING_FROM_DOMAIN): string | null {
  const domain = creatorDomain(siteFrom, raw);
  if (!domain) return null;
  // A handle may hold two full stops in a row, which an address may not.
  const name = handle.trim().toLowerCase().replace(/\.{2,}/g, ".");
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(name)) return null;
  return `${name}@${domain}`;
}

/**
 * The same From line with the site's own address in place of the creator's:
 * what an email is sent again as when the sender refuses the creators'
 * domain. The name in front stays the creator's.
 */
export function atSiteAddress(from: string, siteFrom: string): string {
  const site = siteFrom.match(/<([^>]+)>/);
  const address = (site ? site[1] : siteFrom).trim();
  const named = from.match(/^\s*("?[^"<]*"?)\s*<[^>]+>\s*$/);
  return named && named[1].trim() ? `${named[1].trim()} <${address}>` : address;
}
