"use server";

import { and, asc, eq, ilike, isNotNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clinicians, diagnosisCodes, invoices, patientDiagnoses, patientOffers, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { clearNotifications } from "@/lib/notifications";
import { findDuplicatePatient } from "@/lib/patient-duplicates";
import { savePatientDetails, type PatientDetailsInput, type PatientDetailsResult } from "@/lib/patient-edit";
import { announceOffer, closeOffer, eligibleClinicians } from "@/lib/patient-offers";
import { aideNeedsSkilledCare, OFFER_FOR, SERVICE_VALUES } from "@/lib/patient-options";

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
  // Either a clinician, or a type of care to offer the patient to every clinician who does it.
  clinicianId: optional,
  offerService: z.enum(SERVICE_VALUES).optional().or(z.literal("")).transform((v) => v || null),
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
  | { ok: true; name: string; offeredTo?: number }
  | { ok: false; message: string }
  | { ok: false; duplicate: { name: string; dateOfBirth: string } };

/**
 * Adds a patient to the practice for the chosen clinician, or offers them to every clinician who
 * does the chosen type of care (the first to accept sees them; src/lib/patient-offers.ts) (spec v2 Add patient, admin).
 * The same name and date of birth as an existing practice patient returns a possible
 * duplicate first; the admin can confirm it's a different person and add them anyway.
 */
export async function addPatient(input: AddPatientInput): Promise<AddPatientResult> {
  const admin = await requireAdmin();
  const parsed = patientInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const v = parsed.data;
  if (!v.clinicianId === !v.offerService) {
    return { ok: false, message: "Pick the clinician who will see them, or offer them to your clinicians." };
  }
  // The type of care offered is always one of the services ordered.
  if (v.offerService && !v.servicesOrdered.includes(v.offerService)) v.servicesOrdered.push(v.offerService);

  if (aideNeedsSkilledCare(v.servicesOrdered)) {
    return { ok: false, message: "An aide can only be ordered with skilled nursing, physical or occupational therapy." };
  }
  if (v.startOfCare && v.startOfCare < v.referralDate) {
    return { ok: false, message: "Start of care can't be before the date of referral." };
  }

  let clinicianId: string | null = null;
  if (v.clinicianId) {
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
    clinicianId = clinician.id;
  }
  const offerTeam = v.offerService ? await eligibleClinicians(admin.practiceId, v.offerService) : [];
  if (v.offerService && !offerTeam.length) {
    return {
      ok: false,
      message: `None of your active clinicians are ${OFFER_FOR[v.offerService].who} yet. Pick a clinician instead, or ask your team to set their role in Settings.`,
    };
  }

  if (v.diagnosisCode) {
    const [code] = await db.select({ code: diagnosisCodes.code }).from(diagnosisCodes).where(eq(diagnosisCodes.code, v.diagnosisCode));
    if (!code) return { ok: false, message: "Pick a diagnosis code from the list, or leave it blank." };
  }

  if (!v.confirmedNotDuplicate) {
    const match = await findDuplicatePatient(admin.practiceId, v.fullName, v.dateOfBirth);
    if (match) return { ok: false, duplicate: { name: match.name, dateOfBirth: match.dateOfBirth } };
  }

  const offerId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(patients)
      .values({
        practiceId: admin.practiceId,
        clinicianId,
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
    if (!v.offerService) return null;
    const [offer] = await tx
      .insert(patientOffers)
      .values({
        practiceId: admin.practiceId,
        patientId: created.id,
        service: v.offerService,
        offeredById: admin.id,
        offeredTo: offerTeam.length,
      })
      .returning({ id: patientOffers.id });
    return offer.id;
  });
  if (offerId && v.offerService) await announceOffer(admin.practiceId, offerId, v.offerService);

  revalidatePath("/", "layout");
  return { ok: true, name: v.fullName, offeredTo: offerId ? offerTeam.length : undefined };
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
      and(
        eq(patients.id, input.patientId),
        eq(patients.practiceId, admin.practiceId),
        ne(patients.status, input.status),
        ne(patients.status, "merged"),
      ),
    )
    .returning({ id: patients.id });
  if (!updated.length) return { ok: false, message: "We couldn't find that patient. Please refresh the page." };
  if (input.status === "discharged") await closeOffer(input.patientId);
  revalidatePath("/", "layout");
  return { ok: true };
}

type ReviewResult = { ok: true; name: string } | { ok: false; message: string };

/** The flagged entry and the record it may duplicate, both in the admin's practice. */
async function flaggedPair(newId: string, practiceId: string) {
  if (!z.uuid().safeParse(newId).success) return null;
  const [entry] = await db
    .select({ id: patients.id, name: patients.fullName, duplicateOfId: patients.duplicateOfId })
    .from(patients)
    .where(
      and(
        eq(patients.id, newId),
        eq(patients.practiceId, practiceId),
        ne(patients.status, "merged"),
        isNotNull(patients.duplicateFlaggedAt),
      ),
    );
  if (!entry) return null;
  const [existing] = entry.duplicateOfId
    ? await db
        .select({ id: patients.id, name: patients.fullName })
        .from(patients)
        .where(and(eq(patients.id, entry.duplicateOfId), eq(patients.practiceId, practiceId), ne(patients.status, "merged")))
    : [];
  return { entry, existing: existing ?? null };
}

