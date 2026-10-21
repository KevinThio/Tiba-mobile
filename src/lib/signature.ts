// Drawn signatures (signature_pad) arrive as PNG data URLs. They're stored as they are, so check
// that each one really is a reasonably sized PNG before saving it.

const PREFIX = "data:image/png;base64,";
const MAX_BYTES = 300_000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isSignatureImage(dataUrl: string): boolean {
  if (!dataUrl.startsWith(PREFIX)) return false;
  const base64 = dataUrl.slice(PREFIX.length);
  if (!base64 || base64.length > (MAX_BYTES * 4) / 3 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return false;
  const bytes = Buffer.from(base64, "base64");
  return bytes.length > PNG_MAGIC.length && PNG_MAGIC.every((b, i) => bytes[i] === b);
}
