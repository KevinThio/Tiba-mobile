"use server";

import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, invoiceItems, notes } from "@/db/schema";
import { requireClinician } from "@/lib/auth";

type Result = { ok: true } | { ok: false; message: string };

const markSchema = z.object({ appointmentId: z.uuid(), reason: z.string().trim().min(1).max(300) });

/**
 * Mark a visit as missed (spec v2): only once it was due, and only while it has no note and
 * isn't on an invoice (drizzle/0028 enforces this too). Missed visits count in Performance.
 */
export async function markVisitMissed(input: { appointmentId: string; reason: string }): Promise<Result> {
  const clinician = await requireClinician();
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Say why the visit was missed." };
  const { appointmentId, reason } = parsed.data;

  const [visit] = await db
    .select({
      startsAt: appointments.startsAt,
      missedAt: appointments.missedAt,
      noteId: notes.id,
      invoiced: sql<boolean>`exists (select 1 from ${invoiceItems} where ${invoiceItems.appointmentId} = ${appointments.id})`,
    })
    .from(appointments)
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicianId, clinician.id)));
  if (!visit) return { ok: false, message: "We couldn't find that visit." };
  if (visit.missedAt) return { ok: true };
  if (visit.noteId || visit.invoiced) {
    return { ok: false, message: "This visit already has a note, so it can't be marked missed." };
  }
  if (visit.startsAt > new Date()) {
    return { ok: false, message: "This visit hasn't started yet. If it won't happen, mark it missed once it's due." };
  }

  const now = new Date();
  await db
    .update(appointments)
    .set({ missedAt: now, missedReason: reason, updatedAt: now })
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.clinicianId, clinician.id),
        isNull(appointments.missedAt),
        lte(appointments.startsAt, now),
      ),
    );
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Undo "missed" when the visit did happen after all, so a note can be written. */
export async function undoVisitMissed(input: { appointmentId: string }): Promise<Result> {
  const clinician = await requireClinician();
  const parsed = z.object({ appointmentId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "We couldn't find that visit." };
  const updated = await db
    .update(appointments)
    .set({ missedAt: null, missedReason: null, updatedAt: new Date() })
    .where(
      and(
        eq(appointments.id, parsed.data.appointmentId),
        eq(appointments.clinicianId, clinician.id),
        isNotNull(appointments.missedAt),
      ),
    )
    .returning({ id: appointments.id });
  if (!updated.length) return { ok: false, message: "That visit isn't marked missed. Refresh the page." };
  revalidatePath("/", "layout");
  return { ok: true };
}
