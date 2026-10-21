import { PageHeader } from "@/components/page-header";
import { completedNotes, practiceClinicians } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { NotesList } from "./notes-list";

/**
 * Completed notes (spec v2 section 5 and the prototype): every signed note in the practice,
 * newest first, with a clinician filter and whether it's been billed to insurance.
 */
export default async function CompletedNotesPage() {
  const admin = await requireAdmin();
  const [rows, team] = await Promise.all([completedNotes(admin.practiceId), practiceClinicians(admin.practiceId)]);
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader overline="All clinicians" title="Completed notes" />
      <NotesList
        clinicians={team}
        notes={rows.map((r) => ({
          appointmentId: r.appointmentId,
          patientName: r.patientName,
          clinicianId: r.clinicianId,
          clinicianName: r.clinicianName,
          typeOfCare: r.typeOfCare,
          startsAt: r.startsAt.toISOString(),
          billed: Boolean(r.billedAt),
        }))}
      />
    </div>
  );
}
