"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinician } from "@/lib/auth";
import { answerOffer } from "@/lib/patient-offers";

const answerInput = z.object({
  offerId: z.uuid(),
  answer: z.enum(["accepted", "declined"]),
  reason: z
    .string()
    .trim()
    .max(300, "Keep the reason under 300 characters.")
    .optional()
    .transform((v) => v || null),
});

/** Accept or decline a patient the admin offered. The admin is told, and assigns one clinician who accepted. */
export async function answerPatientOffer(input: z.input<typeof answerInput>) {
  const clinician = await requireClinician();
  const parsed = answerInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Please refresh the page and try again." };
  const result = await answerOffer(clinician, parsed.data.offerId, parsed.data.answer, parsed.data.reason);
  revalidatePath("/", "layout");
  return result;
}
