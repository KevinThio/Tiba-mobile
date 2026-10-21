"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { files, locations } from "@/db/schema";
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

/** Remove location (spec v2): asks to confirm in the browser; the last location can't be removed. Its files go too. */
export async function removeLocation(input: { locationId: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(input.locationId).success) return { ok: false, message: "Something went wrong. Please refresh the page." };
  const all = await db.select({ id: locations.id }).from(locations).where(eq(locations.practiceId, admin.practiceId));
  if (!all.some((l) => l.id === input.locationId)) return { ok: false, message: "We couldn't find that location. Please refresh the page." };
  if (all.length === 1) return { ok: false, message: "This is your only location, so it can't be removed. Add another one first." };
  await db.transaction(async (tx) => {
    await tx.delete(files).where(and(eq(files.ownerKind, "location"), eq(files.ownerId, input.locationId), eq(files.practiceId, admin.practiceId)));
    await tx.delete(locations).where(and(eq(locations.id, input.locationId), eq(locations.practiceId, admin.practiceId)));
  });
  revalidatePath("/admin/locations");
  return { ok: true };
}
