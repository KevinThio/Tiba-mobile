/** Why a visit was missed (spec v2 Appointment "missed reason"). "Other" asks for the reason in words. */
export const MISSED_REASONS = [
  "Patient wasn't home",
  "Patient cancelled at short notice",
  "Patient was in hospital",
  "Patient refused the visit",
  "I couldn't make it",
] as const;
