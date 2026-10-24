/**
 * Tiba's public address, for links in emails and for Better Auth: BETTER_AUTH_URL when set (the
 * practice's own domain), else the address Render gives the service (RENDER_EXTERNAL_URL), so a
 * first deploy works before a domain is connected. Empty when neither is known.
 */
export function appUrl() {
  return (process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
}
