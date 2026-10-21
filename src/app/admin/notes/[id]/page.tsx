import { and, asc, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LocalTime } from "@/app/(app)/appointments/[id]/local-time";
import { SignatureTile } from "@/app/(app)/appointments/[id]/signed-note";
import { NoteLetterhead } from "@/components/note-letterhead";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { appointments, clinicians, diagnosisCodes, noteAddenda, noteBillings, notes, patients, practices } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/countries";
import { CARE_LABEL, noteTitle, type Care } from "@/lib/note-templates";
import { practiceLogoUrl } from "@/lib/practice-logo";
import { MarkBilledButton } from "../mark-billed-button";

const DAY = 86_400_000;
/** Whole days since an instant (server time; the page is rendered per request). */
const daysSince = (at: Date) => Math.floor((Date.now() - at.getTime()) / DAY);

/**
 * Signed note, admin view (spec v2 and the prototype): the visit, whether it's billed to
 * insurance (days since signing, amount, insurer), the note as signed, Download PDF and Mark as
 * billed. Admins read notes; they never write or change them.
 */
export default async function AdminSignedNotePage({ params }: PageProps<"/admin/notes/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const billedBy = alias(clinicians, "billed_by");
  const [row] = await db
    .select({
      noteId: notes.id,
      kind: notes.kind,
      care: notes.care,
      body: notes.body,
      version: notes.version,
      amendmentReason: notes.amendmentReason,
      signedAt: notes.signedAt,
      clinicianSignature: notes.clinicianSignature,
      patientSignature: notes.patientSignature,
      dxCode: notes.dxCode,
      dxDescription: diagnosisCodes.description,
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      typeOfCare: appointments.typeOfCare,
      feeMinor: appointments.feeMinor,
      currency: appointments.currency,
      patientName: patients.fullName,
      insurer: patients.insurer,
      clinicianName: clinicians.name,
      practiceName: practices.name,
      country: practices.country,
      hasLogo: isNotNull(practices.logo),
      practiceUpdatedAt: practices.updatedAt,
      billedAt: noteBillings.billedAt,
      billedByName: billedBy.name,
    })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(practices, eq(practices.id, clinicians.practiceId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(diagnosisCodes, eq(diagnosisCodes.code, notes.dxCode))
    .leftJoin(noteBillings, eq(noteBillings.noteId, notes.id))
    .leftJoin(billedBy, eq(billedBy.id, noteBillings.billedById))
    .where(and(eq(appointments.id, id), eq(clinicians.practiceId, admin.practiceId), isNotNull(notes.signedAt)));
  if (!row || !row.signedAt || !row.clinicianSignature) notFound();

  const addenda = await db
    .select({ id: noteAddenda.id, body: noteAddenda.body, createdAt: noteAddenda.createdAt })
    .from(noteAddenda)
    .where(eq(noteAddenda.noteId, row.noteId))
    .orderBy(asc(noteAddenda.createdAt));

  const care = row.care as Care;
  const from = row.timeIn ?? row.startsAt;
  const to = row.timeOut ?? new Date(row.startsAt.getTime() + row.durationMinutes * 60_000);
  const days = daysSince(row.signedAt);
  const amount = formatMoney(row.feeMinor, row.country, row.currency);

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/admin/notes", label: "Completed notes" }}
        overline={
          <>
            Signed note · <LocalTime iso={from.toISOString()} format="visit" to={to.toISOString()} />
          </>
        }
        title={row.patientName}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<a href={`/api/notes/${id}/pdf`} target="_blank" rel="noopener" />}>
              <Download aria-hidden /> Download PDF
            </Button>
            {!row.billedAt && <MarkBilledButton appointmentIds={[id]} />}
          </div>
        }
      />

      <section className="grid w-full max-w-3xl gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-h3">Visit</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Detail label="Patient">{row.patientName}</Detail>
          <Detail label="Clinician">{row.clinicianName}</Detail>
          <Detail label="Type of care">{row.typeOfCare}</Detail>
          <Detail label="Date">
            <LocalTime iso={from.toISOString()} format="visit" to={to.toISOString()} />
          </Detail>
          <Detail label="Insurer">{row.insurer ?? "Not added"}</Detail>
          <Detail label="Fee">{amount}</Detail>
        </dl>
        <p className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
          {row.billedAt ? (
            <>
              <Badge variant="success">Billed</Badge>
              <span className="text-small">
                <LocalTime iso={row.billedAt.toISOString()} format="signed" />
                {row.billedByName && ` by ${row.billedByName}`}
              </span>
            </>
          ) : (
            <>
              <Badge variant={days > 30 ? "danger" : "neutral"}>Not billed yet</Badge>
              <span className="text-small">
                {days === 0 ? "Signed today" : days === 1 ? "1 day since signing" : `${days} days since signing`} · {amount}
                {row.insurer && ` to ${row.insurer}`}
              </span>
            </>
          )}
        </p>
      </section>

      <article className="grid w-full max-w-3xl gap-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-10">
        <NoteLetterhead
          practiceName={row.practiceName}
          clinicianName={row.clinicianName}
          logoUrl={row.hasLogo ? practiceLogoUrl(row.practiceUpdatedAt) : null}
        />
        <div className="grid gap-1">
          <h2 className="text-h2">{noteTitle(row.kind, care)}</h2>
          <p className="text-small text-muted-foreground">
            {CARE_LABEL[care]}
            {row.dxCode && ` · ${row.dxCode} ${row.dxDescription ?? ""}`}
          </p>
          <p className="text-small text-muted-foreground">
            Signed by {row.clinicianName} at <LocalTime iso={row.signedAt.toISOString()} format="signed" />
            {row.version > 1 && row.amendmentReason && ` · Amended (version ${row.version}): ${row.amendmentReason}`}
          </p>
        </div>
        <div className="grid gap-4 text-body-lg">
          {row.body
            .split(/\n{2,}/)
            .filter((p) => p.trim())
            .map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SignatureTile label="Clinician" name={row.clinicianName} image={row.clinicianSignature} signedAt={row.signedAt.toISOString()} />
          <SignatureTile label="Patient" name={row.patientName} image={row.patientSignature} signedAt={row.signedAt.toISOString()} />
        </div>
        {addenda.length > 0 && (
          <div className="grid gap-3 border-t border-border-subtle pt-5">
            <h3 className="text-h3">Addenda</h3>
            {addenda.map((a) => (
              <div key={a.id} className="grid gap-1 rounded-md border-l-4 border-l-primary bg-muted px-4 py-3">
                <p className="text-caption text-muted-foreground">
                  Added <LocalTime iso={a.createdAt.toISOString()} format="signed" /> by {row.clinicianName}
                </p>
                <p className="break-words whitespace-pre-line">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </article>
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
