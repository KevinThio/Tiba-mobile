import { and, eq } from "drizzle-orm";
import { PenLine } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { appointments, diagnosisCodes, notes, patients } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { goalsFromEvaluation, hasSignedPlan } from "@/lib/note-context";
import { summarise } from "@/lib/note-summary";
import { CARE_LABEL, getTemplate, isDiscipline, KIND_LABEL, missingFields, type Care, type NoteKind } from "@/lib/note-templates";
import { SignForm } from "./sign-form";

/**
 * Sign note (spec v2 section 4 and the prototype): a summary of the answers, the clinician's
 * signature pad and the patient's (always offered, never required), then "Sign and save".
 */
export default async function SignNotePage({ params }: PageProps<"/appointments/[id]/sign">) {
  const clinician = await requireClinician();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [visit] = await db
    .select({
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      patientId: patients.id,
      patientName: patients.fullName,
      noteId: notes.id,
      kind: notes.kind,
      care: notes.care,
      fields: notes.fields,
      updatedAt: notes.updatedAt,
      signedAt: notes.signedAt,
      dxCode: notes.dxCode,
      dxDescription: diagnosisCodes.description,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .leftJoin(diagnosisCodes, eq(diagnosisCodes.code, notes.dxCode))
    .where(and(eq(appointments.id, id), eq(appointments.clinicianId, clinician.id)));
  if (!visit) notFound();
  if (visit.signedAt) redirect(`/appointments/${id}`);

  const first = visit.patientName.split(" ")[0];
  const back = { href: `/appointments/${id}`, label: "Note" };
  const care = visit.care as Care | null;
  const kind = visit.kind as NoteKind | null;
  const evaluation = care ? await goalsFromEvaluation(visit.patientId, care, clinician.practiceId) : null;
  const goals = evaluation?.goals ?? [];
  const template = care && kind ? getTemplate(kind, care) : null;
  const blocked =
    !visit.noteId || !template || !visit.updatedAt
      ? "Start the note first. Fill in the sections, then come back to sign."
      : care === "hha" && !(await hasSignedPlan(visit.patientId, clinician.practiceId))
        ? "Aide visit notes stay locked until the aide service plan is signed."
        : missingFields(template, visit.fields ?? {}, goals.length).length
          ? "Some sections still need an answer. Finish them, then come back to sign."
          : null;

  if (blocked || !template || !visit.updatedAt) {
    return (
      <div className="grid grid-cols-1 gap-8">
        <PageHeader back={back} overline="Sign note" title={`Sign ${first}'s note`} />
        <EmptyState
          icon={PenLine}
          title="Not ready to sign yet"
          action={
            <Button variant="outline" nativeButton={false} render={<Link href={`/appointments/${id}`} />}>
              Back to the note
            </Button>
          }
        >
          {blocked}
        </EmptyState>
      </div>
    );
  }

  const end = visit.timeOut ?? new Date(visit.startsAt.getTime() + visit.durationMinutes * 60_000);
  const kindLabel = isDiscipline(template.care) && template.kind !== "progress" ? `${KIND_LABEL[template.kind]} · ` : "";
  return (
    <SignForm
      appointmentId={id}
      draftSavedAt={visit.updatedAt.toISOString()}
      patientName={visit.patientName}
      clinicianName={clinician.name}
      from={(visit.timeIn ?? visit.startsAt).toISOString()}
      to={end.toISOString()}
      careLine={`${kindLabel}${CARE_LABEL[template.care]}${visit.dxCode ? ` · ${visit.dxCode} ${visit.dxDescription ?? ""}`.trimEnd() : ""}`}
      summary={summarise(template, visit.fields ?? {}, goals)}
    />
  );
}
