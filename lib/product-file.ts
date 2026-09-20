/**
 * The file a creator sells: where it lives, how big it may be, and what it
 * may be.
 *
 * Files are held in a private Blob store. A private blob has a URL, but that
 * URL answers nothing without a token, so a link that leaks is worth nothing
 * and the file can only ever leave through a route of ours that checked who
 * is asking. That is the whole reason the store is private rather than public:
 * a public blob URL is a permanent key to the product, and the first person
 * who shares it has given the product away.
 */

/**
 * The biggest file a store may hold, and why this number.
 *
 * Five gigabytes, which is what Stan says it supports, so a creator choosing
 * between the two is never choosing on this. It used to be fifty megabytes,
 * set when nothing could be delivered without passing through a function and
 * a big file therefore could not be delivered at all.
 *
 * It is still a money ceiling as much as a technical one. Storage is cheap
 * — pennies per gigabyte per month — but delivery is not, so what actually
 * bounds the bill is how much is sent in a month rather than how big any one
 * file is. That allowance is the thing to publish and enforce.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Above this, the browser uploads in parts rather than in one request.
 *
 * A single request carrying a gigabyte is one dropped connection away from
 * starting again from nothing. In parts, only the failed part repeats.
 */
export const MULTIPART_ABOVE_BYTES = 20 * 1024 * 1024;

/**
 * Above this, a paid download is a redirect rather than a stream.
 *
 * Streaming through our own function lets us set the saved file name and
 * force a download, which is nicer, so small files still go that way. But
 * every byte then counts twice — data transfer out of storage and origin
 * transfer out of the function — and the function has a time limit a large
 * file on a slow line will pass. Above this size the buyer is redirected to
 * a signed URL that expires in minutes, the bytes go straight from storage,
 * and the download cannot time out.
 */
export const REDIRECT_ABOVE_BYTES = 20 * 1024 * 1024;

/** How long a signed download URL stays good. Long enough to start, no more. */
export const DOWNLOAD_URL_SECONDS = 5 * 60;

/**
 * What a creator may sell.
 *
 * Documents, pictures, sound, video and archives. Anything that runs — an
 * installer, a script, a program — is refused, because a store that hands out
 * executables is a store that hands out malware the day someone takes an
 * account over, and no creator here has asked to sell one.
 */
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/epub+zip": ".epub",
  "application/zip": ".zip",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/mp4": ".m4a",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "text/markdown": ".md",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
};

/** The list for the file picker, so the creator sees only what will be taken. */
export const ACCEPT_ATTRIBUTE = Object.values(ALLOWED_TYPES).join(",");

export const ALLOWED_CONTENT_TYPES = Object.keys(ALLOWED_TYPES);

/** One file on one product. */
export type ProductFile = {
  /** Where it sits in the private store. The only handle we keep. */
  pathname: string;
  /** What the creator called it. What the buyer will see it saved as. */
  name: string;
  bytes: number;
  contentType: string;
  addedAt: string;
};

/**
 * The folder that belongs to one store and one product.
 *
 * Every upload is forced under this prefix, and every file we read back is
 * checked against it. Two creators therefore cannot reach each other's files
 * even if one of them sends us a pathname by hand: the folder is derived from
 * their own account, never from anything they typed.
 */
export function fileFolder(storeFolder: string, productId: string): string {
  return `stores/${storeFolder}/${productId}/`;
}

/** Whether a pathname really is this store's and this product's. */
export function ownsPath(
  pathname: string,
  storeFolder: string,
  productId: string,
): boolean {
  if (typeof pathname !== "string") return false;
  if (pathname.includes("..") || pathname.includes("//")) return false;
  const prefix = fileFolder(storeFolder, productId);
  if (!pathname.startsWith(prefix)) return false;
  // Nothing after the folder may open another folder.
  return !pathname.slice(prefix.length).includes("/");
}

/** A size a person reads: 1.4 GB, 2.4 MB, 812 KB. */
export function readableSize(bytes: number): string {
  const gb = 1024 * 1024 * 1024;
  // "5 GB" rather than "5.0 GB": a round number reads as a limit, and a
  // limit with a decimal on it reads as a measurement of something.
  if (bytes >= gb) {
    const size = (bytes / gb).toFixed(1).replace(/\.0$/, "");
    return `${size} GB`;
  }
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** The limit, said the way the pages say it. */
export function maxFileLabel(): string {
  return readableSize(MAX_FILE_BYTES);
}

/** Keeps a file name that is safe to put in a header and to save to a disk. */
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f"\\]/g, "").trim();
  return cleaned.slice(0, 120) || "file";
}
