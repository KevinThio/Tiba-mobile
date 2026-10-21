"use server";

import { and, asc, eq, ilike, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicians, diagnosisCodes, patientDiagnoses, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { findDuplicatePatient } from "@/lib/patient-duplicates";
import { aideNeedsSkilledCare, SERVICE_VALUES } from "@/lib/patient-options";

export type DiagnosisOption = { code: string; description: string };

/** Type-to-filter diagnosis codes: matches the code ("F41") or words ("anxiety"). */
export async function searchDiagnosisCodes(query: string): Promise<DiagnosisOption[]> {
  await requireAdmin();
  const q = String(query ?? "").trim();
  if (!q) return [];
  return db
    .select({ code: diagnosisCodes.code, description: diagnosisCodes.description })
    .from(diagnosisCodes)
    .where(or(ilike(diagnosisCodes.code, `${q}%`), ilike(diagnosisCodes.description, `%${q}%`)))
    .orderBy(asc(diagnosisCodes.code))
    .limit(8);
}

const optional = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

const patientInput = z.object({
  fullName: z.string().trim().min(1, "Add the patient's full name.").max(200),
  dateOfBirth: isoDate.refine((d) => d <= new Date().toISOString().slice(0, 10), "The date of birth can't be in the future."),
  phone: optional,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .pipe(z.email("Add an @, e.g. amina@mail.com.").nullable()),
  clinicianId: z.string().min(1, "Pick the clinician who will see them."),
  insurer: optional,
  diagnosisCode: optional,
  servicesOrdered: z.array(z.enum(SERVICE_VALUES)).max(SERVICE_VALUES.length),
  orderingDoctor: optional,
  referralDate: isoDate,
  startOfCare: isoDate.optional().or(z.literal("")).transform((v) => v || null),
  // Set when the admin has seen the duplicate warning and said it's a different person.
  confirmedNotDuplicate: z.boolean().optional(),
});

export type AddPatientInput = z.input<typeof patientInput>;
export type AddPatientResult =
  | { ok: true; name: string }
  | { ok: false; message: string }
  | { ok: false; duplicate: { name: string; dateOfBirth: string } };

/**
 * Adds a patient to the practice for the chosen clinician (spec v2 Add patient, admin).
 * The same name and date of birth as an existing practice patient returns a possible
 * duplicate first; the admin can confirm it's a different person and add them anyway.
 */
export async function addPatient(input: AddPatientInput): Promise<AddPatientResult> {
  const admin = await requireAdmin();
  const parsed = patientInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const v = parsed.data;

  if (aideNeedsSkilledCare(v.servicesOrdered)) {
    return { ok: false, message: "An aide can only be ordered with skilled nursing, physical or occupational therapy." };
  }
  if (v.startOfCare && v.startOfCare < v.referralDate) {
    return { ok: false, message: "Start of care can't be before the date of referral." };
  }

  const [clinician] = await db
    .select({ id: clinicians.id })
    .from(clinicians)
    .where(
      and(
        eq(clinicians.id, v.clinicianId),
        eq(clinicians.practiceId, admin.practiceId),
        eq(clinicians.role, "clinician"),
        eq(clinicians.status, "active"),
      ),
    );
  if (!clinician) return { ok: false, message: "Pick an active clinician from your practice." };

  if (v.diagnosisCode) {
    const [code] = await db.select({ code: diagnosisCodes.code }).from(diagnosisCodes).where(eq(diagnosisCodes.code, v.diagnosisCode));
    if (!code) return { ok: false, message: "Pick a diagnosis code from the list, or leave it blank." };
  }

  if (!v.confirmedNotDuplicate) {
    const match = await findDuplicatePatient(admin.practiceId, v.fullName, v.dateOfBirth);
    if (match) return { ok: false, duplicate: { name: match.name, dateOfBirth: match.dateOfBirth } };
  }

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(patients)
      .values({
        practiceId: admin.practiceId,
        clinicianId: clinician.id,
        addedById: admin.id,
        fullName: v.fullName,
        dateOfBirth: v.dateOfBirth,
        phone: v.phone,
        invoiceEmail: v.email,
        insurer: v.insurer,
        servicesOrdered: v.servicesOrdered,
        orderingDoctor: v.orderingDoctor,
        referralDate: v.referralDate,
        startOfCare: v.startOfCare,
      })
      .returning({ id: patients.id });
    if (v.diagnosisCode) await tx.insert(patientDiagnoses).values({ patientId: created.id, code: v.diagnosisCode });
  });

  revalidatePath("/admin/patients");
  return { ok: true, name: v.fullName };
}

/** Moves a patient between Active and Discharged. */
export async function setPatientStatus(input: {
  patientId: string;
  status: "active" | "discharged";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(input.patientId).success || !["active", "discharged"].includes(input.status)) {
    return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  }
  const updated = await db
    .update(patients)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(eq(patients.id, input.patientId), eq(patients.practiceId, admin.practiceId), ne(patients.status, input.status)),
    )
    .returning({ id: patients.id });
  if (!updated.length) return { ok: false, message: "We couldn't find that patient. Please refresh the page." };
  revalidatePath("/admin/patients");
  return { ok: true };
}
