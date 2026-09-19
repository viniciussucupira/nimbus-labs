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
 * It is not a technical ceiling — the storage takes far more. It is a money
 * ceiling. Storage and download are both metered, so a cap that nobody sane
 * hits keeps the bill near zero while the platform has no paying creators,
 * and fifty megabytes is past what a book, a pack of templates or a set of
 * presets needs. Raising it is one number and a sentence on the help page.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

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

/** A size a person reads: 2.4 MB, 812 KB. */
export function readableSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** Keeps a file name that is safe to put in a header and to save to a disk. */
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f"\\]/g, "").trim();
  return cleaned.slice(0, 120) || "file";
}
