import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { clinicians, referrals } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { insurersFor } from "@/lib/patient-options";
import { AddPatientForm, type PatientPrefill } from "./add-patient-form";

/**
 * Admin Add patient (spec v2 section 4b): the patient joins the practice for one clinician, or is
 * offered to every clinician who does a type of care (src/lib/patient-offers.ts). With
 * `?referral=<id>` (an accepted referral, not yet added) the form starts from its details.
 */
export default async function AdminAddPatientPage({ searchParams }: PageProps<"/admin/patients/new">) {
  const admin = await requireAdmin();
  const { referral } = await searchParams;
  const team = await db
    .select({ id: clinicians.id, name: clinicians.name, discipline: clinicians.discipline })
    .from(clinicians)
    .where(
      and(eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician"), eq(clinicians.status, "active")),
    )
    .orderBy(asc(clinicians.name));

  let prefill: PatientPrefill | undefined;
  if (typeof referral === "string" && z.uuid().safeParse(referral).success) {
    const [r] = await db
      .select({
        id: referrals.id,
        patientName: referrals.patientName,
        birthDate: referrals.birthDate,
        insurer: referrals.insurer,
        createdAt: referrals.createdAt,
        source: clinicians.organisation,
        sourceName: clinicians.name,
      })
      .from(referrals)
      .innerJoin(clinicians, eq(clinicians.id, referrals.referrerId))
      .where(
        and(
          eq(referrals.id, referral),
          eq(referrals.practiceId, admin.practiceId),
          eq(referrals.status, "accepted"),
          isNull(referrals.patientId),
        ),
      );
    if (r) {
      prefill = {
        referralId: r.id,
        fullName: r.patientName,
        dateOfBirth: r.birthDate,
        insurer: r.insurer,
        referralDate: r.createdAt.toISOString().slice(0, 10),
        source: r.source ?? r.sourceName,
      };
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        overline={prefill ? "From a referral" : "New patient"}
        title="Add a patient"
        back={prefill ? { href: "/admin/referrals", label: "Referral sources" } : { href: "/admin/patients", label: "Patients" }}
      />
      <AddPatientForm clinicians={team} insurers={insurersFor(admin.country)} prefill={prefill} />
    </div>
  );
}
