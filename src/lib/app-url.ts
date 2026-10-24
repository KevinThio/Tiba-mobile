/**
 * Tiba's public address, for links in emails and for Better Auth: BETTER_AUTH_URL when set (the
 * practice's own domain), else the address the host gives the app (Render's RENDER_EXTERNAL_URL,
 * or Vercel's production domain), so a first deploy works before a domain is connected. Empty
 * when none is known.
 */
export function appUrl() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (vercel ? `https://${vercel}` : "")
  ).replace(/\/+$/, "");
}
