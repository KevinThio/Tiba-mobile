import { and, asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { INSURERS } from "@/lib/patient-options";
import { AddPatientForm } from "./add-patient-form";

/** Admin Add patient (spec v2 section 4b): the patient joins the practice for one clinician. */
export default async function AdminAddPatientPage() {
  const admin = await requireAdmin();
  const team = await db
    .select({ id: clinicians.id, name: clinicians.name })
    .from(clinicians)
    .where(
      and(eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician"), eq(clinicians.status, "active")),
    )
    .orderBy(asc(clinicians.name));

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline="New patient" title="Add a patient" back={{ href: "/admin/patients", label: "Patients" }} />
      <AddPatientForm clinicians={team} insurers={INSURERS[admin.country === "KE" ? "KE" : "US"]} />
    </div>
  );
}
