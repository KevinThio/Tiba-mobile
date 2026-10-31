import { PageHeader } from "@/components/page-header";
import { practiceClinicians } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { practiceVisitRecords, RECORD_DAYS } from "@/lib/visit-clock";
import { VisitRecords } from "./visit-records";

/**
 * Clock in and out (electronic visit verification): every visit from the last RECORD_DAYS days,
 * newest first, with when and where the clinician clocked in and out and whether the patient
 * signed. Visits away from the patient's home, or without a location, are flagged.
 */
export default async function VisitRecordsPage() {
  const admin = await requireAdmin();
  const [records, team] = await Promise.all([practiceVisitRecords(admin.practiceId), practiceClinicians(admin.practiceId)]);
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline="All clinicians"
        title="Clock in and out"
        description={`Where and when your clinicians clocked in and out of visits in the last ${RECORD_DAYS} days.`}
      />
      <VisitRecords
        clinicians={team}
        records={records.map((r) => ({
          ...r,
          startsAt: r.startsAt.toISOString(),
          in: r.in && { ...r.in, at: r.in.at.toISOString() },
          out: r.out && { ...r.out, at: r.out.at.toISOString() },
        }))}
      />
    </div>
  );
}
