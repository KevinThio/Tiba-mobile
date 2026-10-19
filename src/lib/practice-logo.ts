// Practice logo storage format, shared by the save action and the image route.
// The browser resizes the upload to at most LOGO_MAX_PX and re-encodes it as PNG
// (or JPEG if the PNG is too big), so only these two formats are ever stored.
// SVG is never stored: it can carry scripts, and the PDF renderer can't draw it.

export const LOGO_MAX_PX = 512;
export const LOGO_MAX_DATA_URL_LENGTH = 600_000; // roughly 450 KB of image

const DATA_URL = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Returns the decoded image, or null if it isn't a PNG/JPEG data URL of an allowed size. */
export function parseLogoDataUrl(dataUrl: string): { mime: "image/png" | "image/jpeg"; bytes: Buffer } | null {
  if (dataUrl.length > LOGO_MAX_DATA_URL_LENGTH) return null;
  const match = DATA_URL.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] as "image/png" | "image/jpeg";
  const bytes = Buffer.from(match[2], "base64");
  // Check the file really is what it claims to be.
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((mime === "image/png" && !isPng) || (mime === "image/jpeg" && !isJpeg)) return null;
  return { mime, bytes };
}

/** URL of the signed-in clinician's logo. `version` busts the browser cache after a change. */
export function practiceLogoUrl(version: Date | string | number) {
  return `/api/practice-logo?v=${new Date(version).getTime()}`;
}
