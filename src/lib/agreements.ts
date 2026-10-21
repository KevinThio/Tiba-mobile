import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, patients, practices, serviceAgreements } from "@/db/schema";
import {
  DEFAULT_CLAUSES,
  newDetails,
  renderClauses,
  type AgreementClause,
  type AgreementDetails,
  type AgreementStatus,
} from "@/lib/agreement-template";

// Service agreements (spec v2 section 5). The wording is the practice's (admin Settings, default
// in src/lib/agreement-template.ts); the details are entered per patient, pre-filled from the
// patient record. Once anyone signs, the wording and details are fixed.

/** The practice's agreement wording: its own, or Tiba's default. */
export async function practiceAgreementClauses(practiceId: string): Promise<AgreementClause[]> {
  const [p] = await db.select({ template: practices.agreementTemplate }).from(practices).where(eq(practices.id, practiceId));
  return p?.template?.length ? p.template : DEFAULT_CLAUSES;
}

/** The patient's agreement (or what a new one would be), if the patient is in the practice. */
export async function loadAgreement(patientId: string, practiceId: string, adminName = "") {
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return null;
  const [p] = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      referralDate: patients.referralDate,
      address: patients.address,
      phone: patients.phone,
      insurer: patients.insurer,
      servicesOrdered: patients.servicesOrdered,
      clinicianName: clinicians.name,
      practiceName: practices.name,
    })
    .from(patients)
    .innerJoin(clinicians, eq(clinicians.id, patients.clinicianId))
    .innerJoin(practices, eq(practices.id, patients.practiceId))
    .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId), ne(patients.status, "merged")));
  if (!p) return null;

  const [saved] = await db.select().from(serviceAgreements).where(eq(serviceAgreements.patientId, patientId));
  const details =
    (saved?.details as AgreementDetails | null) ??
    newDetails({ address: p.address, phone: p.phone, insurer: p.insurer, services: p.servicesOrdered, witnessName: adminName });
  const started = Boolean(saved?.patientSignature || saved?.adminSignature);
  const clauses = started ? null : await practiceAgreementClauses(practiceId);
  // Signed agreements keep the wording as signed; otherwise it's rendered from today's wording.
  const sections = started && saved ? saved.sections : renderClauses(clauses!, { practice: p.practiceName, client: p.fullName, details });
  return {
    patient: p,
    agreement: saved ?? null,
    details,
    sections,
    started,
    parties: saved?.parties ?? `Between ${p.practiceName} and ${p.fullName}`,
  };
}

/** Where an agreement stands: not started, details saved, signed by one side, or complete. */
export function agreementStatus(
  a: { patientSignature: string | null; adminSignature: string | null; refused?: boolean; details?: unknown } | null,
): AgreementStatus {
  if (!a) return "none";
  if (a.adminSignature && a.refused) return "refused";
  if (a.patientSignature && a.adminSignature) return "signed";
  if (a.patientSignature) return "patient";
  if (a.adminSignature) return "admin";
  return a.details ? "draft" : "none";
}

export const isComplete = (status: AgreementStatus) => status === "signed" || status === "refused";
