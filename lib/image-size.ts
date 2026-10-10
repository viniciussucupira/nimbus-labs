/**
 * How wide and tall a WebP or a JPEG is, read from its own first bytes, or
 * null. A creator's browser measures the picture it uploads; here nothing
 * drew it, so the file is asked.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const text = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    const kind = text(12, 4);
    if (kind === "VP8X") {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height };
    }
    if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    }
    if (kind === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      const length = (bytes[at + 2] << 8) | bytes[at + 3];
      // A start-of-frame marker: every C0–CF but the three that are tables.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: (bytes[at + 7] << 8) | bytes[at + 8], height: (bytes[at + 5] << 8) | bytes[at + 6] };
      }
      if (length < 2) return null;
      at += 2 + length;
    }
  }
  return null;
}
