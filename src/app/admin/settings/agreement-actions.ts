"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { practices } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const clauses = z
  .array(
    z.object({
      id: z.string().max(60),
      h: z.string().trim().min(1, "Give every section a heading.").max(120),
      text: z.string().trim().min(1, "Every section needs some wording.").max(4000),
    }),
  )
  .min(1, "Keep at least one section.")
  .max(60);

/**
 * Settings → Service agreement wording. Saved wording applies to agreements not yet signed;
 * signed ones keep the wording they were signed with. null goes back to Tiba's default.
 */
export async function saveAgreementTemplate(input: { clauses: z.input<typeof clauses> | null }): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  let value = null;
  if (input.clauses !== null) {
    const parsed = clauses.safeParse(input.clauses);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the wording." };
    value = parsed.data;
  }
  await db.update(practices).set({ agreementTemplate: value, updatedAt: new Date() }).where(eq(practices.id, admin.practiceId));
  revalidatePath("/admin/settings/agreement");
  revalidatePath("/admin/patients", "layout");
  return { ok: true };
}
