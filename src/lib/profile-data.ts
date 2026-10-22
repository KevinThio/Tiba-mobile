import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicianProfiles } from "@/db/schema";

/** A clinician's profile, or an empty one if they haven't saved it yet. */
export async function loadProfile(clinicianId: string) {
  const [row] = await db.select().from(clinicianProfiles).where(eq(clinicianProfiles.clinicianId, clinicianId));
  return {
    speciality: row?.speciality ?? "",
    licenseNumber: row?.licenseNumber ?? "",
    licenseIssuer: row?.licenseIssuer ?? "",
    licenseExpiry: row?.licenseExpiry ?? "",
    education: row?.education ?? [],
    certifications: row?.certifications ?? [],
    experience: row?.experience ?? [],
    phone: row?.phone ?? "",
    contactEmail: row?.contactEmail ?? "",
    address: row?.address ?? "",
    city: row?.city ?? "",
    region: row?.region ?? "",
    postalCode: row?.postalCode ?? "",
    emergencyName: row?.emergencyName ?? "",
    emergencyRelationship: row?.emergencyRelationship ?? "",
    emergencyPhone: row?.emergencyPhone ?? "",
  };
}

export type ProfileData = Awaited<ReturnType<typeof loadProfile>>;
