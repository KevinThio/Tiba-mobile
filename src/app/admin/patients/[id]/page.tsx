import { and, asc, eq, ne } from "drizzle-orm";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FileList } from "@/components/file-list";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { clinicians, diagnosisCodes, patientDiagnoses, patients, serviceAgreements } from "@/db/schema";
import { practiceClinicians } from "@/lib/admin-billing";
import { AGREEMENT_BADGE } from "@/lib/agreement-template";
import { agreementStatus, isComplete } from "@/lib/agreements";
import { listFiles, toSummary } from "@/lib/files";
import { requireAdmin } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { insurersFor, SERVICES } from "@/lib/patient-options";
import { practiceBilling } from "@/lib/practice";
import { CareForm, StatusButton } from "./patient-forms";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const STAMP = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * Patient details, admin (spec v2 section 5 and the prototype): details, care (clinician,
 * insurer, referral, start of care), Discharge or Reactivate, the service agreement and clinical
 * documents.
 */
export default async function AdminPatientPage({ params }: PageProps<"/admin/patients/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [patient] = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      phone: patients.phone,
      email: patients.invoiceEmail,
      insurer: patients.insurer,
      servicesOrdered: patients.servicesOrdered,
      orderingDoctor: patients.orderingDoctor,
      referralDate: patients.referralDate,
      startOfCare: patients.startOfCare,
      status: patients.status,
      clinicianId: patients.clinicianId,
      clinicianName: clinicians.name,
      flaggedAt: patients.duplicateFlaggedAt,
    })
    .from(patients)
    .innerJoin(clinicians, eq(clinicians.id, patients.clinicianId))
    .where(and(eq(patients.id, id), eq(patients.practiceId, admin.practiceId), ne(patients.status, "merged")));
  if (!patient) notFound();

  const [diagnoses, team, billing, agreementRow, documents] = await Promise.all([
    db
      .select({ code: diagnosisCodes.code, description: diagnosisCodes.description })
      .from(patientDiagnoses)
      .innerJoin(diagnosisCodes, eq(diagnosisCodes.code, patientDiagnoses.code))
      .where(eq(patientDiagnoses.patientId, id))
      .orderBy(asc(patientDiagnoses.addedAt)),
    practiceClinicians(admin.practiceId),
    practiceBilling(admin.practiceId),
    db.select().from(serviceAgreements).where(eq(serviceAgreements.patientId, id)),
    listFiles(admin.practiceId, "patient", id),
  ]);
  const first = patient.fullName.split(" ")[0];
  const signedRow = agreementRow[0] ?? null;
  const agreement = { status: agreementStatus(signedRow) };
  const agreementLine =
    agreement.status === "signed"
      ? `Signed by ${first} and ${signedRow!.adminSignedName ?? "you"}. Locked; download it from the agreement.`
      : agreement.status === "refused"
        ? `${first} refused to sign; ${signedRow!.adminSignedName ?? "you"} recorded it as the agency witness. Locked.`
      : agreement.status === "draft"
        ? "Details are saved. Sign it on the device with the client to finish."
      : agreement.status === "patient"
        ? `${first} signed on ${STAMP.format(signedRow!.patientSignedAt!)}. Add your signature to finish.`
        : agreement.status === "admin"
          ? `You signed. ${first} still needs to sign on the device.`
          : `Filled from ${first}'s details. You both sign on the device.`;
  const services = SERVICES.filter((s) => patient.servicesOrdered.includes(s.value));
  const insurers = insurersFor(billing.country);

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/patients", label: "Patients" }}
        overline={`${patient.status === "active" ? "Active" : "Discharged"} · ${patient.clinicianName}`}
        title={patient.fullName}
        actions={<StatusButton patientId={patient.id} name={patient.fullName} status={patient.status as "active" | "discharged"} />}
      />

      {patient.flaggedAt && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-warning px-4 py-3.5 text-warning-foreground">
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          <p className="min-w-[12rem] flex-1 font-semibold">Possible duplicate. Check it before anything else.</p>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/patients/${patient.id}/duplicate`} />}>
            Review
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Details</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Date of birth">
              {DATE.format(new Date(`${patient.dateOfBirth}T00:00:00Z`))} · {ageFrom(patient.dateOfBirth)}
            </Detail>
            <Detail label="Phone">{patient.phone ?? <Missing />}</Detail>
            <Detail label="Email">{patient.email ?? <Missing />}</Detail>
            <Detail label="Insurer">{patient.insurer ?? <Missing />}</Detail>
            <Detail label="Ordering doctor">{patient.orderingDoctor ?? <Missing />}</Detail>
            <Detail label="Diagnosis">
              {diagnoses.length ? diagnoses.map((d) => `${d.code} ${d.description}`).join(", ") : <Missing />}
            </Detail>
          </dl>
          <div className="grid gap-2">
            <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Services ordered</p>
            {services.length ? (
              <div className="flex flex-wrap gap-1.5">
                {services.map((s) => (
                  <Badge key={s.value} variant="neutral">
                    {s.label}
                  </Badge>
                ))}
              </div>
            ) : (
              <Missing />
            )}
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Care</h2>
          <CareForm
            patientId={patient.id}
            clinicians={team}
            insurers={insurers}
            initial={{
              clinicianId: patient.clinicianId,
              insurer: patient.insurer ?? "",
              referralDate: patient.referralDate ?? "",
              startOfCare: patient.startOfCare ?? "",
            }}
          />
        </section>

        <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Service agreement</h2>
          <Badge variant={AGREEMENT_BADGE[agreement.status].variant} className="w-fit">
            {AGREEMENT_BADGE[agreement.status].label}
          </Badge>
          <p className="text-small text-muted-foreground">{agreementLine}</p>
          <Button
            variant={isComplete(agreement.status) ? "outline" : "default"}
            className="w-fit"
            nativeButton={false}
            render={<Link href={`/admin/patients/${patient.id}/agreement`} />}
          >
            {isComplete(agreement.status) ? "Open agreement" : agreement.status === "none" ? "Start agreement" : "Continue agreement"}
          </Button>
        </section>

        <section className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-h3">Clinical documents</h2>
          <FileList
            owner={{ ownerKind: "patient", ownerId: patient.id }}
            files={documents.map(toSummary)}
            canUpload
            canRemove
            hint={`Referral letters, reports, test results. Kept with ${first}'s record. PDF, Word or an image, up to 5 MB.`}
            emptyText="No documents yet."
          />
        </section>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-subtle-foreground">Not added</span>;
}
