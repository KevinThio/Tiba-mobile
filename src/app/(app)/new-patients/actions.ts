"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinician } from "@/lib/auth";
import { acceptOffer, withdrawAcceptance } from "@/lib/patient-offers";

const BAD_ID = { ok: false as const, message: "Something went wrong. Please refresh the page and try again." };

/** Accept a patient the admin offered: you can take them, and the admin assigns one clinician. */
export async function acceptPatient(input: { offerId: string }) {
  const clinician = await requireClinician();
  if (!z.uuid().safeParse(input.offerId).success) return BAD_ID;
  const result = await acceptOffer(clinician, input.offerId);
  revalidatePath("/", "layout");
  return result;
}

/** Take back an acceptance before the admin assigns the patient. */
export async function withdrawPatient(input: { offerId: string }) {
  const clinician = await requireClinician();
  if (!z.uuid().safeParse(input.offerId).success) return BAD_ID;
  const result = await withdrawAcceptance(clinician, input.offerId);
  revalidatePath("/", "layout");
  return result;
}
