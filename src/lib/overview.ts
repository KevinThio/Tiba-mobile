import "server-only";
import { and, asc, eq, gte, isNotNull, isNull, lt, min, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicians, patients, reviews, serviceAgreements } from "@/db/schema";

// Extra rows for the admin Overview (spec v2 section 5b). Everything is scoped to one practice.

/** Agreements the client signed that still need the admin's (witness) signature, oldest first. */
export function agreementsToSign(practiceId: string) {
  return db
    .select({ patientId: patients.id, name: patients.fullName, signedAt: serviceAgreements.patientSignedAt })
    .from(serviceAgreements)
    .innerJoin(patients, eq(patients.id, serviceAgreements.patientId))
    .where(
      and(
        eq(serviceAgreements.practiceId, practiceId),
        isNotNull(serviceAgreements.patientSignature),
        isNull(serviceAgreements.adminSignature),
        ne(patients.status, "merged"),
      ),
    )
    .orderBy(asc(serviceAgreements.patientSignedAt));
}

/** Clinicians whose accounts are deactivated (their notes are kept). */
export function deactivatedClinicians(practiceId: string) {
  return db
    .select({ id: clinicians.id, name: clinicians.name })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "clinician"), eq(clinicians.status, "deactivated")))
    .orderBy(asc(clinicians.name));
}

/** When the oldest review the admin hasn't opened arrived (hidden ones don't count). */
export async function oldestNewReview(practiceId: string) {
  const [row] = await db
    .select({ at: min(reviews.createdAt) })
    .from(reviews)
    .where(and(eq(reviews.practiceId, practiceId), isNull(reviews.seenAt), isNull(reviews.hiddenAt)));
  return row?.at ?? null;
}

/**
 * Visits from 36 hours back to 36 hours ahead, for "Today across the practice". The server
 * doesn't know the viewer's time zone, so the browser keeps the ones on its own today.
 */
export function visitsAroundToday(practiceId: string) {
  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      typeOfCare: appointments.typeOfCare,
      clinicianName: clinicians.name,
      missed: isNotNull(appointments.missedAt),
    })
    .from(appointments)
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .where(
      and(
        eq(clinicians.practiceId, practiceId),
        gte(appointments.startsAt, sql`now() - interval '36 hours'`),
        lt(appointments.startsAt, sql`now() + interval '36 hours'`),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}
