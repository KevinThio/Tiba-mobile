import { asc, eq } from "drizzle-orm";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { clinicians, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PatientsList } from "./patients-list";

/** Every patient in the practice (spec v2 admin Patients). */
export default async function AdminPatientsPage() {
  const admin = await requireAdmin();
  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      status: patients.status,
      insurer: patients.insurer,
      referralDate: patients.referralDate,
      startOfCare: patients.startOfCare,
      createdAt: patients.createdAt,
      clinicianName: clinicians.name,
    })
    .from(patients)
    .innerJoin(clinicians, eq(clinicians.id, patients.clinicianId))
    .where(eq(patients.practiceId, admin.practiceId))
    .orderBy(asc(patients.fullName));

  const active = rows.filter((r) => r.status === "active").length;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline={`${active} active · ${rows.length - active} discharged`}
        title="Patients"
        actions={
          <Button nativeButton={false} render={<Link href="/admin/patients/new" />}>
            <UserPlus aria-hidden />
            Add patient
          </Button>
        }
      />
      <PatientsList
        patients={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
