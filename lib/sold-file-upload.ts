/**
 * Uploads a file that is sold, from the studio's browser, to whichever file
 * store takes new files.
 *
 * The store that charges nothing for a download when it is set up
 * (lib/vault-upload.ts); the host's own when it is not, exactly as before.
 * Every place in the studio that uploads a sold file — a product's, a price
 * option's, a lesson's, an episode's — goes through here, so none of them
 * can be left sending files to the dearer store.
 *
 * Resolves with the path to tell the product, lesson or episode. Throws what
 * the store's own uploader throws: `uploadReason` reads either kind.
 */
import { uploadPresigned } from "@vercel/blob/client";
import { MULTIPART_ABOVE_BYTES, fileFolder, safeFileName } from "@/lib/product-file";
import { VaultUploadError, vaultUpload } from "@/lib/vault-upload";

export async function uploadSoldFile(
  file: File,
  where: { folder: string; ownerId: string },
  onProgress: (percent: number) => void,
): Promise<string> {
  const kept = await vaultUpload(file, where.ownerId, safeFileName(file.name), { onProgress });
  if (kept) return kept.pathname;

  const result = await uploadPresigned(fileFolder(where.folder, where.ownerId) + safeFileName(file.name), file, {
    access: "private",
    handleUploadUrl: "/api/store/file",
    clientPayload: JSON.stringify({ productId: where.ownerId }),
    // In parts once it is worth it, so a dropped connection costs one part
    // rather than the whole upload.
    multipart: file.size > MULTIPART_ABOVE_BYTES,
    onUploadProgress: (progress) => onProgress(progress.percentage),
  });
  return result.pathname;
}

/**
 * Why an upload failed, as one of the words the studio has a sentence for:
 * `wrong_type`, `too_big`, `storage_full`, `slow_down`, `upload_stopped`,
 * `files_unavailable`, `signed_out`, `unknown`, or `server_error` for
 * anything else.
 */
export function uploadReason(thrown: unknown): string {
  if (thrown instanceof VaultUploadError) return thrown.reason;
  if (thrown instanceof Error && /content type|not allowed/i.test(thrown.message)) return "wrong_type";
  return "server_error";
}
