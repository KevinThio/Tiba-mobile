"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { currencyDigits, parseMoneyToMinor } from "@/lib/countries";
import { isDiscipline } from "@/lib/disciplines";
import { practiceBilling } from "@/lib/practice";

type Result = { ok: true } | { ok: false; message: string };

/** Settings → Your role. Decides which notes the clinician can write. */
export async function saveDiscipline(input: { discipline: string }): Promise<Result> {
  const clinician = await requireClinician();
  if (!isDiscipline(input.discipline)) return { ok: false, message: "Pick your discipline from the list." };
  await db.update(clinicians).set({ discipline: input.discipline, updatedAt: new Date() }).where(eq(clinicians.id, clinician.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Settings → Invoicing. The default fee for a visit, in the practice's billing currency. Empty clears it. */
export async function saveVisitFee(input: { fee: string }): Promise<Result> {
  const clinician = await requireClinician();
  const { currency } = await practiceBilling(clinician.practiceId);
  const text = String(input.fee ?? "").trim();
  let minor: number | null = null;
  if (text) {
    minor = parseMoneyToMinor(text, currency);
    if (minor === null) {
      return {
        ok: false,
        message: currencyDigits(currency)
          ? "Add the fee as a number, for example 2500 or 2500.50."
          : "Add the fee as a whole number, for example 2500.",
      };
    }
  }
  await db
    .update(clinicians)
    .set({ visitFeeMinor: minor, visitFeeCurrency: minor === null ? null : currency, updatedAt: new Date() })
    .where(eq(clinicians.id, clinician.id));
  revalidatePath("/settings");
  revalidatePath("/appointments");
  return { ok: true };
}
