import { ChevronRight, CircleCheck, PenLine } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { initialsOf } from "@/components/practice-mark";
import { EditedAt, RelativeDay } from "@/components/relative-day";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireClinician } from "@/lib/auth";
import { draftNotes, visitsNeedingNotes } from "@/lib/notes";

/**
 * Notes to do (spec v2 section 4 and the prototype): finished visits with no note yet, then
 * drafts that were started but not signed. Both open the visit to write or finish the note.
 */
export default async function NotesPage() {
  const clinician = await requireClinician();
  const [needNote, drafts] = await Promise.all([visitsNeedingNotes(clinician.id), draftNotes(clinician.id)]);
  const total = needNote.length + drafts.length;

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        overline="To do"
        title={total === 0 ? "All caught up" : `${total} ${total === 1 ? "note" : "notes"} to finish`}
      />

      {total === 0 ? (
        <EmptyState icon={CircleCheck} title="No notes waiting">
          Every finished visit has a signed note. When a visit ends without one, it shows here.
        </EmptyState>
      ) : (
        <>
          {needNote.length > 0 && (
            <Section id="need-note" title={`Needs a note (${needNote.length})`} help="Finished visits with no note yet.">
              {needNote.map((v) => (
                <li key={v.appointmentId} className="flex items-center gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:px-5">
                  <Initials name={v.patientName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.patientName}</p>
                    <p className="line-clamp-2 text-small text-muted-foreground sm:line-clamp-1">
                      <RelativeDay iso={v.startsAt.toISOString()} withTime /> · {v.typeOfCare}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    nativeButton={false}
                    render={<Link href={`/appointments/${v.appointmentId}`} />}
                    aria-label={`Write note for ${v.patientName}`}
                  >
                    <PenLine aria-hidden />
                    Write note
                  </Button>
                </li>
              ))}
            </Section>
          )}

          {drafts.length > 0 && (
            <Section id="drafts" title={`Drafts (${drafts.length})`} help="Started but not signed. Saved as you type.">
              {drafts.map((d) => (
                <li key={d.appointmentId} className="border-b border-border-subtle last:border-b-0">
                  <Link
                    href={`/appointments/${d.appointmentId}`}
                    className="group flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
                  >
                    <Initials name={d.patientName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{d.patientName}</span>
                      <span className="line-clamp-2 block text-small text-muted-foreground sm:line-clamp-1">
                        <RelativeDay iso={d.startsAt.toISOString()} /> · {d.typeOfCare} · <EditedAt iso={d.editedAt.toISOString()} />
                      </span>
                    </span>
                    {/* Becomes "3 of 6" or "Ready to sign" once notes have sections. */}
                    <Badge variant="neutral">Draft</Badge>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ id, title, help, children }: { id: string; title: string; help: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="grid gap-3">
      <div>
        <h2 id={`${id}-heading`} className="text-h3">
          {title}
        </h2>
        <p className="text-small text-muted-foreground">{help}</p>
      </div>
      <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">{children}</ul>
    </section>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}
