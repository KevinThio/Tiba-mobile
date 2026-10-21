"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, noteAddenda, notes } from "@/db/schema";
import { requireClinician } from "@/lib/auth";

const MAX_LENGTH = 5000;

const input = z.object({ appointmentId: z.uuid(), body: z.string() });

export type AddendumResult = { ok: true } | { ok: false; message: string };

/**
 * Adds a correction to a signed note (spec v2: "Signed notes are locked. Add an addendum if
 * something changes."). The note itself never changes; addenda are dated and can't be edited or
 * deleted afterwards (a trigger in drizzle/0014 enforces both).
 */
export async function addAddendum(raw: z.input<typeof input>): Promise<AddendumResult> {
  const clinician = await requireClinician();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const body = parsed.data.body.trim();
  if (!body) return { ok: false, message: "Write what changed, then save." };
  if (body.length > MAX_LENGTH) {
    return { ok: false, message: `Keep an addendum under ${MAX_LENGTH.toLocaleString("en-GB")} characters, or add a second one.` };
  }

  const [note] = await db
    .select({ id: notes.id })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .where(
      and(
        eq(notes.appointmentId, parsed.data.appointmentId),
        eq(appointments.clinicianId, clinician.id),
        isNotNull(notes.signedAt),
      ),
    );
  if (!note) return { ok: false, message: "Addenda can only be added to your own signed notes." };

  await db.insert(noteAddenda).values({ noteId: note.id, body });
  revalidatePath(`/appointments/${parsed.data.appointmentId}`);
  return { ok: true };
}
