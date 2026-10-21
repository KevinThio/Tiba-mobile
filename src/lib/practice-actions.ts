"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicians, practices } from "@/db/schema";
import { requireAccount } from "@/lib/auth";
import { isCountryCode, isCurrencyCode } from "@/lib/countries";
import { canEditPractice } from "@/lib/practice";
import { parseLogoDataUrl } from "@/lib/practice-logo";
import { normalisePracticeName } from "@/lib/practice-name";

const schema = z.object({
  practiceName: z.string().trim().min(1, "Add your practice name.").max(200).optional(),
  // A data URL to set a new logo, null to remove it, or left out to keep it as it is.
  logo: z.string().nullable().optional(),
  // ISO country code; admins only. Sets the currency for new fees and invoices.
  country: z.string().refine(isCountryCode, "Pick your country from the list.").optional(),
  // ISO 4217 code to bill in; null goes back to the country's currency. Admins only.
  currency: z.string().refine(isCurrencyCode, "Pick a currency from the list.").nullable().optional(),
});

export type PracticeUpdate = z.input<typeof schema>;

/** Changes the practice name, logo, and (admins only) country and billing currency. Only the practice admin (or a clinician in a practice with no admin) may. */
export async function updatePractice(input: PracticeUpdate): Promise<{ ok: true } | { ok: false; message: string }> {
  const account = await requireAccount();
  if (account.status !== "active" || !(await canEditPractice(account))) {
    return { ok: false, message: "Your practice admin manages the practice name and logo." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const { practiceName, logo, country, currency } = parsed.data;
  if ((country !== undefined || currency !== undefined) && account.role !== "admin") {
    return { ok: false, message: "Your practice admin sets the practice's country and currency." };
  }

  if (logo === null && account.role === "admin") {
    return { ok: false, message: "Admins need to add the practice logo. Choose a new one instead of removing it." };
  }
  if (logo && !parseLogoDataUrl(logo)) {
    return { ok: false, message: "We couldn't use that image. Please try a PNG or JPG file." };
  }

  const nameKey = practiceName === undefined ? undefined : normalisePracticeName(practiceName);
  if (nameKey !== undefined) {
    const [clash] = await db
      .select({ id: practices.id })
      .from(practices)
      .where(and(eq(practices.nameKey, nameKey), ne(practices.id, account.practiceId)));
    if (clash) return { ok: false, message: "Another practice on Tiba already uses that name. Try a different one." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(practices)
      .set({
        ...(practiceName !== undefined && { name: practiceName, nameKey }),
        ...(logo !== undefined && { logo }),
        ...(country !== undefined && { country }),
        ...(currency !== undefined && { currency }),
        updatedAt: new Date(),
      })
      .where(eq(practices.id, account.practiceId));
    // Every account keeps a copy of the name for its session.
    if (practiceName !== undefined || country !== undefined) {
      await tx
        .update(clinicians)
        .set({ ...(practiceName !== undefined && { practiceName }), ...(country !== undefined && { country }) })
        .where(eq(clinicians.practiceId, account.practiceId));
    }
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
