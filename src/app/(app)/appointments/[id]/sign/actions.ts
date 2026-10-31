"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clinicians, notes, patients } from "@/db/schema";
import { disciplineProblem } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import { goalsFromEvaluation, hasSignedPlan } from "@/lib/note-context";
import { writeNote } from "@/lib/note-summary";
import { getTemplate, missingFields, type Care, type NoteKind } from "@/lib/note-templates";
import { isValidTimeZone } from "@/lib/reminders";
import { isSignatureImage } from "@/lib/signature";
import { clockProblem } from "@/lib/visit-clock";

const input = z.object({
  appointmentId: z.uuid(),
  /** The draft's updatedAt when the Sign note screen opened, so a later edit isn't signed unseen. */
  draftSavedAt: z.iso.datetime(),
  clinicianSignature: z.string(),
  patientSignature: z.string().nullable(),
  timeZone: z.string().max(64),
});

export type SignResult = { ok: true } | { ok: false; message: string; field?: "clinician" | "patient" };

/**
 * Sign note (spec v2 section 4): saves both signatures, writes the finished note from the
 * sections and locks it. The clinician's signature is required; the patient's is optional but
 * is always offered. After this, the database trigger refuses any change to the note.
 */
export async function signNote(raw: z.input<typeof input>): Promise<SignResult> {
  const clinician = await requireClinician();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const { appointmentId, draftSavedAt, clinicianSignature, patientSignature, timeZone } = parsed.data;

  if (!isSignatureImage(clinicianSignature)) {
    return { ok: false, field: "clinician", message: "Add your signature to save." };
  }
  if (patientSignature !== null && !isSignatureImage(patientSignature)) {
    return { ok: false, field: "patient", message: "The patient's signature didn't come through. Clear it and sign again." };
  }

  const [visit] = await db
    .select({
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      patientId: patients.id,
      patientName: patients.fullName,
      noteId: notes.id,
      kind: notes.kind,
      care: notes.care,
      fields: notes.fields,
      updatedAt: notes.updatedAt,
      signedAt: notes.signedAt,
      version: notes.version,
      savedTimeZone: clinicians.timeZone,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicianId, clinician.id)));
  if (!visit) return { ok: false, message: "We couldn't find this visit. Please go back to Appointments." };
  if (!visit.noteId || !visit.kind || !visit.care || !visit.updatedAt) {
    return { ok: false, message: "This note hasn't been saved yet. Go back to the note and fill it in first." };
  }
  if (visit.signedAt) return { ok: false, message: "This note is already signed and locked." };
  if (visit.updatedAt.toISOString() !== new Date(draftSavedAt).toISOString()) {
    return { ok: false, message: "The note changed since you opened this page. Check the summary again, then sign." };
  }

  const unclocked = await clockProblem(appointmentId, visit.version ?? 1);
  if (unclocked) return { ok: false, message: unclocked };

  const care = visit.care as Care;
  const kind = visit.kind as NoteKind;
  const notAllowed = await disciplineProblem(clinician.id, care, kind);
  if (notAllowed) return { ok: false, message: notAllowed };
  if (care === "hha" && !(await hasSignedPlan(visit.patientId, clinician.practiceId))) {
    return { ok: false, message: "Aide visit notes stay locked until the aide service plan is signed." };
  }
  const template = getTemplate(kind, care);
  const evaluation = await goalsFromEvaluation(visit.patientId, care, clinician.practiceId);
  const goals = evaluation?.goals ?? [];
  if (missingFields(template, visit.fields ?? {}, goals.length).length) {
    return { ok: false, message: "Some sections still need an answer. Go back to the note to finish them." };
  }

  const zone = isValidTimeZone(timeZone) ? timeZone : visit.savedTimeZone && isValidTimeZone(visit.savedTimeZone) ? visit.savedTimeZone : "UTC";
  const from = visit.timeIn ?? visit.startsAt;
  const to = visit.timeOut ?? new Date(visit.startsAt.getTime() + visit.durationMinutes * 60_000);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: zone }).format(from);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: zone });
  const body = writeNote({
    template,
    fields: visit.fields ?? {},
    goals,
    firstName: visit.patientName.split(" ")[0],
    when: `${date}, ${time.format(from)}–${time.format(to)}`,
  });

  // Only an unsigned note with the reviewed draft is signed; anything else changed underneath us.
  const signed = await db
    .update(notes)
    .set({ body, clinicianSignature, patientSignature, signedAt: new Date() })
    .where(and(eq(notes.id, visit.noteId), isNull(notes.signedAt), eq(notes.updatedAt, visit.updatedAt)))
    .returning({ id: notes.id });
  if (!signed.length) {
    return { ok: false, message: "The note changed since you opened this page. Check the summary again, then sign." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
