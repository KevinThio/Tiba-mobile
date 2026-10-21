import { CalendarX2, ChevronRight, Info, PenLine, ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireClinician } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { CARE_LABEL, careFromTypeOfCare, type Care } from "@/lib/note-templates";
import { SERVICES } from "@/lib/patient-options";
import { careTeam, patientRecord, type VisitStatus } from "@/lib/patients";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

const STATUS_BADGE: Record<VisitStatus | "needs-plan", { label: string; variant: "outline" | "warning" | "neutral" | "success" }> = {
  upcoming: { label: "Upcoming", variant: "outline" },
  "needs-note": { label: "Needs note", variant: "warning" },
  "needs-plan": { label: "Needs plan", variant: "warning" },
  draft: { label: "Draft", variant: "neutral" },
  signed: { label: "Signed", variant: "success" },
  invoiced: { label: "Invoiced", variant: "success" },
};

// Disciplines that set goals with an evaluation, by the service ordered.
const EVALUATED: { service: string; care: Care }[] = [
  { service: "RN", care: "rn" },
  { service: "PT", care: "pt" },
  { service: "OT", care: "ot" },
  { service: "ST", care: "st" },
];

/**
 * Patient record (spec v2 section 4 and the prototype): age and "Your patient since", details,
 * diagnosis codes, the Care team card, and your visits with their status. Write note / Finish
 * note opens the most recent visit waiting for a note; Create invoice needs a signed visit.
 */
