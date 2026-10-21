import { ChevronDown, FileText, Lock, ReceiptText } from "lucide-react";
import Link from "next/link";
import { NoteLetterhead } from "@/components/note-letterhead";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SummaryGroup } from "@/lib/note-summary";
import { LocalTime } from "./local-time";

type Props = {
  appointmentId: string;
  patientName: string;
  clinicianName: string;
  practiceName: string;
  logoUrl: string | null;
  /** Visit start and end (time in and out when recorded, otherwise as booked). */
  from: string;
  to: string;
  timesRecorded: boolean;
  title: string;
  careLabel: string;
  dx: string | null;
  body: string;
  summary: SummaryGroup[];
  signedAt: string;
  clinicianSignature: string;
  patientSignature: string | null;
  invoiced: boolean;
};

/**
 * Signed note (spec v2 section 4 and the prototype): locked, with the note Tiba wrote from the
 * sections, the original answers and both signature tiles. The patient's tile says so when they
 * didn't sign.
 */
export function SignedNote(p: Props) {
  const first = p.patientName.split(" ")[0];
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/appointments", label: "Appointments" }}
        overline={
          <>
            Signed note · <LocalTime iso={p.from} to={p.to} format="visit" />
          </>
        }
        title={p.patientName}
        actions={
          !p.invoiced && (
            <Button variant="outline" nativeButton={false} render={<Link href="/invoices" />}>
              <ReceiptText aria-hidden /> Create invoice
            </Button>
          )
        }
      />

      <div className="grid gap-1.5 rounded-md bg-secondary px-4 py-3.5">
        <p className="flex items-center gap-2.5 font-semibold text-primary">
          <Lock className="size-4.5 shrink-0" aria-hidden />
          <span>
            Signed at <LocalTime iso={p.signedAt} format="time" /> by you{p.patientSignature ? ` and ${first}` : ""}
          </span>
        </p>
        <p className="text-small text-muted-foreground">Signed notes are locked. Add an addendum if something changes.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{p.careLabel}</Badge>
        {p.dx && <Badge variant="info">{p.dx}</Badge>}
        {p.invoiced && <Badge variant="success">Invoiced</Badge>}
      </div>

      <article className="grid w-full max-w-3xl gap-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-10">
        <NoteLetterhead practiceName={p.practiceName} clinicianName={p.clinicianName} logoUrl={p.logoUrl} />
        <div className="grid gap-1">
          <h2 className="text-h2">{p.title}</h2>
          <p className="flex items-center gap-1.5 text-small text-muted-foreground">
            <FileText className="size-4" aria-hidden /> Written up from your sections
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-4 rounded-md bg-muted p-4 sm:grid-cols-3">
          <Detail label="Patient">{p.patientName}</Detail>
          <Detail label={p.timesRecorded ? "Time in and out" : "Booked for"}>
            <LocalTime iso={p.from} to={p.to} format="visit" />
          </Detail>
          <Detail label="Clinician">{p.clinicianName}</Detail>
        </dl>
        <div className="grid gap-4 text-body-lg">
          {p.body
            .split(/\n{2,}/)
            .filter((para) => para.trim())
            .map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SignatureTile label="Clinician" name={p.clinicianName} image={p.clinicianSignature} signedAt={p.signedAt} />
          <SignatureTile label="Patient" name={p.patientName} image={p.patientSignature} signedAt={p.signedAt} />
        </div>
      </article>

      <details className="group w-full max-w-3xl rounded-lg border border-border-subtle bg-card shadow-xs">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Section answers
          <ChevronDown className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-5 border-t border-border-subtle px-5 py-5">
          {p.summary.map((g) => (
            <div key={g.key || "all"} className="grid gap-3">
              {g.name && <h3 className="text-overline font-sans font-semibold text-muted-foreground uppercase">{g.name}</h3>}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
                {g.answers.map((a) => (
                  <div key={a.id} className="grid min-w-0 content-start gap-0.5">
                    <dt className="text-caption font-semibold text-primary">{a.label}</dt>
                    <dd className="break-words whitespace-pre-line">{a.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function SignatureTile({ label, name, image, signedAt }: { label: string; name: string; image: string | null; signedAt: string }) {
  return (
    <figure className="grid gap-2 rounded-md border border-border-subtle p-4">
      <figcaption className="text-overline font-semibold text-muted-foreground uppercase">{label}</figcaption>
      <div className="flex h-24 items-center justify-center border-b border-border">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- a stored data URL, not optimisable
          <img src={image} alt={`${name}'s signature`} className="max-h-full w-auto max-w-full object-contain" />
        ) : (
          <span className="text-small text-subtle-foreground">Didn&apos;t sign</span>
        )}
      </div>
      <p className="flex flex-wrap justify-between gap-x-3 text-small">
        <span className="font-semibold">{name}</span>
        {image && (
          <span className="text-muted-foreground">
            <LocalTime iso={signedAt} format="signed" />
          </span>
        )}
      </p>
    </figure>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}
