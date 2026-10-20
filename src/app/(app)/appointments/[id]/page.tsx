import { and, eq, isNotNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LocalDateTime } from "@/components/local-date-time";
import { NoteLetterhead } from "@/components/note-letterhead";
import { db } from "@/db";
import { appointments, clinicians, notes, patients } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { ageFrom } from "@/lib/format";
import { practiceLogoUrl } from "@/lib/practice-logo";
import { VisitTimes } from "./visit-times";

// Visit note (screen 2 in the spec). For now: the letterhead and visit details as they'll
// appear on the finished note. Writing and signing come next.
export default async function VisitNotePage({ params }: PageProps<"/appointments/[id]">) {
  const clinician = await requireClinician();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [visit] = await db
    .select({
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      typeOfCare: appointments.typeOfCare,
      patientName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      hasLogo: isNotNull(clinicians.practiceLogo),
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      signed: isNotNull(notes.signedAt),
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(and(eq(appointments.id, id), eq(appointments.clinicianId, clinician.id)));
  if (!visit) notFound();
  const signed = Boolean(visit.signed);

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/appointments" className="flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Appointments
      </Link>

      <article className="mx-auto grid w-full max-w-3xl gap-6 rounded-lg border bg-card p-5 shadow-xs sm:p-10">
        <NoteLetterhead
          practiceName={clinician.practiceName}
          clinicianName={clinician.name}
          logoUrl={visit.hasLogo ? practiceLogoUrl(clinician.updatedAt) : null}
        />

        <div className="grid gap-1">
          <h1 className="text-3xl">Visit note</h1>
          <p className="text-muted-foreground">{visit.typeOfCare}</p>
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
          {/* On the signed note, the recorded times print with the other details. */}
          {signed && (
            <>
              <Detail label="Time in">{visit.timeIn ? <LocalDateTime iso={visit.timeIn.toISOString()} options={TIME} /> : "Not recorded"}</Detail>
              <Detail label="Time out">{visit.timeOut ? <LocalDateTime iso={visit.timeOut.toISOString()} options={TIME} /> : "Not recorded"}</Detail>
            </>
          )}
        </dl>

        {!signed && (
          <VisitTimes
            appointmentId={id}
            startsAt={visit.startsAt.toISOString()}
            initial={{ timeIn: visit.timeIn?.toISOString() ?? null, timeOut: visit.timeOut?.toISOString() ?? null }}
            locked={false}
          />
        )}

        <div className="rounded-lg border border-dashed px-5 py-12 text-center text-muted-foreground">
          Writing and signing the note is coming soon.
        </div>

        <div className="grid gap-6 pt-2 sm:grid-cols-2">
          <SignatureLine label={`Clinician · ${clinician.name}`} />
          <SignatureLine label={`Patient · ${visit.patientName} (optional)`} />
        </div>
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

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-16 border-b border-foreground/30" />
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
