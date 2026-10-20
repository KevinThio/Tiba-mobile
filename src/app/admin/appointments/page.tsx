import { and, asc, eq, gte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { appointments, clinicians, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { UpcomingList } from "./upcoming-list";

/**
 * Upcoming visits for every clinician in the practice (spec v2 admin Appointments), grouped
 * by day in the viewer's time zone and filterable by clinician. Read-only: clinicians book.
 */
export default async function AdminAppointmentsPage() {
  const admin = await requireAdmin();
  // From a day back, so "today" is complete in any time zone; the browser drops past days.
  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      typeOfCare: appointments.typeOfCare,
      patientName: patients.fullName,
      clinicianId: clinicians.id,
      clinicianName: clinicians.name,
    })
    .from(appointments)
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(clinicians.practiceId, admin.practiceId), gte(appointments.startsAt, sql`now() - interval '1 day'`)))
    .orderBy(asc(appointments.startsAt))
    .limit(500);

  const team = await db
    .select({ id: clinicians.id, name: clinicians.name })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician")))
    .orderBy(asc(clinicians.name));

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader overline="Upcoming" title="Appointments" description="Visits your clinicians have booked, soonest first." />
      <UpcomingList
        clinicians={team}
        appointments={rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString() }))}
      />
    </div>
  );
}
