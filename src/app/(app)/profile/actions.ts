"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicianProfiles, clinicians } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { DISCIPLINE_VALUES } from "@/lib/disciplines";
import { EDUCATION_LEVELS } from "@/lib/profiles";

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""));
const month = z.string().regex(/^(\d{4}-\d{2})?$/, "Pick the month and year for each role.");

const profileInput = z.object({
  discipline: z.enum(DISCIPLINE_VALUES, "Pick your discipline."),
  speciality: text(120),
  licenseNumber: text(60),
  licenseIssuer: text(120),
  licenseExpiry: isoDate,
  education: z
    .array(
      z.object({
        id: z.string().max(40),
        level: z.enum(EDUCATION_LEVELS),
        course: text(160).min(1, "Add the course or qualification for each education entry."),
        school: text(160),
        year: z.string().trim().regex(/^(\d{4})?$/, "Write the year as four digits, e.g. 2019."),
      }),
    )
    .max(30),
  certifications: z
    .array(
      z.object({
        id: z.string().max(40),
        name: text(120).min(1, "Add the name of each certification."),
        issuer: text(120),
        expiry: isoDate,
      }),
    )
    .max(30),
  experience: z
    .array(
      z.object({
        id: z.string().max(40),
        role: text(120).min(1, "Add the job title for each role in your experience."),
        employer: text(160).min(1, "Add the employer for each role in your experience."),
        start: month,
        end: month,
        summary: text(600),
      }),
    )
    .max(30),
  phone: text(40),
  contactEmail: z.union([z.literal(""), z.email("Your contact email doesn't look right. Check it, e.g. sam@clinic.com.").max(254)]),
  address: text(200),
  city: text(120),
  region: text(120),
  postalCode: text(20),
  emergencyName: text(120),
  emergencyRelationship: text(60),
  emergencyPhone: text(40),
});

export type ProfileInput = z.input<typeof profileInput>;

/** Save profile (spec v2 section 5c): About you, contact details, experience, education, certifications and the emergency contact. */
export async function saveProfile(input: ProfileInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const clinician = await requireClinician();
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your profile." };
  const v = parsed.data;
  if (v.discipline === "HHA" && v.certifications.length === 0) {
    return { ok: false, message: "Aides and CNAs need at least one certification. Add your HHA or CNA certification." };
  }
  if (v.experience.some((e) => e.start && e.end && e.end < e.start)) {
    return { ok: false, message: "A role in your experience ends before it starts. Check the dates." };
  }
  if ((v.emergencyName || v.emergencyRelationship) && !v.emergencyPhone) return { ok: false, message: "Add a phone number for your emergency contact." };
  if (v.emergencyPhone && !v.emergencyName) return { ok: false, message: "Add your emergency contact's name." };
  const licensed = v.discipline !== "HHA";
  const row = {
    speciality: v.speciality || null,
    licenseNumber: licensed ? v.licenseNumber || null : null,
    licenseIssuer: licensed ? v.licenseIssuer || null : null,
    licenseExpiry: licensed ? v.licenseExpiry || null : null,
    education: v.education,
    certifications: v.certifications,
    experience: v.experience,
    phone: v.phone || null,
    contactEmail: v.contactEmail || null,
    address: v.address || null,
    city: v.city || null,
    region: v.region || null,
    postalCode: v.postalCode || null,
    emergencyName: v.emergencyName || null,
    emergencyRelationship: v.emergencyRelationship || null,
    emergencyPhone: v.emergencyPhone || null,
    updatedAt: new Date(),
  };
  await db.transaction(async (tx) => {
    await tx.update(clinicians).set({ discipline: v.discipline, updatedAt: new Date() }).where(eq(clinicians.id, clinician.id));
    await tx
      .insert(clinicianProfiles)
      .values({ clinicianId: clinician.id, ...row })
      .onConflictDoUpdate({ target: clinicianProfiles.clinicianId, set: row });
  });
  revalidatePath("/profile");
  revalidatePath("/settings");
  return { ok: true };
}
