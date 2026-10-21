"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicianProfiles, clinicians, sessions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { notifyClinicianActivated } from "@/lib/practice-join";

const input = z.object({
  clinicianId: z.string().min(1),
  status: z.enum(["active", "deactivated"]),
});

/**
 * Verify (activate) a clinician who asked to join, or turn an account off or back on.
 * Only for clinicians in the admin's own practice. Deactivating keeps all their notes
 * and signs them out everywhere.
 */
export async function setClinicianStatus(
  values: z.input<typeof input>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  const parsed = input.safeParse(values);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const { clinicianId, status } = parsed.data;

  const [clinician] = await db
    .select({ name: clinicians.name, email: clinicians.email, status: clinicians.status })
    .from(clinicians)
    .where(
      and(
        eq(clinicians.id, clinicianId),
        eq(clinicians.practiceId, admin.practiceId),
        eq(clinicians.role, "clinician"),
      ),
    );
  if (!clinician) return { ok: false, message: "We couldn't find that clinician in your practice." };
  if (clinician.status === status) return { ok: true };

  await db.transaction(async (tx) => {
    await tx.update(clinicians).set({ status, updatedAt: new Date() }).where(eq(clinicians.id, clinicianId));
    if (status === "deactivated") await tx.delete(sessions).where(eq(sessions.userId, clinicianId));
  });

  // Only the first activation is a "you're verified" moment.
  if (status === "active" && clinician.status === "pending") {
    await notifyClinicianActivated({ name: clinician.name, email: clinician.email, practiceName: admin.practiceName });
  }

  revalidatePath("/admin", "layout");
  return { ok: true };
}

const contactInput = z.object({
  clinicianId: z.string().min(1),
  name: z.string().trim().max(120),
  relationship: z.string().trim().max(60),
  phone: z.string().trim().max(40),
});

/** Clinician profile → Emergency contact (kept by the admin). */
export async function saveEmergencyContact(values: z.input<typeof contactInput>): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  const parsed = contactInput.safeParse(values);
  if (!parsed.success) return { ok: false, message: "Please check the contact details." };
  const v = parsed.data;
  if ((v.name || v.relationship) && !v.phone) return { ok: false, message: "Add a phone number for the emergency contact." };
  if (v.phone && !v.name) return { ok: false, message: "Add the emergency contact's name." };
  const [clinician] = await db
    .select({ id: clinicians.id })
    .from(clinicians)
    .where(and(eq(clinicians.id, v.clinicianId), eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician")));
  if (!clinician) return { ok: false, message: "We couldn't find that clinician. Please refresh the page." };
  const row = {
    emergencyName: v.name || null,
    emergencyRelationship: v.relationship || null,
    emergencyPhone: v.phone || null,
    updatedAt: new Date(),
  };
  await db
    .insert(clinicianProfiles)
    .values({ clinicianId: clinician.id, ...row })
    .onConflictDoUpdate({ target: clinicianProfiles.clinicianId, set: row });
  revalidatePath(`/admin/clinicians/${clinician.id}`);
  return { ok: true };
}
