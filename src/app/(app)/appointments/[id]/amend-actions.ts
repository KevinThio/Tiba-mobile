"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, notes, noteVersions } from "@/db/schema";
import { disciplineProblem } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import type { Care } from "@/lib/note-templates";

const MAX_REASON = 1000;

export type AmendResult = { ok: true } | { ok: false; message: string };

/**
 * Reopens a signed note to correct it. The signed version is copied, unchanged, into
 * note_versions first; the note then becomes the next version, unsigned, with the reason, and
 * goes back to the editor. Signing it again finishes the amendment. The database trigger only
 * allows this reopening when the copy matches exactly (drizzle/0015).
 */
export async function startAmendment(raw: { appointmentId: string; reason: string }): Promise<AmendResult> {
  const clinician = await requireClinician();
  const parsed = z.object({ appointmentId: z.uuid(), reason: z.string() }).safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const reason = parsed.data.reason.trim();
  if (reason.length < 3) return { ok: false, message: "Say briefly what needs correcting, so the record shows why it changed." };
  if (reason.length > MAX_REASON) return { ok: false, message: `Keep the reason under ${MAX_REASON.toLocaleString("en-GB")} characters.` };

  const [note] = await db
    .select({ note: notes, timeIn: appointments.timeIn, timeOut: appointments.timeOut })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .where(and(eq(notes.appointmentId, parsed.data.appointmentId), eq(appointments.clinicianId, clinician.id)));
  if (!note) return { ok: false, message: "We couldn't find this note. Please go back to Appointments." };
  const n = note.note;
  if (!n.signedAt || !n.clinicianSignature) return { ok: false, message: "This note isn't signed, so you can edit it directly." };
  // Only reopen notes the clinician can still write, or they'd be stuck in an editor they can't use.
  const notAllowed = await disciplineProblem(clinician.id, n.care as Care, n.kind);
  if (notAllowed) return { ok: false, message: `${notAllowed} Add an addendum instead.` };

  await db.transaction(async (tx) => {
    // A cancelled amendment leaves the same version already copied; the copy is identical.
    await tx
      .insert(noteVersions)
      .values({
        noteId: n.id,
        version: n.version,
        kind: n.kind,
        care: n.care,
        fields: n.fields,
        dxCode: n.dxCode,
        body: n.body,
        clinicianSignature: n.clinicianSignature!,
        patientSignature: n.patientSignature,
        signedAt: n.signedAt!,
        amendmentReason: n.amendmentReason,
        timeIn: note.timeIn,
        timeOut: note.timeOut,
      })
      .onConflictDoNothing({ target: [noteVersions.noteId, noteVersions.version] });
    await tx
      .update(notes)
      .set({
        signedAt: null,
        clinicianSignature: null,
        patientSignature: null,
        body: "",
        version: n.version + 1,
        amendmentReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(notes.id, n.id), eq(notes.signedAt, n.signedAt!)));
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Drops an amendment that hasn't been signed: the note goes back to its last signed version,
 * exactly as it was (answers, visit times, signatures and when it was signed).
 */
export async function cancelAmendment(raw: { appointmentId: string }): Promise<AmendResult> {
  const clinician = await requireClinician();
  const parsed = z.object({ appointmentId: z.uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };

  const [note] = await db
    .select({ id: notes.id, version: notes.version })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .where(
      and(
        eq(notes.appointmentId, parsed.data.appointmentId),
        eq(appointments.clinicianId, clinician.id),
        isNull(notes.signedAt),
        isNotNull(notes.amendmentReason),
      ),
    );
  if (!note || note.version < 2) return { ok: false, message: "There's no amendment to cancel on this note." };

  const [previous] = await db
    .select()
    .from(noteVersions)
    .where(and(eq(noteVersions.noteId, note.id), eq(noteVersions.version, note.version - 1)));
  if (!previous) return { ok: false, message: "We couldn't find the signed version. Please sign the note again instead." };

  await db.transaction(async (tx) => {
    // Times first: they lock again as soon as the note is signed.
    await tx
      .update(appointments)
      .set({ timeIn: previous.timeIn, timeOut: previous.timeOut })
      .where(eq(appointments.id, parsed.data.appointmentId));
    await tx
      .update(notes)
      .set({
        kind: previous.kind as typeof notes.$inferSelect.kind,
        care: previous.care,
        fields: previous.fields,
        dxCode: previous.dxCode,
        body: previous.body,
        clinicianSignature: previous.clinicianSignature,
        patientSignature: previous.patientSignature,
        signedAt: previous.signedAt,
        version: previous.version,
        amendmentReason: previous.amendmentReason,
        updatedAt: sql`now()`,
      })
      .where(and(eq(notes.id, note.id), isNull(notes.signedAt)));
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
