import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, notes, patients } from "@/db/schema";

// Notes to do (spec v2): finished visits with no note yet, and notes started but not signed.

const ended = sql`${appointments.startsAt} + make_interval(mins => ${appointments.durationMinutes}) < now()`;

/** Counts for the menu badge, the Appointments reminder and the Notes to do header. */
export async function notesToDoCounts(clinicianId: string) {
  const [row] = await db
    .select({
      needNote: sql<number>`count(*) filter (where ${notes.id} is null and ${ended})::int`,
      drafts: sql<number>`count(*) filter (where ${notes.id} is not null and ${notes.signedAt} is null)::int`,
    })
    .from(appointments)
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(eq(appointments.clinicianId, clinicianId));
  return { needNote: row?.needNote ?? 0, drafts: row?.drafts ?? 0 };
}

/** Finished visits with no note yet, most recent first. */
export function visitsNeedingNotes(clinicianId: string) {
  return db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      typeOfCare: appointments.typeOfCare,
      patientName: patients.fullName,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(and(eq(appointments.clinicianId, clinicianId), isNull(notes.id), ended))
    .orderBy(desc(appointments.startsAt));
}

/** Notes started but not signed, most recently edited first. */
export function draftNotes(clinicianId: string) {
  return db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      typeOfCare: appointments.typeOfCare,
      patientName: patients.fullName,
      editedAt: notes.updatedAt,
    })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.clinicianId, clinicianId), isNull(notes.signedAt)))
    .orderBy(desc(notes.updatedAt));
}
