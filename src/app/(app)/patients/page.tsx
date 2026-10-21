import { UserPlus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireClinician } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { practicePatients } from "@/lib/patients";
import { PatientsView } from "./patients-view";

/**
 * Patients (spec v2 section 4 and the prototype): every patient in the practice, with search,
 * "Note to do" for patients with one of your visits waiting for a note, and "Admin checking"
 * for possible duplicates.
 */
export default async function PatientsPage() {
  const clinician = await requireClinician();
  const rows = await practicePatients(clinician.practiceId, clinician.id);
  const active = rows.filter((r) => r.status === "active").length;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline={`${active} ${active === 1 ? "patient" : "patients"} in ${clinician.practiceName}`}
        title="Patients"
        actions={
          <Button nativeButton={false} render={<Link href="/patients/new" />}>
            <UserPlus aria-hidden /> Add patient
          </Button>
        }
      />
      <PatientsView
        patients={rows.map((r) => ({
          id: r.id,
          name: r.fullName,
          age: ageFrom(r.dateOfBirth),
          discharged: r.status === "discharged",
          isMine: r.isMine,
          adminChecking: Boolean(r.adminChecking),
          noteToDo: r.noteToDo,
          lastVisit: r.lastVisit?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
