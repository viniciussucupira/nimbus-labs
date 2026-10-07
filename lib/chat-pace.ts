/**
 * How often an open room asks whether anything is new: the rules.
 *
 * The room has no socket held open (lib/community-chat.ts): the page asks.
 * Until October 7, 2026 it asked every four seconds, of a route that read the
 * store, the member and the room each time, about ten commands to the
 * database and a function call for every look. One member with the room open
 * and in front of them for a working day cost about seventeen cents, a
 * hundred of them more than five hundred dollars a month, on any plan, with
 * nothing set against it.
 *
 * Two things replace that:
 *
 *   - The look itself is nearly free. What is asked every few seconds is one
 *     small number, the number of the room's last message, from an address
 *     the CDN answers for everybody in the room at once (app/api/store/
 *     community/chat/tip). Only when that number has moved does a reader ask
 *     for the messages, which is the question that needs to know who they are.
 *   - The asking slows by itself. Every four seconds while people are
 *     talking; less often as the room goes quiet; and less often for a
 *     reader who has not touched the page in a while, however busy the room.
 *     Somebody who comes back is asked for at once.
 *
 * Nothing here touches the network: the page and the route read the same
 * figures, and tests/community-pace.test.ts holds what they come to.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** While somebody spoke this recently, the room is talking. */
export const TALKING_FOR_MS = 2 * MINUTE;
/** After this long with nothing said, the room is quiet. */
export const QUIET_AFTER_MS = 10 * MINUTE;
/** A reader who has not touched the page for this long has walked away from it. */
export const AWAY_AFTER_MS = 10 * MINUTE;

/** How often a room that is talking, cooling or quiet is asked about, in ms. */
export const ASK_TALKING_MS = 4 * SECOND;
export const ASK_COOLING_MS = 10 * SECOND;
export const ASK_QUIET_MS = 30 * SECOND;

/**
 * How long until this reader asks again, in ms.
 *
 * `quietMs`: since anything was last said in the room, as far as the reader
 * knows. `awayMs`: since this reader last touched the page.
 */
export function askEvery(quietMs: number, awayMs: number): number {
  if (!(awayMs < AWAY_AFTER_MS)) return ASK_QUIET_MS;
  if (quietMs < TALKING_FOR_MS) return ASK_TALKING_MS;
  if (quietMs < QUIET_AFTER_MS) return ASK_COOLING_MS;
  return ASK_QUIET_MS;
}

/**
 * How long the CDN may give everybody the same answer about a room, in
 * seconds: a little under how often its readers ask, so that one reader's
 * question answers the next one's.
 */
export function shareFor(quietMs: number): number {
  if (quietMs < TALKING_FOR_MS) return 3;
  if (quietMs < QUIET_AFTER_MS) return 8;
  return 25;
}

/** The most looks one reader can make in an hour, with the room talking and the page in front of them and in use. */
export const MOST_LOOKS_AN_HOUR = (60 * MINUTE) / ASK_TALKING_MS;
