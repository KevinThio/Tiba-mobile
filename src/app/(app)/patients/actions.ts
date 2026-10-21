"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { diagnosisCodes, patientDiagnoses, patients } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";
import { findDuplicatePatient } from "@/lib/patient-duplicates";
import { aideNeedsSkilledCare, SERVICE_VALUES } from "@/lib/patient-options";

export type DuplicateMatch = { id: string; name: string; dateOfBirth: string };

/** Live duplicate warning while adding a patient: runs once both the name and date of birth are in. */
export async function checkDuplicate(input: { fullName: string; dateOfBirth: string }): Promise<DuplicateMatch | null> {
  const clinician = await requireClinician();
  const parsed = z.object({ fullName: z.string().max(200), dateOfBirth: z.string().max(10) }).safeParse(input);
  if (!parsed.success) return null;
  return findDuplicatePatient(clinician.practiceId, parsed.data.fullName, parsed.data.dateOfBirth);
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
  diagnosisCode: optional,
  servicesOrdered: z.array(z.enum(SERVICE_VALUES)).max(SERVICE_VALUES.length),
  orderingDoctor: optional,
  // Set when the clinician saw the duplicate warning and chose "Add and ask admin to check".
  askAdminToCheck: z.boolean().optional(),
});

export type ClinicianAddPatientInput = z.input<typeof patientInput>;
export type ClinicianAddPatientResult =
  | { ok: true; id: string; name: string }
  | { ok: false; message: string }
  | { ok: false; duplicate: DuplicateMatch };

/**
 * Add patient from the clinician app (spec v2 section 4b): the patient joins the practice list,
 * assigned to this clinician. A possible duplicate is returned first; "Add and ask admin to
 * check" saves it with a flag the admin reviews (section 5b).
 */
export async function addPatientAsClinician(input: ClinicianAddPatientInput): Promise<ClinicianAddPatientResult> {
  const clinician = await requireClinician();
  const parsed = patientInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const v = parsed.data;

  if (aideNeedsSkilledCare(v.servicesOrdered)) {
    return { ok: false, message: "An aide can only be ordered with skilled nursing, physical or occupational therapy." };
  }
  if (v.diagnosisCode) {
    const [code] = await db.select({ code: diagnosisCodes.code }).from(diagnosisCodes).where(eq(diagnosisCodes.code, v.diagnosisCode));
    if (!code) return { ok: false, message: "Pick a diagnosis code from the list, or leave it blank." };
  }

  const match = await findDuplicatePatient(clinician.practiceId, v.fullName, v.dateOfBirth);
  if (match && !v.askAdminToCheck) return { ok: false, duplicate: match };

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(patients)
      .values({
        practiceId: clinician.practiceId,
        clinicianId: clinician.id,
        addedById: clinician.id,
        fullName: v.fullName,
        dateOfBirth: v.dateOfBirth,
        phone: v.phone,
        invoiceEmail: v.email,
        servicesOrdered: v.servicesOrdered,
        orderingDoctor: v.orderingDoctor,
        duplicateOfId: match?.id ?? null,
        duplicateFlaggedAt: match ? new Date() : null,
      })
      .returning({ id: patients.id });
    if (v.diagnosisCode) await tx.insert(patientDiagnoses).values({ patientId: created.id, code: v.diagnosisCode });
    return created.id;
  });

  if (match) {
    await notifyAdmins(clinician.practiceId, {
      type: "duplicate",
      refId: id,
      title: `Possible duplicate: ${v.fullName}`,
      detail: `Added by ${clinician.name}`,
      href: `/admin/patients/${id}/duplicate`,
    });
  }
  revalidatePath("/patients");
  revalidatePath("/", "layout");
  return { ok: true, id, name: v.fullName };
}
