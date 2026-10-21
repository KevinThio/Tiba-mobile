import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicians, notes } from "@/db/schema";
import type { Care, Goal } from "@/lib/note-templates";

// Lookups the visit note, Sign note and the sign action share: goals from the evaluation, and
// whether an aide visit may be documented yet.

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Goals from the latest signed initial evaluation for this patient and discipline, written by
 * anyone in the practice (spec v2: "Goals come only from a signed evaluation in the same practice").
 */
export async function goalsFromEvaluation(patientId: string, care: Care, practiceId: string) {
  const [evaluation] = await db
    .select({ fields: notes.fields, signedAt: notes.signedAt, author: clinicians.name })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(notes.kind, "evaluation"),
        eq(notes.care, care),
        isNotNull(notes.signedAt),
        eq(clinicians.practiceId, practiceId),
      ),
    )
    .orderBy(desc(notes.signedAt))
    .limit(1);
  if (!evaluation) return null;
  const goals = (Array.isArray(evaluation.fields?.goals) ? (evaluation.fields.goals as Goal[]) : []).filter(
    (g) => g && typeof g.text === "string" && g.text.trim(),
  );
  return { goals, from: `Goals from the ${DATE.format(evaluation.signedAt!)} evaluation by ${evaluation.author}.` };
}

export async function hasSignedPlan(patientId: string, practiceId: string) {
  const [plan] = await db
    .select({ id: notes.id })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(notes.kind, "service_plan"),
        isNotNull(notes.signedAt),
        eq(clinicians.practiceId, practiceId),
      ),
    )
    .limit(1);
  return Boolean(plan);
}

/** This clinician's unsigned service plan for the patient, if they've started one. */
export async function draftPlanFor(patientId: string, clinicianId: string) {
  const [plan] = await db
    .select({ appointmentId: notes.appointmentId })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(appointments.clinicianId, clinicianId),
        eq(notes.kind, "service_plan"),
        isNull(notes.signedAt),
      ),
    )
    .limit(1);
  return plan?.appointmentId ?? null;
}
