import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LocalDateTime } from "@/components/local-date-time";
import { NoteLetterhead } from "@/components/note-letterhead";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { appointments, clinicians, diagnosisCodes, notes, patients, practices } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import {
  careFromTypeOfCare,
  kindFromTypeOfCare,
  kindsFor,
  type Care,
  type Goal,
  type NoteKind,
} from "@/lib/note-templates";
import { practiceLogoUrl } from "@/lib/practice-logo";
import { AideLock, NoteEditor } from "./note-editor";
import { VisitTimes } from "./visit-times";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

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
      noteKind: notes.kind,
      noteCare: notes.care,
      noteFields: notes.fields,
      noteUpdatedAt: notes.updatedAt,
      noteSignedAt: notes.signedAt,
      dxCode: notes.dxCode,
      dxDescription: diagnosisCodes.description,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(practices, eq(practices.id, clinicians.practiceId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .leftJoin(diagnosisCodes, eq(diagnosisCodes.code, notes.dxCode))
    .where(and(eq(appointments.id, id), eq(appointments.clinicianId, clinician.id)));
  if (!visit) notFound();

  if (visit.noteSignedAt) {
    return <SignedVisit visit={visit} practiceName={clinician.practiceName} clinicianName={clinician.name} />;
  }

  const care = (visit.noteCare as Care | null) ?? careFromTypeOfCare(visit.typeOfCare);
  const kinds = kindsFor(care, visit.servicesOrdered);
  const suggested = kindFromTypeOfCare(visit.typeOfCare);
  const kind = (visit.noteKind as NoteKind | null) ?? (kinds.includes(suggested) ? suggested : "progress");

  const firstName = visit.patientName.split(" ")[0];
  const visitTimes = (
    <VisitTimes
      appointmentId={id}
      startsAt={visit.startsAt.toISOString()}
      initial={{ timeIn: visit.timeIn?.toISOString() ?? null, timeOut: visit.timeOut?.toISOString() ?? null }}
      locked={false}
    />
  );

  // An aide visit can't be documented until the patient has a signed aide service plan.
  if (care === "hha" && !(await hasSignedPlan(visit.patientId, clinician.practiceId))) {
    const draftPlan = await draftPlanFor(visit.patientId, clinician.id);
    return (
      <div className="grid grid-cols-1 gap-6">
        <PageHeader back={{ href: "/appointments", label: "Appointments" }} overline="Aide visit" title={visit.patientName} />
        <AideLock patientFirstName={firstName} planHref={draftPlan ? `/appointments/${draftPlan}` : null} />
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
    />
  );
}

/**
 * Goals from the latest signed initial evaluation for this patient and discipline, written by
 * anyone in the practice (spec v2: "Goals come only from a signed evaluation in the same practice").
 */
async function goalsFromEvaluation(patientId: string, care: Care, practiceId: string) {
  const [evaluation] = await db
    .select({ fields: notes.fields, signedAt: notes.signedAt, author: clinicians.name })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(notes.kind, "evaluation"),
        eq(notes.care, care),
        isNotNull(notes.signedAt),
        eq(clinicians.practiceId, practiceId),
      ),
    )
    .orderBy(desc(notes.signedAt))
    .limit(1);
  if (!evaluation) return null;
  const goals = (Array.isArray(evaluation.fields?.goals) ? (evaluation.fields.goals as Goal[]) : []).filter(
    (g) => g && typeof g.text === "string" && g.text.trim(),
  );
  return { goals, from: `Goals from the ${DATE.format(evaluation.signedAt!)} evaluation by ${evaluation.author}.` };
}

async function hasSignedPlan(patientId: string, practiceId: string) {
  const [plan] = await db
    .select({ id: notes.id })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(notes.kind, "service_plan"),
        isNotNull(notes.signedAt),
        eq(clinicians.practiceId, practiceId),
      ),
    )
    .limit(1);
  return Boolean(plan);
}

/** This clinician's unsigned service plan for the patient, if they've started one. */
async function draftPlanFor(patientId: string, clinicianId: string) {
  const [plan] = await db
    .select({ appointmentId: notes.appointmentId })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(appointments.clinicianId, clinicianId),
        eq(notes.kind, "service_plan"),
        isNull(notes.signedAt),
      ),
    )
    .limit(1);
  return plan?.appointmentId ?? null;
}

// --- Signed note (locked). The full signed view comes with the Sign note screen. -------------

type SignedProps = {
  visit: {
    startsAt: Date;
    durationMinutes: number;
    typeOfCare: string;
    patientName: string;
    dateOfBirth: string;
    hasLogo: unknown;
    practiceUpdatedAt: Date;
    timeIn: Date | null;
    timeOut: Date | null;
  };
  practiceName: string;
  clinicianName: string;
};

function SignedVisit({ visit, practiceName, clinicianName }: SignedProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/appointments" className="flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Appointments
      </Link>
      <article className="mx-auto grid w-full max-w-3xl gap-6 rounded-lg border bg-card p-5 shadow-xs sm:p-10">
        <NoteLetterhead
          practiceName={practiceName}
          clinicianName={clinicianName}
          logoUrl={visit.hasLogo ? practiceLogoUrl(visit.practiceUpdatedAt) : null}
        />
        <div className="grid gap-1">
          <h1 className="text-3xl">Visit note</h1>
          <p className="text-muted-foreground">{visit.typeOfCare} · Signed and locked</p>
        </div>
        <dl className="grid gap-4 rounded-lg bg-muted/60 p-4 sm:grid-cols-3">
          <Detail label="Patient">
            {visit.patientName}
            <span className="text-muted-foreground"> · {ageFrom(visit.dateOfBirth)} years</span>
          </Detail>
          <Detail label="Date">
            <LocalDateTime iso={visit.startsAt.toISOString()} options={{ weekday: "short", day: "numeric", month: "long", year: "numeric" }} />
          </Detail>
          <Detail label="Booked for">
            <LocalDateTime iso={visit.startsAt.toISOString()} options={TIME} />
            <span className="text-muted-foreground"> · {visit.durationMinutes} min</span>
          </Detail>
          <Detail label="Time in">{visit.timeIn ? <LocalDateTime iso={visit.timeIn.toISOString()} options={TIME} /> : "Not recorded"}</Detail>
          <Detail label="Time out">{visit.timeOut ? <LocalDateTime iso={visit.timeOut.toISOString()} options={TIME} /> : "Not recorded"}</Detail>
        </dl>
      </article>
    </div>
  );
}

const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}
