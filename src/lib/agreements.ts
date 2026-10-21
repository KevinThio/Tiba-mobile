import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, patients, practices, serviceAgreements, type AgreementSection } from "@/db/schema";
import { practiceBilling } from "@/lib/practice";
import { formatMoney } from "@/lib/countries";
import { SERVICES } from "@/lib/patient-options";

// Service agreements (spec v2 section 5): filled from the patient and practice details, signed by
// the patient and the admin on the device. The wording is the spec's placeholder (care, fees,
// cancelling, confidentiality, records, ending care) until the real outline arrives.

const day = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;

/** The patient's agreement (or the wording a new one would have), if the patient is in the practice. */
export async function loadAgreement(patientId: string, practiceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return null;
  const [p] = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      insurer: patients.insurer,
      servicesOrdered: patients.servicesOrdered,
      startOfCare: patients.startOfCare,
      clinicianName: clinicians.name,
      clinicianFee: clinicians.visitFeeMinor,
      clinicianFeeCurrency: clinicians.visitFeeCurrency,
      practiceName: practices.name,
    })
    .from(patients)
    .innerJoin(clinicians, eq(clinicians.id, patients.clinicianId))
    .innerJoin(practices, eq(practices.id, patients.practiceId))
    .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId), ne(patients.status, "merged")));
  if (!p) return null;
  const [saved] = await db.select().from(serviceAgreements).where(eq(serviceAgreements.patientId, patientId));
  if (saved) return { patient: p, agreement: saved, sections: saved.sections, parties: saved.parties };

  const billing = await practiceBilling(practiceId);
  const care = SERVICES.filter((s) => p.servicesOrdered.includes(s.value)).map((s) => s.label.replace(/ \(RN\)$/, "").toLowerCase());
  const fee =
    p.clinicianFee != null && p.clinicianFeeCurrency
      ? `Visits are ${formatMoney(p.clinicianFee, billing.country, p.clinicianFeeCurrency)} each.`
      : "Visit fees are agreed with you before care starts.";
  const sections: AgreementSection[] = [
    {
      h: "1. Your care",
      text: `${p.practiceName} will provide ${care.length ? care.join(", ") : "care"} with ${p.clinicianName}, starting ${day(p.startOfCare) ?? "on a date we agree together"}.`,
    },
    {
      h: "2. Fees and payment",
      text: `${fee} ${p.insurer && p.insurer !== "Self-pay" ? `We bill ${p.insurer} directly; you pay any amount it doesn't cover.` : "Invoices are sent by email after each visit and are due in 14 days."}`,
    },
    { h: "3. Cancelling", text: "Please give at least 48 hours' notice to cancel or move a visit. Late cancellations may be charged in full." },
    {
      h: "4. Confidentiality",
      text: "What you share stays private. We only share information if you agree, if the law requires it, or if someone is at serious risk of harm.",
    },
    { h: "5. Your records", text: "Visit notes are stored safely and kept for as long as the law requires. You can ask for a copy at any time." },
    { h: "6. Ending care", text: "You can stop at any time. We will plan the ending together and write to your doctor if you agree." },
  ];
  return { patient: p, agreement: null, sections, parties: `Between ${p.practiceName} and ${p.fullName} · Clinician ${p.clinicianName}` };
}

export type AgreementStatus = "none" | "patient" | "admin" | "signed";

/** None yet, signed by one side, or fully signed. */
export function agreementStatus(a: { patientSignature: string | null; adminSignature: string | null } | null): AgreementStatus {
  if (!a || (!a.patientSignature && !a.adminSignature)) return "none";
  if (a.patientSignature && a.adminSignature) return "signed";
  return a.patientSignature ? "patient" : "admin";
}