export default async function PatientRecordPage({ params }: PageProps<"/patients/[id]">) {
  const clinician = await requireClinician();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const record = await patientRecord(id, clinician.practiceId, clinician.id);
  if (!record) notFound();
  const { patient, diagnoses, visits } = record;
  const team = await careTeam(id, clinician.practiceId);

  const past = visits.filter((v) => v.status !== "upcoming");
  const firstVisit = past.at(-1);
  const since = firstVisit
    ? `Your patient since ${MONTH.format(firstVisit.startsAt)}`
    : patient.assignedId === clinician.id
      ? `Your patient since ${MONTH.format(patient.createdAt)}`
      : `${patient.assignedName}'s patient`;
  const draft = visits.find((v) => v.status === "draft");
  const needsNote = visits.find((v) => v.status === "needs-note");
  const invoiceable = visits.some((v) => v.status === "signed");
  const ordered = SERVICES.filter((s) => patient.servicesOrdered.includes(s.value));

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/patients", label: "Patients" }}
        overline={`${ageFrom(patient.dateOfBirth)} · ${since}`}
        title={patient.fullName}
        actions={
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <Button nativeButton={false} render={<Link href={`/appointments/${draft.id}`} />}>
                <PenLine aria-hidden /> Finish note
              </Button>
            ) : needsNote ? (
              <Button nativeButton={false} render={<Link href={`/appointments/${needsNote.id}`} />}>
                <PenLine aria-hidden /> Write note
              </Button>
            ) : null}
            {invoiceable ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/invoices" />}>
                <ReceiptText aria-hidden /> Create invoice
              </Button>
            ) : (
              <Button variant="outline" disabled title="Sign a visit note first">
                <ReceiptText aria-hidden /> Create invoice
              </Button>
            )}
          </div>
        }
      />

      {patient.duplicateFlaggedAt && (
        <div role="status" className="flex gap-3 rounded-md bg-info px-4 py-3.5 text-info-foreground">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Admin checking.</span> This record has the same name and date of birth as another
            patient. Your admin will confirm it&apos;s a different person or merge the two. You can keep seeing the patient
            meanwhile.
          </p>
        </div>
      )}
      {patient.status === "discharged" && (
        <div role="status" className="rounded-md bg-neutral px-4 py-3.5 text-neutral-foreground">
          <span className="font-semibold">Discharged.</span> New visits can&apos;t be booked. Your admin can reactivate them.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <Card title="Details">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Date of birth">{DATE.format(new Date(patient.dateOfBirth))}</Detail>
            <Detail label="Phone">{patient.phone ?? <Missing />}</Detail>
            <Detail label="Email">{patient.email ?? <Missing />}</Detail>
            <Detail label="Ordering doctor">{patient.orderingDoctor ?? <Missing />}</Detail>
            <Detail label="Assigned clinician">
              {patient.assignedId === clinician.id ? "You" : patient.assignedName}
            </Detail>
          </dl>
        </Card>

        <Card title="Diagnosis codes">
          {diagnoses.length ? (
            <ul className="grid gap-2">
              {diagnoses.map((d) => (
                <li key={d.code} className="flex gap-3 rounded-sm bg-muted px-3 py-2.5">
                  <span className="w-16 shrink-0 font-semibold tabular-nums">{d.code}</span>
                  <span className="min-w-0 text-small">{d.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted-foreground">No diagnosis codes yet. Add one when you write a note.</p>
          )}
        </Card>

        <Card title="Care team" className="md:col-span-2">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Services ordered</p>
              {ordered.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {ordered.map((s) => (
                    <Badge key={s.value} variant="neutral">
                      {s.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-small text-muted-foreground">None recorded.</p>
              )}
            </div>
            {EVALUATED.some((e) => patient.servicesOrdered.includes(e.service)) && (
              <div className="grid gap-2">
                <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Goals</p>
                <ul className="grid gap-2">
                  {EVALUATED.filter((e) => patient.servicesOrdered.includes(e.service)).map((e) => {
                    const evaluation = team.evaluations.get(e.care);
                    return (
                      <li key={e.care} className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-muted px-3 py-2.5">
                        <span className="font-semibold">{CARE_LABEL[e.care]}</span>
                        {evaluation ? (
                          <span className="text-small text-muted-foreground">
                            {evaluation.goals} {evaluation.goals === 1 ? "goal" : "goals"} set{" "}
                            {DATE.format(evaluation.signedAt)} by {evaluation.author}
                          </span>
                        ) : (
                          <Badge variant="warning">Needs an evaluation</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {patient.servicesOrdered.includes("HHA") && (
              <div className="grid gap-2">
                <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Aide service plan</p>
                <p className="flex flex-wrap items-center gap-2 text-small">
                  {team.plan?.status === "signed" ? (
                    <>
                      <Badge variant="success">Signed</Badge> {DATE.format(team.plan.at)} by {team.plan.author}
                    </>
                  ) : team.plan?.status === "draft" ? (
                    <>
                      <Badge variant="neutral">Draft</Badge> Started by {team.plan.author}. Aide visits stay locked until
                      it&apos;s signed.
                    </>
                  ) : (
                    <>
                      <Badge variant="warning">Needs plan</Badge> A nurse (or PT/OT) writes it before any aide visit.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Your visits" className="md:col-span-2">
          {visits.length ? (
            <ul className="-mx-2 grid">
              {visits.map((v) => {
                // Spec v2: an aide visit with no signed aide service plan shows Needs plan.
                const aideLocked =
                  (v.status === "needs-note" || v.status === "draft") &&
                  careFromTypeOfCare(v.typeOfCare) === "hha" &&
                  team.plan?.status !== "signed";
                const badge = STATUS_BADGE[aideLocked ? "needs-plan" : v.status];
                return (
                  <li key={v.id}>
                    <Link
                      href={`/appointments/${v.id}`}
                      className="group flex items-center gap-3 rounded-sm px-2 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          <RelativeDay iso={v.startsAt.toISOString()} withTime />
                        </span>
                        <span className="block truncate text-small text-muted-foreground">{v.typeOfCare}</span>
                      </span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={CalendarX2} title="No visits yet">
              Book a visit from Appointments. Only your own visits show here.
            </EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`grid gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6 ${className ?? ""}`}>
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
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
