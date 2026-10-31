import { ChevronRight, UserPlus, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { clinicianSettings } from "@/lib/account";
import { requireClinician } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { openOfferCount } from "@/lib/patient-offers";
import { practicePatients } from "@/lib/patients";
import { PatientsView } from "./patients-view";

/**
 * Patients (spec v2 section 4 and the prototype): every patient in the practice, with search,
 * "Note to do" for patients with one of your visits waiting for a note, and "Admin checking"
 * for possible duplicates.
 */
export default async function PatientsPage() {
  const clinician = await requireClinician();
  const { discipline } = await clinicianSettings(clinician.id);
  const [rows, offers] = await Promise.all([
    practicePatients(clinician.practiceId, clinician.id),
    openOfferCount(clinician.practiceId, clinician.id, discipline),
  ]);
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
      {offers > 0 && (
        <Link
          href="/new-patients"
          className="flex items-center gap-3 rounded-lg bg-accent px-4 py-3.5 text-accent-foreground outline-none hover:bg-accent/80 focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
        >
          <UserRoundPlus className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            {offers === 1 ? "A new patient is" : `${offers} new patients are`} waiting for a clinician. Accept the ones you
            can take.
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}
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
