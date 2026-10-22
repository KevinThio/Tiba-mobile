"use server";

import { and, asc, desc, eq, ilike, isNotNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clinicians, diagnosisCodes, notes } from "@/db/schema";
import { disciplineProblem } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import { NOT_PREFILLED, type Care, type NoteKind } from "@/lib/note-templates";

const KINDS = ["progress", "evaluation", "oasis", "service_plan"] as const;
const CARES = ["pt", "ot", "st", "rn", "hha", "individual", "couples", "assessment", "followup"] as const;
const MAX_FIELDS_BYTES = 200_000;

export type DiagnosisOption = { code: string; description: string };

/** Type-to-filter diagnosis codes for the note: matches the code ("F41") or words ("anxiety"). */
export async function searchNoteDiagnoses(query: string): Promise<DiagnosisOption[]> {
  await requireClinician();
  const q = String(query ?? "").trim().slice(0, 60);
  if (!q) return [];
  return db
    .select({ code: diagnosisCodes.code, description: diagnosisCodes.description })
    .from(diagnosisCodes)
    .where(or(ilike(diagnosisCodes.code, `${q}%`), ilike(diagnosisCodes.description, `%${q}%`)))
    .orderBy(asc(diagnosisCodes.code))
    .limit(8);
}

const draftInput = z.object({
  appointmentId: z.uuid(),
  kind: z.enum(KINDS),
  care: z.enum(CARES),
  fields: z.record(z.string(), z.unknown()),
  dxCode: z.string().max(20).nullable(),
});

export type SaveDraftResult = { ok: true; savedAt: string } | { ok: false; message: string };

/**
 * Saves the note as a draft (spec v2: "Saves as a draft as you type"). Creates the note on the
 * first save. A signed note can't change: the database trigger refuses it.
 */
export async function saveNoteDraft(input: z.input<typeof draftInput>): Promise<SaveDraftResult> {
  const clinician = await requireClinician();
  const parsed = draftInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const { appointmentId, kind, care, fields, dxCode } = parsed.data;
  const notAllowed = await disciplineProblem(clinician.id, care, kind);
  if (notAllowed) return { ok: false, message: notAllowed };
  if (JSON.stringify(fields).length > MAX_FIELDS_BYTES) {
    return { ok: false, message: "This note is too long to save. Please shorten the longest answers." };
  }

  const [visit] = await db
    .select({ id: appointments.id, noteId: notes.id, signedAt: notes.signedAt })
    .from(appointments)
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicianId, clinician.id)));
  if (!visit) return { ok: false, message: "We couldn't find this visit. Please go back to Appointments." };
  if (visit.signedAt) return { ok: false, message: "This note is signed and locked. Add an addendum instead." };

  if (dxCode) {
    const [code] = await db.select({ code: diagnosisCodes.code }).from(diagnosisCodes).where(eq(diagnosisCodes.code, dxCode));
    if (!code) return { ok: false, message: "Pick a diagnosis code from the list, or clear it." };
  }

  const now = new Date();
  await db
    .insert(notes)
    .values({ appointmentId, kind, care, fields, dxCode, updatedAt: now })
    .onConflictDoUpdate({ target: notes.appointmentId, set: { kind, care, fields, dxCode, updatedAt: now } });

  // The first save turns the visit into a draft: refresh the menu count and lists.
  if (!visit.noteId) revalidatePath("/", "layout");
  return { ok: true, savedAt: now.toISOString() };
}

export type Prefill =
  // date: when the copied visit took place (ISO), not when its note was signed.
  | { ok: true; fields: Record<string, unknown>; dx: DiagnosisOption | null; date: string; author: string }
  | { ok: false; reason: "none" | "other-practice" };

/**
 * "Prefill from last visit" (spec v2 section 4b): the latest signed note of the same type for
 * the same patient, written by anyone in this practice. Billing minutes are never copied; visit
 * times live on the appointment, so they aren't copied either.
 */
export async function getPrefill(input: { appointmentId: string; kind: NoteKind; care: Care }): Promise<Prefill> {
  const clinician = await requireClinician();
  const parsed = z
    .object({ appointmentId: z.uuid(), kind: z.enum(KINDS), care: z.enum(CARES) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "none" };
  const { appointmentId, kind, care } = parsed.data;

  const [visit] = await db
    .select({ patientId: appointments.patientId })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicianId, clinician.id)));
  if (!visit) return { ok: false, reason: "none" };

  const [last] = await db
    .select({
      fields: notes.fields,
      dxCode: notes.dxCode,
      dxDescription: diagnosisCodes.description,
      visitAt: appointments.startsAt,
      author: clinicians.name,
      authorPractice: clinicians.practiceId,
    })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .leftJoin(diagnosisCodes, eq(diagnosisCodes.code, notes.dxCode))
    .where(
      and(
        eq(appointments.patientId, visit.patientId),
        ne(appointments.id, appointmentId),
        eq(notes.kind, kind),
        eq(notes.care, care),
        isNotNull(notes.signedAt),
      ),
    )
    // The most recent visit, so a note signed late for an older visit isn't picked over a newer one.
    .orderBy(desc(appointments.startsAt))
    .limit(1);
  if (!last) return { ok: false, reason: "none" };
  if (last.authorPractice !== clinician.practiceId) return { ok: false, reason: "other-practice" };

  const fields = Object.fromEntries(Object.entries(last.fields ?? {}).filter(([k]) => !NOT_PREFILLED.has(k)));
  const dx = last.dxCode ? { code: last.dxCode, description: last.dxDescription ?? "" } : null;
  return { ok: true, fields, dx, date: last.visitAt.toISOString(), author: last.author };
}
