import { ChevronRight, Landmark, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { completedNotes, OVERDUE_DAYS } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { lastBillingReminder } from "@/lib/billing-reminders";
import { formatMoney } from "@/lib/countries";
import { practiceBilling } from "@/lib/practice";
import { cn } from "@/lib/utils";
import { MarkBilledButton } from "../notes/mark-billed-button";
import { SendReminderButton } from "./send-reminder-button";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const DAY = 86_400_000;
/** Whole days since an instant (server time; the page is rendered per request). */
const daysSince = (at: Date) => Math.floor((Date.now() - at.getTime()) / DAY);

/**
 * Insurance billing (spec v2 section 5 and the prototype): signed notes waiting to be billed to
 * insurance and those already billed, each oldest first. Waiting more than 30 days is red.
 */
export default async function InsuranceBillingPage() {
  const admin = await requireAdmin();
  const [rows, billing, lastReminder] = await Promise.all([
    completedNotes(admin.practiceId),
    practiceBilling(admin.practiceId),
    lastBillingReminder(admin.practiceId),
  ]);
  const oldestFirst = [...rows].reverse();
  const waiting = oldestFirst.filter((r) => !r.billedAt).map((r) => ({ ...r, days: daysSince(r.signedAt!) }));
  const billed = oldestFirst.filter((r) => r.billedAt);
  const late = waiting.filter((r) => r.days > OVERDUE_DAYS).length;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        overline="Notes billed to insurance"
        title="Insurance billing"
        description={
          lastReminder
            ? `Send reminder emails you the notes waiting to be billed. Last sent ${DATE.format(lastReminder.at)} to ${lastReminder.to}.`
            : "Send reminder emails you the notes waiting to be billed, oldest first."
        }
        actions={<SendReminderButton disabled={waiting.length === 0} />}
      />

      {late > 0 && (
        <div role="status" className="flex gap-3 rounded-md bg-danger px-4 py-3.5 text-danger-foreground">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="font-semibold">
            {late === 1 ? "1 note has" : `${late} notes have`} waited more than {OVERDUE_DAYS} days to be billed to insurance.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Landmark} title="Nothing to bill yet">
          Signed notes from your clinicians show here until you bill them to insurance.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="waiting-heading" className="grid gap-3">
            <div>
              <h2 id="waiting-heading" className="text-h3">
                Waiting to bill ({waiting.length})
              </h2>
              <p className="text-small text-muted-foreground">Oldest first. Red means more than {OVERDUE_DAYS} days.</p>
            </div>
            {waiting.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-card px-5 py-6 text-center text-muted-foreground">
                Every signed note is billed.
              </p>
            ) : (
              <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
                {waiting.map((r) => {
                  const late = r.days > OVERDUE_DAYS;
                  return (
                    <li
                      key={r.appointmentId}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3.5 last:border-b-0 sm:px-5",
                        late && "bg-danger/40",
                      )}
                    >
                      <Link
                        href={`/admin/notes/${r.appointmentId}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{r.patientName}</span>
                          <span className="block truncate text-small text-muted-foreground">
                            {DATE.format(r.startsAt)} · {r.clinicianName} · {r.typeOfCare} ·{" "}
                            {formatMoney(r.feeMinor, billing.country, r.currency)}
                            {r.insurer && ` · ${r.insurer}`}
                          </span>
                        </span>
                        <Badge variant={late ? "danger" : "neutral"}>{r.days === 0 ? "Today" : r.days === 1 ? "1 day" : `${r.days} days`}</Badge>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                      <MarkBilledButton appointmentIds={[r.appointmentId]} size="sm" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="billed-heading" className="grid gap-3">
            <div>
              <h2 id="billed-heading" className="text-h3">
                Billed ({billed.length})
              </h2>
              <p className="text-small text-muted-foreground">Oldest first.</p>
            </div>
            {billed.length > 0 && (
              <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
                {billed.map((r) => (
                  <li key={r.appointmentId} className="border-b border-border-subtle last:border-b-0">
                    <Link
                      href={`/admin/notes/${r.appointmentId}`}
                      className="flex items-center gap-3 px-4 py-3.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring sm:px-5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.patientName}</span>
                        <span className="block truncate text-small text-muted-foreground">
                          {DATE.format(r.startsAt)} · {r.clinicianName} · {r.typeOfCare} ·{" "}
                          {formatMoney(r.feeMinor, billing.country, r.currency)} · Billed {DATE.format(r.billedAt!)}
                        </span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
