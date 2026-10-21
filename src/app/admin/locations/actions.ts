"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicians, files, locations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { addressOptional, FACILITIES, LOCATION_SERVICES } from "@/lib/location-options";

const locationInput = z.object({
  name: z.string().trim().min(1, "Add a name for the location, e.g. Camden.").max(120),
  facility: z.enum(FACILITIES, "Pick the type of facility."),
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
  services: z.array(z.enum(LOCATION_SERVICES)).min(1, "Pick at least one service offered here."),
});

export type AddLocationInput = z.input<typeof locationInput>;

/** Adds a location to the admin's practice (spec v2 Add location). */
export async function addLocation(
  input: AddLocationInput,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  const parsed = locationInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const v = parsed.data;

  if (!v.address && !addressOptional(v.facility)) {
    return { ok: false, message: "Add the address. Only Telehealth locations can leave it blank." };
  }

  const [clash] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.practiceId, admin.practiceId), sql`lower(${locations.name}) = lower(${v.name})`));
  if (clash) return { ok: false, message: `You already have a location called "${v.name}". Try a different name.` };

  await db.insert(locations).values({
    practiceId: admin.practiceId,
    name: v.name,
    facility: v.facility,
    address: v.address,
    services: [...v.services],
  });

  revalidatePath("/admin/locations");
  return { ok: true, name: v.name };
}

/**
 * Remove a location (spec v2): asks to confirm, removes its files, and moves the clinicians based
 * there to the location the admin picks. The last location can't be removed.
 */
export async function removeLocation(input: { locationId: string; moveToId?: string | null }): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(input.locationId).success) return { ok: false, message: "Something went wrong. Please refresh the page." };
  const all = await db.select({ id: locations.id }).from(locations).where(eq(locations.practiceId, admin.practiceId));
  if (!all.some((l) => l.id === input.locationId)) return { ok: false, message: "We couldn't find that location. Please refresh the page." };
  if (all.length === 1) return { ok: false, message: "This is your only location, so it can't be removed. Add another one first." };
  const based = await db
    .select({ id: clinicians.id })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, admin.practiceId), eq(clinicians.locationId, input.locationId)));
  const moveToId = input.moveToId ?? null;
  if (based.length && (!moveToId || moveToId === input.locationId || !all.some((l) => l.id === moveToId))) {
    return { ok: false, message: "Pick the location its clinicians move to." };
  }
  await db.transaction(async (tx) => {
    if (based.length && moveToId) {
      await tx
        .update(clinicians)
        .set({ locationId: moveToId })
        .where(and(eq(clinicians.practiceId, admin.practiceId), eq(clinicians.locationId, input.locationId)));
    }
    await tx.delete(files).where(and(eq(files.ownerKind, "location"), eq(files.ownerId, input.locationId), eq(files.practiceId, admin.practiceId)));
    await tx.delete(locations).where(and(eq(locations.id, input.locationId), eq(locations.practiceId, admin.practiceId)));
  });
  revalidatePath("/admin/locations");
  revalidatePath("/admin/clinicians");
  return { ok: true };
}

/**
 * Base a clinician at a location, or take them off it (locationId null). A clinician is based at
 * one location, so adding them here moves them from anywhere else. Both must be in the practice.
 */
export async function setClinicianLocation(input: { clinicianId: string; locationId: string | null }): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  const parsed = z.object({ clinicianId: z.string().min(1).max(100), locationId: z.uuid().nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page." };
  const { clinicianId, locationId } = parsed.data;
  if (locationId) {
    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.practiceId, admin.practiceId)));
    if (!location) return { ok: false, message: "We couldn't find that location. Please refresh the page." };
  }
  const updated = await db
    .update(clinicians)
    .set({ locationId })
    .where(and(eq(clinicians.id, clinicianId), eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician")))
    .returning({ id: clinicians.id });
  if (!updated.length) return { ok: false, message: "We couldn't find that clinician. Please refresh the page." };
  revalidatePath("/admin/locations", "layout");
  revalidatePath(`/admin/clinicians/${clinicianId}`);
  revalidatePath("/admin/clinicians");
  return { ok: true };
}
