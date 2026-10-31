import "server-only";
import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diagnosisCodes, patientDiagnoses, patients, practices } from "@/db/schema";
import { geocodeAddress } from "@/lib/geocode";
import { findDuplicatePatient } from "@/lib/patient-duplicates";
import { aideNeedsSkilledCare, SERVICE_VALUES } from "@/lib/patient-options";

// Edit details on a patient's page, for the admin and the practice's clinicians: corrects what
// was entered wrong (name, date of birth, contact, home address, ordering doctor, services,
// diagnosis codes). A changed address is looked up on the map, for checking clock-ins.
// The admin's Care card (clinician, insurer, referral, start of care) is separate.

const optional = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || null);

const detailsInput = z.object({
  patientId: z.uuid(),
  fullName: z.string().trim().min(1, "Add the patient's full name.").max(200),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date of birth.")
    .refine((d) => d <= new Date().toISOString().slice(0, 10), "The date of birth can't be in the future."),
  phone: optional,
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .pipe(z.email("Add an @, e.g. amina@mail.com.").nullable()),
  orderingDoctor: optional,
  servicesOrdered: z.array(z.enum(SERVICE_VALUES)).max(SERVICE_VALUES.length),
  diagnosisCodes: z.array(z.string().trim().min(1).max(16)).max(20),
  // Set when the person saw the duplicate warning and saved anyway.
  confirmedNotDuplicate: z.boolean().optional(),
});

export type PatientDetailsInput = z.input<typeof detailsInput>;
export type PatientDetailsResult =
  | { ok: true; name: string; addressNotFound?: boolean }
  | { ok: false; message: string }
  | { ok: false; duplicate: { name: string; dateOfBirth: string } };

/**
 * Saves corrected details for a patient in `practiceId`. A changed name or date of birth that
 * matches another practice patient comes back as a possible duplicate first. Diagnosis codes are
 * replaced by the list given (codes already on the record keep when they were added).
 */
export async function savePatientDetails(practiceId: string, input: PatientDetailsInput): Promise<PatientDetailsResult> {
  const parsed = detailsInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const v = parsed.data;
  if (aideNeedsSkilledCare(v.servicesOrdered)) {
    return { ok: false, message: "An aide can only be ordered with skilled nursing, physical or occupational therapy." };
  }

  const [current] = await db
    .select({ fullName: patients.fullName, dateOfBirth: patients.dateOfBirth, address: patients.address, country: practices.country })
    .from(patients)
    .innerJoin(practices, eq(practices.id, patients.practiceId))
    .where(and(eq(patients.id, v.patientId), eq(patients.practiceId, practiceId), ne(patients.status, "merged")));
  if (!current) return { ok: false, message: "We couldn't find that patient. Please refresh the page." };

  const codes = [...new Set(v.diagnosisCodes)];
  if (codes.length) {
    const known = await db.select({ code: diagnosisCodes.code }).from(diagnosisCodes).where(inArray(diagnosisCodes.code, codes));
    if (known.length !== codes.length) return { ok: false, message: "Pick diagnosis codes from the list." };
  }

  const identityChanged = current.fullName !== v.fullName || current.dateOfBirth !== v.dateOfBirth;
  if (identityChanged && !v.confirmedNotDuplicate) {
    const match = await findDuplicatePatient(practiceId, v.fullName, v.dateOfBirth);
    if (match && match.id !== v.patientId) return { ok: false, duplicate: { name: match.name, dateOfBirth: match.dateOfBirth } };
  }

  // Only a changed address is looked up again (the lookup goes to a map service; see geocode.ts).
  const addressChanged = (current.address ?? null) !== v.address;
  const home = addressChanged && v.address ? await geocodeAddress(v.address, current.country) : null;

  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({
        fullName: v.fullName,
        dateOfBirth: v.dateOfBirth,
        phone: v.phone,
        ...(addressChanged ? { address: v.address, homeLat: home?.lat ?? null, homeLng: home?.lng ?? null } : {}),
        invoiceEmail: v.email,
        orderingDoctor: v.orderingDoctor,
        servicesOrdered: v.servicesOrdered,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, v.patientId));
    await tx
      .delete(patientDiagnoses)
      .where(
        codes.length
          ? and(eq(patientDiagnoses.patientId, v.patientId), notInArray(patientDiagnoses.code, codes))
          : eq(patientDiagnoses.patientId, v.patientId),
      );
    if (codes.length) {
      await tx
        .insert(patientDiagnoses)
        .values(codes.map((code) => ({ patientId: v.patientId, code })))
        .onConflictDoNothing();
    }
  });
  return { ok: true, name: v.fullName, addressNotFound: addressChanged && Boolean(v.address) && !home };
}
