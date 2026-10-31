import { and, count, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { appointments, clinicians, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { normalisePatientName } from "@/lib/patient-duplicates";
import { cn } from "@/lib/utils";
import { ReviewActions } from "./review-actions";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Duplicate review (spec v2 section 5b and the prototype): the existing record and the new
 * entry side by side, matching fields in green, with Merge into existing and Confirm new patient.
 */
export default async function DuplicateReviewPage({ params }: PageProps<"/admin/patients/[id]/duplicate">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const addedBy = alias(clinicians, "added_by");
  const [entry] = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      phone: patients.phone,
      email: patients.invoiceEmail,
      insurer: patients.insurer,
      clinician: clinicians.name,
      addedBy: addedBy.name,
      createdAt: patients.createdAt,
      duplicateOfId: patients.duplicateOfId,
      flaggedAt: patients.duplicateFlaggedAt,
    })
    .from(patients)
    .leftJoin(clinicians, eq(clinicians.id, patients.clinicianId))
    .leftJoin(addedBy, eq(addedBy.id, patients.addedById))
    .where(and(eq(patients.id, id), eq(patients.practiceId, admin.practiceId), ne(patients.status, "merged")));
  if (!entry) notFound();

  const back = { href: "/admin/patients", label: "Patients" };
  if (!entry.flaggedAt) {
    return (
      <div className="grid grid-cols-1 gap-8">
        <PageHeader back={back} overline="Possible duplicate" title={entry.fullName} />
        <EmptyState
          icon={CircleCheck}
          title="Already checked"
          action={
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/patients" />}>
              Back to Patients
            </Button>
          }
        >
          This patient isn&apos;t waiting for a duplicate check.
        </EmptyState>
      </div>
    );
  }

  const [existing] = entry.duplicateOfId
    ? await db
        .select({
          id: patients.id,
          fullName: patients.fullName,
          dateOfBirth: patients.dateOfBirth,
          phone: patients.phone,
          email: patients.invoiceEmail,
          insurer: patients.insurer,
          clinician: clinicians.name,
        })
        .from(patients)
        .leftJoin(clinicians, eq(clinicians.id, patients.clinicianId))
        .where(and(eq(patients.id, entry.duplicateOfId), eq(patients.practiceId, admin.practiceId), ne(patients.status, "merged")))
    : [];
  const [{ visits }] = await db.select({ visits: count() }).from(appointments).where(eq(appointments.patientId, entry.id));

  const rows: { label: string; existing: string | null; entry: string | null; same: (a: string, b: string) => boolean }[] = [
    {
      label: "Name",
      existing: existing?.fullName ?? null,
      entry: entry.fullName,
      same: (a, b) => normalisePatientName(a) === normalisePatientName(b),
    },
    {
      label: "Date of birth",
      existing: existing ? DATE.format(new Date(existing.dateOfBirth)) : null,
      entry: DATE.format(new Date(entry.dateOfBirth)),
      same: (a, b) => a === b,
    },
    {
      label: "Phone",
      existing: existing?.phone ?? null,
      entry: entry.phone,
      same: (a, b) => a.replace(/\D/g, "") === b.replace(/\D/g, ""),
    },
    {
      label: "Email",
      existing: existing?.email ?? null,
      entry: entry.email,
      same: (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase(),
    },
    { label: "Clinician", existing: existing?.clinician ?? null, entry: entry.clinician, same: (a, b) => a === b },
    { label: "Insurer", existing: existing?.insurer ?? null, entry: entry.insurer, same: (a, b) => a === b },
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={back}
        overline="Possible duplicate"
        title={entry.fullName}
        actions={<ReviewActions patientId={entry.id} canMerge={Boolean(existing)} placement="header" />}
      />

      <p className="max-w-3xl text-body-lg">
        Is this the same person? {entry.addedBy ?? "A clinician"} added {entry.fullName} on {DATE.format(entry.createdAt)}.{" "}
        {existing
          ? `${existing.fullName} already has a record with the same name and date of birth.`
          : "The record it matched isn't in your practice any more, so you can only confirm the new patient."}
      </p>

      {existing && (
        <div className="max-w-3xl overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
          <table className="w-full table-fixed text-left">
            <caption className="sr-only">Existing record and new entry side by side</caption>
            <thead className="bg-muted text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="w-[28%] px-4 py-3 sm:w-1/4">
                  <span className="sr-only">Field</span>
                </th>
                <th scope="col" className="px-4 py-3">
                  Existing record
                </th>
                <th scope="col" className="px-4 py-3">
                  New entry
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const match = r.existing !== null && r.entry !== null && r.same(r.existing, r.entry);
                const cell = cn("px-4 py-3 break-words", match && "bg-success font-semibold text-success-foreground");
                return (
                  <tr key={r.label} className="border-t border-border-subtle">
                    <th scope="row" className="px-4 py-3 text-small font-semibold text-muted-foreground">
                      {r.label}
                    </th>
                    <td className={cell}>{r.existing ?? <span className="font-normal text-subtle-foreground">Not added</span>}</td>
                    <td className={cell}>
                      {r.entry ?? <span className="font-normal text-subtle-foreground">Not added</span>}
                      {match && <span className="sr-only"> (matches)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="max-w-3xl text-small text-muted-foreground">
        Matching fields are in green. Merging keeps the existing record and moves any notes from the new one into it
        {visits > 0 ? ` (${visits} ${visits === 1 ? "visit" : "visits"} with their notes)` : ""}. The new entry is then
        hidden.
      </p>

      <div className="md:hidden">
        <ReviewActions patientId={entry.id} canMerge={Boolean(existing)} placement="page" />
      </div>
    </div>
  );
}
