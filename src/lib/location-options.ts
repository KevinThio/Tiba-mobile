// Choices on Add location (spec v2 and the prototype). Services include the prototype's
// therapy list plus the discipline services from the 20 Oct update.

export const FACILITIES = ["Outpatient clinic", "Community centre", "Hospital-based", "Telehealth", "Home visits"] as const;
export type Facility = (typeof FACILITIES)[number];

/** Telehealth has no building, so its address is optional. */
export const addressOptional = (facility: string) => facility === "Telehealth";

export const LOCATION_SERVICES = [
  "Individual therapy",
  "Couples therapy",
  "Family therapy",
  "Assessment",
  "Group therapy",
  "Follow-up call",
  "Physical therapy",
  "Occupational therapy",
  "Speech therapy",
  "Skilled nursing",
  "Home health aide",
] as const;
