/**
 * Pictures in a creator's email (added 10 October 2026), as rules the
 * browser can read too. The part that keeps one is lib/mail-pictures.ts.
 *
 * An email stays plain text the creator can read and edit: a picture is a
 * line of its own, `![what it shows](address)`, put there by "Add a picture"
 * in the studio. Only a picture kept here becomes one — a JPEG in a store's
 * own picture folder, served from this site and cached for a year — so an
 * email can never carry a picture from elsewhere, nor anything that reports
 * back when it is opened. JPEG because Outlook on Windows shows no WebP.
 * Anything else written that way stays the text it is.
 */
import { SITE_URL } from "@/lib/site-url";

/** The longest side a picture in an email is made, twice the width it is shown at. */
export const MAIL_PICTURE_SIDE = 1200;
/** The most one picture may weigh. */
export const MAX_MAIL_PICTURE_BYTES = 300_000;
/** The most pictures one email shows; any past it stay text. */
export const MAX_MAIL_PICTURES = 6;
/** The longest description a picture keeps. */
export const MAX_PICTURE_ALT = 200;

const escaped = SITE_URL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const LINE = new RegExp(`^!\\[([^\\]\\n]{0,${MAX_PICTURE_ALT}})\\]\\((${escaped}/api/image/[0-9a-f]{24}/[0-9a-f]{32}\\.jpg)\\)$`);

/** The address a kept picture is shown from. */
export function pictureUrl(folder: string, file: string): string {
  return `${SITE_URL}/api/image/${folder}/${file}`;
}

/** A line of an email, read as a picture: what it shows and where it is; null for any other line. */
export function readPicture(line: string): { alt: string; url: string } | null {
  const match = line.trim().match(LINE);
  return match ? { alt: match[1].trim(), url: match[2] } : null;
}

/** The line that puts a picture in an email. Brackets and line breaks in the description are dropped. */
export function pictureLine(alt: string, url: string): string {
  const clean = alt.replace(/[[\]\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_PICTURE_ALT);
  return `![${clean}](${url})`;
}

/** How many pictures an email holds. */
export function pictureCount(body: string): number {
  return body.split("\n").filter((line) => readPicture(line) !== null).length;
}

/**
 * The email as plain text, for readers whose app shows no pictures: each
 * picture becomes its description in brackets, or goes when it has none.
 */
export function withoutPictures(body: string): string {
  return body
    .split("\n")
    .flatMap((line) => {
      const picture = readPicture(line);
      if (!picture) return [line];
      return picture.alt ? [`[${picture.alt}]`] : [];
    })
    .join("\n");
}
