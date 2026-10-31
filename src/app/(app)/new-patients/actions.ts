"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinician } from "@/lib/auth";
import { acceptOffer } from "@/lib/patient-offers";

/** Accept a new patient the admin offered: the first clinician to accept sees them. */
export async function acceptPatient(input: { offerId: string }) {
  const clinician = await requireClinician();
  if (!z.uuid().safeParse(input.offerId).success) {
    return { ok: false as const, message: "Something went wrong. Please refresh the page and try again." };
  }
  const result = await acceptOffer(clinician, input.offerId);
  revalidatePath("/", "layout");
  return result;
}
