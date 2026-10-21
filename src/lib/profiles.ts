// Clinician profiles (spec v2 section 5c). Shared by the server and the browser.

export const EDUCATION_LEVELS = ["Certificate", "Diploma", "Associate", "Bachelor's", "Master's", "Doctorate", "Other"] as const;

/** Quick-add certifications (spec v2). */
export const QUICK_CERTS = ["BLS (Basic Life Support)", "CPR", "First Aid", "HHA certification", "CNA certification"] as const;

const DAY = 86_400_000;

/** Current, Expires soon (within 60 days) or Expired, from a "YYYY-MM-DD" expiry. No date: none. */
export function certificationStatus(expiry: string, today = new Date()): "current" | "soon" | "expired" | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  const end = new Date(`${expiry}T23:59:59Z`).getTime();
  const now = today.getTime();
  if (end < now) return "expired";
  return end - now <= 60 * DAY ? "soon" : "current";
}

export const CERT_STATUS = {
  current: { label: "Current", variant: "success" },
  soon: { label: "Expires soon", variant: "warning" },
  expired: { label: "Expired", variant: "danger" },
} as const;

/** Licensed disciplines show the licence fields; aides and CNAs don't (spec v2). */
export const hasLicence = (discipline: string | null) => discipline !== "HHA";
