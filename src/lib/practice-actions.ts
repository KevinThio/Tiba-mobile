"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { parseLogoDataUrl } from "@/lib/practice-logo";

const schema = z.object({
  practiceName: z.string().trim().min(1, "Add your practice name.").max(200).optional(),
  // A data URL to set a new logo, null to remove it, or left out to keep it as it is.
  logo: z.string().nullable().optional(),
});

export type PracticeUpdate = z.input<typeof schema>;

export async function updatePractice(input: PracticeUpdate): Promise<{ ok: true } | { ok: false; message: string }> {
  const clinician = await requireClinician();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const { practiceName, logo } = parsed.data;

  if (logo && !parseLogoDataUrl(logo)) {
    return { ok: false, message: "We couldn't use that image. Please try a PNG or JPG file." };
  }

  await db
    .update(clinicians)
    .set({
      ...(practiceName !== undefined && { practiceName }),
      ...(logo !== undefined && { practiceLogo: logo }),
      updatedAt: new Date(),
    })
    .where(eq(clinicians.id, clinician.id));

  revalidatePath("/", "layout");
  return { ok: true };
}
