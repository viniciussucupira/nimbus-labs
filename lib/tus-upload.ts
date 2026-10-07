/**
 * Sends a large file in pieces, and goes on from where it stopped.
 *
 * A lesson's video goes from the creator's browser straight to the service
 * that keeps it (lib/stream.ts), which takes uploads by the tus protocol
 * (tus.io, version 1.0.0). The protocol is three requests, and they are
 * written out here rather than taken from a library, as the signature for
 * Amazon is (lib/aws-sign.ts): this is the one place the site speaks it.
 *
 *   POST   to the service's address, with the file's length and its name:
 *          it answers 201 and, in `Location`, an address for this upload.
 *   PATCH  to that address, with a piece of the file and the place in the
 *          file it starts at (`Upload-Offset`): it answers 204 and the
 *          place it has now reached.
 *   HEAD   to that address: it answers the place it has reached. Asked after
 *          a piece fails, because a piece that failed on the way back may
 *          have arrived all the same, and one that failed on the way there
 *          may have arrived in part.
 *
 * So a line that drops in the middle of a gigabyte costs the piece that was
 * in flight and no more. A piece is tried again after a pause that grows,
 * and the upload gives up only when the service has not been reached for a
 * few minutes together, or says the upload no longer exists.
 *
 * Runs in the browser and nowhere else touches it; it asks for nothing but
 * `fetch`, so the tests give it a stand-in for the service and break the
 * line where they like (tests/tus-upload.test.ts).
 */

/** The protocol's version, sent with every request. */
const TUS_VERSION = "1.0.0";

/** One piece. Small enough that a dropped line costs little, large enough that a gigabyte is not a thousand requests. */
export const PIECE_BYTES = 8 * 1024 * 1024;

/** The pauses before a piece is tried again, in ms. After the last one the upload gives up. */
export const RETRY_PAUSES_MS = [1_000, 3_000, 5_000, 10_000, 20_000, 60_000, 60_000];

export type TusDoor = {
  /** The service's address for new uploads. */
  endpoint: string;
  /** What the service wants with every request to believe it. */
  headers: Record<string, string>;
  /** What the service is told about the file: its type, its name. */
  metadata: Record<string, string>;
};

export type TusOptions = {
  onProgress?: (percent: number) => void;
  pieceBytes?: number;
  pauses?: number[];
  /** Stand-ins, for the tests. */
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
};

/** Why an upload stopped: the service refused it, or was not there for too long. */
export class TusError extends Error {
  constructor(
    readonly reason: "refused" | "gone" | "unreachable",
    readonly status = 0,
  ) {
    super(`upload ${reason}${status ? ` (${status})` : ""}`);
  }
}

/** A value of the metadata header: UTF-8, in base64. */
function encoded(value: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** `key value,key value`, each value in base64, as the protocol writes it. */
export function metadataHeader(metadata: Record<string, string>): string {
  return Object.entries(metadata)
    .filter(([key]) => /^[A-Za-z0-9_-]+$/.test(key))
    .map(([key, value]) => `${key} ${encoded(value)}`)
    .join(",");
}

function offsetOf(response: Response): number | null {
  const raw = response.headers.get("Upload-Offset");
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Uploads `file` through `door`. Resolves when the service has every byte;
 * throws a TusError otherwise.
 */
export async function tusUpload(file: Blob, door: TusDoor, options: TusOptions = {}): Promise<void> {
  const send = options.fetcher ?? fetch;
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const piece = options.pieceBytes ?? PIECE_BYTES;
  const pauses = options.pauses ?? RETRY_PAUSES_MS;
  const common = { "Tus-Resumable": TUS_VERSION, ...door.headers };
  const told = (bytes: number) => options.onProgress?.(file.size === 0 ? 100 : Math.min(100, (bytes / file.size) * 100));

  // The address for this upload. Asking twice would make two, so a request
  // that failed without an answer is asked again only here, before a byte
  // has gone anywhere.
  let location = "";
  for (let attempt = 0; ; attempt += 1) {
    let response: Response | null = null;
    try {
      response = await send(door.endpoint, {
        method: "POST",
        headers: { ...common, "Upload-Length": String(file.size), "Upload-Metadata": metadataHeader(door.metadata) },
      });
    } catch {
      response = null;
    }
    if (response && response.status === 201) {
      const where = response.headers.get("Location");
      if (!where) throw new TusError("refused", 201);
      location = new URL(where, door.endpoint).toString();
      break;
    }
    if (response && response.status >= 400 && response.status < 500 && response.status !== 423 && response.status !== 429) {
      throw new TusError("refused", response.status);
    }
    if (attempt >= pauses.length) throw new TusError("unreachable", response?.status ?? 0);
    await wait(pauses[attempt]);
  }

  let offset = 0;
  let failures = 0;
  told(0);
  while (offset < file.size) {
    let response: Response | null = null;
    try {
      response = await send(location, {
        method: "PATCH",
        headers: { ...common, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
        body: file.slice(offset, Math.min(file.size, offset + piece)),
      });
    } catch {
      response = null;
    }
    const reached = response && response.status === 204 ? offsetOf(response) : null;
    if (reached !== null && reached > offset) {
      offset = reached;
      failures = 0;
      told(offset);
      continue;
    }
    if (response && (response.status === 404 || response.status === 410)) throw new TusError("gone", response.status);
    if (response && (response.status === 401 || response.status === 403 || response.status === 413 || response.status === 415)) {
      throw new TusError("refused", response.status);
    }

    // The piece did not go through, or we do not know that it did. Pause,
    // then ask the service where it has got to and go on from there.
    if (failures >= pauses.length) throw new TusError("unreachable", response?.status ?? 0);
    await wait(pauses[failures]);
    failures += 1;
    let asked: Response | null = null;
    try {
      asked = await send(location, { method: "HEAD", headers: common });
    } catch {
      asked = null;
    }
    if (asked && (asked.status === 404 || asked.status === 410)) throw new TusError("gone", asked.status);
    if (asked && (asked.status === 401 || asked.status === 403)) throw new TusError("refused", asked.status);
    const at = asked && asked.ok ? offsetOf(asked) : null;
    if (at !== null && at >= 0 && at <= file.size) {
      offset = at;
      told(offset);
    }
  }
  told(file.size);
}
