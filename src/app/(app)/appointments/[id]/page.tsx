import { and, asc, desc, eq, exists, isNotNull } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { appointments, clinicians, diagnosisCodes, invoiceItems, noteAddenda, notes, noteVersions, patients, practices } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { summarise } from "@/lib/note-summary";
import {
  CARE_LABEL,
  KIND_LABEL,
  careFromTypeOfCare,
  getTemplate,
  noteTitle,
  kindFromTypeOfCare,
  kindsFor,
  type Care,
  type NoteKind,
} from "@/lib/note-templates";
import { clinicianSettings } from "@/lib/account";
import { canWriteCare, caresDescription, disciplineLabel, kindsForDiscipline } from "@/lib/disciplines";
import { draftPlanFor, goalsFromEvaluation, hasSignedPlan } from "@/lib/note-context";
import { practiceLogoUrl } from "@/lib/practice-logo";
import { AmendmentBanner } from "./amend";
import { MarkMissed, MissedVisit } from "./missed";
import { AideLock, NoteEditor } from "./note-editor";
import { SignedNote } from "./signed-note";
import { VisitTimes } from "./visit-times";

/**
 * Visit note (spec v2 section 4). Unsigned: the note editor. Signed: the locked note with the
 * letterhead (the full signed view, with the written-up note, comes with signing).
 */