/** "Confirm new patient" (spec v2 section 5b): they're a different person, so the flag clears. */
export async function confirmNewPatient(input: { patientId: string }): Promise<ReviewResult> {
  const admin = await requireAdmin();
  const pair = await flaggedPair(input.patientId, admin.practiceId);
  if (!pair) return { ok: false, message: "This patient isn't waiting for a duplicate check any more. Please go back to Patients." };
  await db
    .update(patients)
    .set({ duplicateOfId: null, duplicateFlaggedAt: null, updatedAt: new Date() })
    .where(eq(patients.id, pair.entry.id));
  await clearNotifications(admin.practiceId, "duplicate", pair.entry.id);
  revalidatePath("/", "layout");
  return { ok: true, name: pair.entry.name };
}

/**
 * "Merge into existing" (spec v2 section 5b): keeps the existing record and moves the new
 * entry's visits (with their notes) and invoices into it. Diagnosis codes are added, and details
 * the existing record is missing (phone, email, ordering doctor, services) are filled in from
 * the new entry. The new entry is then hidden as merged, pointing at the kept record.
 */
export async function mergeIntoExisting(input: { patientId: string }): Promise<ReviewResult> {
  const admin = await requireAdmin();
  const pair = await flaggedPair(input.patientId, admin.practiceId);
  if (!pair) return { ok: false, message: "This patient isn't waiting for a duplicate check any more. Please go back to Patients." };
  if (!pair.existing) {
    return { ok: false, message: "The other record isn't in your practice any more, so there's nothing to merge into. Confirm the new patient instead." };
  }
  const from = pair.entry.id;
  const into = pair.existing.id;

  await db.transaction(async (tx) => {
    await tx.update(appointments).set({ patientId: into }).where(eq(appointments.patientId, from));
    await tx.update(invoices).set({ patientId: into }).where(eq(invoices.patientId, from));
    await tx.execute(sql`
      insert into patient_diagnoses (patient_id, code, added_at)
      select ${into}, code, added_at from patient_diagnoses where patient_id = ${from}
      on conflict do nothing`);
    await tx.execute(sql`
      update patients kept set
        phone = coalesce(kept.phone, dup.phone),
        invoice_email = coalesce(kept.invoice_email, dup.invoice_email),
        ordering_doctor = coalesce(kept.ordering_doctor, dup.ordering_doctor),
        services_ordered = (select array(select distinct unnest(kept.services_ordered || dup.services_ordered))),
        clinician_id = coalesce(kept.clinician_id, dup.clinician_id),
        updated_at = now()
      from patients dup
      where kept.id = ${into} and dup.id = ${from}`);
    await tx
      .update(patients)
      .set({ status: "merged", mergedIntoId: into, duplicateOfId: null, duplicateFlaggedAt: null, updatedAt: new Date() })
      .where(eq(patients.id, from));
  });
  await clearNotifications(admin.practiceId, "duplicate", from);
  // A kept record that was still being offered now has the entry's clinician.
  const [kept] = await db.select({ clinicianId: patients.clinicianId }).from(patients).where(eq(patients.id, into));
  if (kept?.clinicianId) await closeOffer(into);

  revalidatePath("/", "layout");
  return { ok: true, name: pair.existing.name };
}

const careInput = z.object({
  patientId: z.uuid(),
  // Empty while the patient is offered and nobody has accepted; the clinician stays unset.
  clinicianId: optional,
  insurer: optional,
  referralDate: isoDate.optional().or(z.literal("")).transform((v) => v || null),
  startOfCare: isoDate.optional().or(z.literal("")).transform((v) => v || null),
});

/** Patient details → Care: the assigned clinician, insurer, date of referral and start of care. */
export async function updatePatientCare(input: z.input<typeof careInput>): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  const parsed = careInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const v = parsed.data;
  if (v.startOfCare && v.referralDate && v.startOfCare < v.referralDate) {
    return { ok: false, message: "Start of care can't be before the date of referral." };
  }
  if (v.clinicianId) {
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
  }
  const updated = await db
    .update(patients)
    .set({ ...(v.clinicianId ? { clinicianId: v.clinicianId } : {}), insurer: v.insurer, referralDate: v.referralDate, startOfCare: v.startOfCare, updatedAt: new Date() })
    .where(and(eq(patients.id, v.patientId), eq(patients.practiceId, admin.practiceId), ne(patients.status, "merged")))
    .returning({ id: patients.id });
  if (!updated.length) return { ok: false, message: "We couldn't find that patient. Please refresh the page." };
  // Picking a clinician here ends an offer nobody has accepted yet.
  if (v.clinicianId) await closeOffer(v.patientId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Patient details → Edit details: corrects the name, date of birth, contact, services and diagnoses. */
export async function updatePatientDetails(input: PatientDetailsInput): Promise<PatientDetailsResult> {
  const admin = await requireAdmin();
  const result = await savePatientDetails(admin.practiceId, input);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
