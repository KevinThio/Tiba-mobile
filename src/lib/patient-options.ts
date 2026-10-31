// Choices on Add patient (spec v2 section 4b and the prototype).

export const SERVICES = [
  { value: "RN", label: "Skilled nursing (RN)" },
  { value: "PT", label: "Physical therapy" },
  { value: "OT", label: "Occupational therapy" },
  { value: "ST", label: "Speech therapy" },
  { value: "HHA", label: "Home health aide" },
  { value: "MSW", label: "Social work" },
] as const;

export type Service = (typeof SERVICES)[number]["value"];
export const SERVICE_VALUES = SERVICES.map((s) => s.value) as [Service, ...Service[]];

/** An aide can only be ordered when a nurse, PT or OT is on the case. */
export function aideNeedsSkilledCare(services: readonly string[]) {
  return services.includes("HHA") && !services.some((s) => s === "RN" || s === "PT" || s === "OT");
}

/** Insurers offered for the practice's country, after Self-pay. "Other" is typed in. */
const INSURERS: Record<string, string[]> = {
  US: ["Self-pay", "Aetna", "Blue Cross Blue Shield", "Cigna", "UnitedHealthcare", "Medicaid", "Medicare"],
  KE: ["Self-pay", "SHA (Social Health Authority)", "AAR Insurance", "Britam", "Jubilee Health", "CIC Insurance", "Madison"],
};

// Countries without a list yet get the general kinds of cover.
const GENERAL_INSURERS = ["Self-pay", "Private insurance", "Public or government scheme", "Employer scheme"];

export const insurersFor = (country: string) => INSURERS[country] ?? GENERAL_INSURERS;

/**
 * Offering a new patient (src/lib/patient-offers.ts): who can accept each type of care, by
 * discipline, and plain words for the offer. A new nursing patient needs an RN's evaluation, so
 * LPNs aren't offered them. Clinicians who haven't set their discipline aren't offered anyone.
 */
export const OFFER_FOR: Record<Service, { disciplines: string[]; care: string; who: string }> = {
  RN: { disciplines: ["RN"], care: "skilled nursing", who: "registered nurses" },
  PT: { disciplines: ["PT"], care: "physical therapy", who: "physical therapists" },
  OT: { disciplines: ["OT"], care: "occupational therapy", who: "occupational therapists" },
  ST: { disciplines: ["SLP"], care: "speech therapy", who: "speech-language pathologists" },
  HHA: { disciplines: ["HHA"], care: "a home health aide", who: "home health aides" },
  MSW: { disciplines: ["MH"], care: "social work", who: "mental health therapists" },
};

export const isService = (value: unknown): value is Service =>
  typeof value === "string" && (SERVICE_VALUES as string[]).includes(value);

/** The types of care a clinician of this discipline can accept. */
export const servicesForDiscipline = (discipline: string | null) =>
  discipline ? SERVICE_VALUES.filter((s) => OFFER_FOR[s].disciplines.includes(discipline)) : [];
