import "server-only";
import { and, asc, desc, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicians, diagnosisCodes, notes, patientDiagnoses, patients } from "@/db/schema";

// The clinician's Patients screens (spec v2 section 4). The patient list is shared across the
// practice; visits and notes stay the clinician's own.

/** Every patient in the practice, with this clinician's last visit and whether a note is waiting. */
export async function practicePatients(practiceId: string, clinicianId: string) {
  // Drizzle leaves columns unqualified inside these subqueries, so the table names are written out.
  const mine = sql`a.patient_id = patients.id and a.clinician_id = ${clinicianId}`;
  return db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      status: patients.status,
      isMine: sql<boolean>`${patients.clinicianId} = ${clinicianId}`,
      adminChecking: isNotNull(patients.duplicateFlaggedAt),
      lastVisit: sql<Date | null>`(select max(a.starts_at) from appointments a where ${mine} and a.starts_at <= now())`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
      noteToDo: sql<boolean>`exists (select 1 from appointments a left join notes n on n.appointment_id = a.id
        where ${mine} and a.starts_at + make_interval(mins => a.duration_minutes) < now() and n.signed_at is null)`,
    })
    .from(patients)
    .where(and(eq(patients.practiceId, practiceId), ne(patients.status, "merged")))
    .orderBy(asc(patients.status), asc(patients.fullName));
}

export type VisitStatus = "upcoming" | "needs-note" | "draft" | "signed" | "invoiced" | "missed";

/** One practice patient for the record screen, or null if they're in another practice. */
export async function patientRecord(patientId: string, practiceId: string, clinicianId: string) {
  const [patient] = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      phone: patients.phone,
      address: patients.address,
      onMap: sql<boolean>`${patients.homeLat} is not null`,
      email: patients.invoiceEmail,
      status: patients.status,
      mergedIntoId: patients.mergedIntoId,
      servicesOrdered: patients.servicesOrdered,
      orderingDoctor: patients.orderingDoctor,
      createdAt: patients.createdAt,
      assignedId: patients.clinicianId,
      assignedName: clinicians.name,
      duplicateFlaggedAt: patients.duplicateFlaggedAt,
    })
    .from(patients)
    .innerJoin(clinicians, eq(clinicians.id, patients.clinicianId))
    .where(and(eq(patients.id, patientId), eq(patients.practiceId, practiceId)));
  if (!patient) return null;

  const [diagnoses, visits] = await Promise.all([
    db
      .select({ code: diagnosisCodes.code, description: diagnosisCodes.description })
      .from(patientDiagnoses)
      .innerJoin(diagnosisCodes, eq(diagnosisCodes.code, patientDiagnoses.code))
      .where(eq(patientDiagnoses.patientId, patientId))
      .orderBy(asc(patientDiagnoses.addedAt)),
    db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        durationMinutes: appointments.durationMinutes,
        typeOfCare: appointments.typeOfCare,
        noteId: notes.id,
        signedAt: notes.signedAt,
        missedAt: appointments.missedAt,
        invoiced: sql<boolean>`exists (select 1 from invoice_items i where i.appointment_id = appointments.id)`,
      })
      .from(appointments)
      .leftJoin(notes, eq(notes.appointmentId, appointments.id))
      .where(and(eq(appointments.patientId, patientId), eq(appointments.clinicianId, clinicianId)))
      .orderBy(desc(appointments.startsAt)),
  ]);

  const now = Date.now();
  const withStatus = visits.map((v) => {
    const end = v.startsAt.getTime() + v.durationMinutes * 60_000;
    const status: VisitStatus = v.missedAt
      ? "missed"
      : v.invoiced
      ? "invoiced"
      : v.signedAt
        ? "signed"
        : v.noteId
          ? "draft"
          : end < now
            ? "needs-note"
            : "upcoming";
    return { ...v, status };
  });
  return { patient, diagnoses, visits: withStatus };
}

/**
 * The Care team card: for each discipline, the latest signed evaluation that set goals, and
 * the aide service plan (signed, or a draft someone has started). Anyone in the practice.
 */
export async function careTeam(patientId: string, practiceId: string) {
  const rows = await db
    .select({
      kind: notes.kind,
      care: notes.care,
      fields: notes.fields,
      signedAt: notes.signedAt,
      updatedAt: notes.updatedAt,
      author: clinicians.name,
    })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(clinicians.practiceId, practiceId),
        or(eq(notes.kind, "evaluation"), eq(notes.kind, "service_plan")),
      ),
    )
    .orderBy(desc(notes.signedAt), desc(notes.updatedAt));

  const evaluations = new Map<string, { goals: number; signedAt: Date; author: string }>();
  for (const r of rows) {
    if (r.kind !== "evaluation" || !r.signedAt || evaluations.has(r.care)) continue;
    const goals = Array.isArray(r.fields?.goals)
      ? (r.fields.goals as { text?: unknown }[]).filter((g) => typeof g?.text === "string" && g.text.trim()).length
      : 0;
    evaluations.set(r.care, { goals, signedAt: r.signedAt, author: r.author });
  }
  const signedPlan = rows.find((r) => r.kind === "service_plan" && r.signedAt);
  const draftPlan = rows.find((r) => r.kind === "service_plan" && !r.signedAt);
  return {
    evaluations,
    plan: signedPlan
      ? { status: "signed" as const, at: signedPlan.signedAt!, author: signedPlan.author }
      : draftPlan
        ? { status: "draft" as const, at: draftPlan.updatedAt, author: draftPlan.author }
        : null,
  };
}

