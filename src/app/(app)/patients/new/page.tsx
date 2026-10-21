import { PageHeader } from "@/components/page-header";
import { requireClinician } from "@/lib/auth";
import { ClinicianAddPatientForm } from "./add-patient-form";

/** Add patient from the clinician app (spec v2 section 4b): the patient joins the practice list. */
export default async function AddPatientPage() {
  await requireClinician();
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline="New patient" title="Add a patient" back={{ href: "/patients", label: "Patients" }} />
      <ClinicianAddPatientForm />
    </div>
  );
}
