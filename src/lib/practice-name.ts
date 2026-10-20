/**
 * Practice names match ignoring case, punctuation and spacing, so a clinician who types
 * "reyes therapy" joins "Reyes Therapy." Must match the SQL in
 * drizzle/0006_practices_and_verification.sql. Names with no Latin letters or digits
 * fall back to the trimmed, lower-cased name.
 */
export function normalisePracticeName(name: string) {
  const lower = name.toLowerCase();
  return lower.replace(/[^a-z0-9]+/g, " ").trim() || lower.trim();
}