export default async function VisitNotePage({ params }: PageProps<"/appointments/[id]">) {
  const clinician = await requireClinician();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [visit] = await db
    .select({
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      typeOfCare: appointments.typeOfCare,
      patientId: patients.id,
      patientName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      servicesOrdered: patients.servicesOrdered,
      hasLogo: isNotNull(practices.logo),
      practiceUpdatedAt: practices.updatedAt,
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      missedAt: appointments.missedAt,
      missedReason: appointments.missedReason,
      noteId: notes.id,
      noteKind: notes.kind,
      noteCare: notes.care,
      noteFields: notes.fields,
      noteUpdatedAt: notes.updatedAt,
      noteSignedAt: notes.signedAt,
      noteVersion: notes.version,
      amendmentReason: notes.amendmentReason,
      dxCode: notes.dxCode,
      dxDescription: diagnosisCodes.description,
      body: notes.body,
      clinicianSignature: notes.clinicianSignature,
      patientSignature: notes.patientSignature,
      invoiced: exists(db.select({ one: invoiceItems.appointmentId }).from(invoiceItems).where(eq(invoiceItems.appointmentId, appointments.id))),
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(practices, eq(practices.id, clinicians.practiceId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .leftJoin(diagnosisCodes, eq(diagnosisCodes.code, notes.dxCode))
    .where(and(eq(appointments.id, id), eq(appointments.clinicianId, clinician.id)));
  if (!visit) notFound();

  const care = (visit.noteCare as Care | null) ?? careFromTypeOfCare(visit.typeOfCare);

  if (visit.noteSignedAt && visit.clinicianSignature && visit.noteId) {
    const addenda = await db
      .select({ id: noteAddenda.id, body: noteAddenda.body, createdAt: noteAddenda.createdAt })
      .from(noteAddenda)
      .where(eq(noteAddenda.noteId, visit.noteId))
      .orderBy(asc(noteAddenda.createdAt));
    const versions = await db
      .select({ version: noteVersions.version, body: noteVersions.body, signedAt: noteVersions.signedAt, reason: noteVersions.amendmentReason })
      .from(noteVersions)
      .where(eq(noteVersions.noteId, visit.noteId))
      .orderBy(desc(noteVersions.version));
    const template = getTemplate((visit.noteKind as NoteKind | null) ?? "progress", care);
    const goals = (await goalsFromEvaluation(visit.patientId, care, clinician.practiceId))?.goals ?? [];
    const end = visit.timeOut ?? new Date(visit.startsAt.getTime() + visit.durationMinutes * 60_000);
    return (
      <SignedNote
        appointmentId={id}
        patientName={visit.patientName}
        clinicianName={clinician.name}
        practiceName={clinician.practiceName}
        logoUrl={visit.hasLogo ? practiceLogoUrl(visit.practiceUpdatedAt) : null}
        from={(visit.timeIn ?? visit.startsAt).toISOString()}
        to={end.toISOString()}
        timesRecorded={Boolean(visit.timeIn && visit.timeOut)}
        title={noteTitle(template.kind, care)}
        careLabel={CARE_LABEL[care]}
        dx={visit.dxCode ? `${visit.dxCode} ${visit.dxDescription ?? ""}`.trim() : null}
        body={visit.body ?? ""}
        summary={summarise(template, visit.noteFields ?? {}, goals)}
        signedAt={visit.noteSignedAt.toISOString()}
        clinicianSignature={visit.clinicianSignature}
        patientSignature={visit.patientSignature}
        invoiced={Boolean(visit.invoiced)}
        addenda={addenda.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        version={visit.noteVersion ?? 1}
        amendmentReason={visit.amendmentReason}
        earlierVersions={versions.map((v) => ({ ...v, signedAt: v.signedAt.toISOString() }))}
      />
    );
  }
  if (visit.missedAt) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <PageHeader back={{ href: "/appointments", label: "Appointments" }} overline={CARE_LABEL[care]} title={visit.patientName} />
        <MissedVisit appointmentId={id} reason={visit.missedReason ?? ""} missedAt={visit.missedAt.toISOString()} />
      </div>
    );
  }

  // Spec v2: each clinician writes the notes of their discipline (set in Settings).
  const { discipline } = await clinicianSettings(clinician.id);
  const kinds = kindsForDiscipline(discipline, kindsFor(care, visit.servicesOrdered));
  const suggested = kindFromTypeOfCare(visit.typeOfCare);
  const kind = (visit.noteKind as NoteKind | null) ?? (kinds.includes(suggested) ? suggested : "progress");
  if (discipline && (!canWriteCare(discipline, care) || !kinds.includes(kind))) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <PageHeader back={{ href: "/appointments", label: "Appointments" }} overline={CARE_LABEL[care]} title={visit.patientName} />
        <EmptyState
          icon={ShieldAlert}
          title="This note is for another discipline"
          action={
            <Button variant="outline" nativeButton={false} render={<Link href="/settings" />}>
              Check your discipline
            </Button>
          }
        >
          This visit is for {CARE_LABEL[care].toLowerCase()}
          {kind !== "progress" && ` (${KIND_LABEL[kind].toLowerCase()})`}. Your discipline is {disciplineLabel(discipline)}, so
          you write {caresDescription(discipline)}. If your discipline is wrong, change it in Settings.
        </EmptyState>
        {!visit.noteId && hasStarted(visit.startsAt) && <MarkMissed appointmentId={id} />}
      </div>
    );
  }

  const firstName = visit.patientName.split(" ")[0];
  const visitTimes = (
    <>
      <VisitTimes
        appointmentId={id}
        startsAt={visit.startsAt.toISOString()}
        durationMinutes={visit.durationMinutes}
        initial={{ timeIn: visit.timeIn?.toISOString() ?? null, timeOut: visit.timeOut?.toISOString() ?? null }}
        locked={false}
      />
      {!visit.noteId && hasStarted(visit.startsAt) && <MarkMissed appointmentId={id} />}
    </>
  );

  // An aide visit can't be documented until the patient has a signed aide service plan.
  if (care === "hha" && !(await hasSignedPlan(visit.patientId, clinician.practiceId))) {
    const draftPlan = await draftPlanFor(visit.patientId, clinician.id);
    return (
      <div className="grid grid-cols-1 gap-6">
        <PageHeader back={{ href: "/appointments", label: "Appointments" }} overline="Aide visit" title={visit.patientName} />
        <AideLock patientFirstName={firstName} planHref={draftPlan ? `/appointments/${draftPlan}` : null} />
        {!visit.noteId && hasStarted(visit.startsAt) && <MarkMissed appointmentId={id} />}
      </div>
    );
  }

  return (
    <NoteEditor
      appointmentId={id}
      patientName={visit.patientName}
      startsAt={visit.startsAt.toISOString()}
      durationMinutes={visit.durationMinutes}
      kinds={kinds}
      initial={{
        kind,
        care,
        fields: visit.noteFields ?? {},
        dx: visit.dxCode ? { code: visit.dxCode, description: visit.dxDescription ?? "" } : null,
        savedAt: visit.noteUpdatedAt?.toISOString() ?? null,
      }}
      evaluationGoals={await goalsFromEvaluation(visit.patientId, care, clinician.practiceId)}
      visitTimes={visitTimes}
      notice={
        visit.noteId && visit.amendmentReason && (visit.noteVersion ?? 1) > 1 ? (
          <AmendmentBanner
            appointmentId={id}
            version={visit.noteVersion!}
            reason={visit.amendmentReason}
            previousSignedAt={(await previousSignedAt(visit.noteId, visit.noteVersion! - 1))?.toISOString() ?? null}
          />
        ) : null
      }
    />
  );
}

/** Whether the visit was due by now (only then can it be marked missed). */
function hasStarted(startsAt: Date) {
  return startsAt.getTime() <= Date.now();
}

/** When the version being amended was signed. */
async function previousSignedAt(noteId: string, version: number) {
  const [row] = await db
    .select({ signedAt: noteVersions.signedAt })
    .from(noteVersions)
    .where(and(eq(noteVersions.noteId, noteId), eq(noteVersions.version, version)));
  return row?.signedAt ?? null;
}
