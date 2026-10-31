"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { assignFromOffer, closeOffer, offerPatient } from "@/lib/patient-offers";
import { SERVICE_VALUES } from "@/lib/patient-options";

const BAD = { ok: false as const, message: "Something went wrong. Please refresh the page and try again." };

/** "Offer to clinicians" on a patient's page: every clinician who does the care is told. */
export async function offerToClinicians(input: { patientId: string; service: string }) {
  const admin = await requireAdmin();
  const parsed = z.object({ patientId: z.uuid(), service: z.enum(SERVICE_VALUES) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Pick the type of care to offer." };
  const result = await offerPatient(admin, parsed.data.patientId, parsed.data.service);
  revalidatePath("/", "layout");
  return result;
}

/** Assign the patient to one of the clinicians who accepted (the first is suggested). */
export async function assignOfferedPatient(input: { offerId: string; clinicianId: string }) {
  const admin = await requireAdmin();
  const parsed = z.object({ offerId: z.uuid(), clinicianId: z.string().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return BAD;
  const result = await assignFromOffer(admin, parsed.data.offerId, parsed.data.clinicianId);
  revalidatePath("/", "layout");
  return result;
}

/** Withdraw an open offer; the patient keeps their clinician, or stays without one. */
export async function withdrawOffer(input: { patientId: string }) {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(input.patientId).success) return BAD;
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, input.patientId), eq(patients.practiceId, admin.practiceId)));
  if (!patient) return BAD;
  const closed = await closeOffer(patient.id);
  revalidatePath("/", "layout");
  return closed ? { ok: true as const } : { ok: false as const, message: "This offer has already ended. Please refresh the page." };
}
