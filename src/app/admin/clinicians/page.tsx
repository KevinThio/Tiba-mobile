import { and, asc, eq } from "drizzle-orm";
import { Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { initialsOf } from "@/components/practice-mark";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ClinicianStatusActions } from "./clinician-status-actions";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const STATUS_BADGE = {
  active: { label: "Active", variant: "success" },
  deactivated: { label: "Deactivated", variant: "neutral" },
  pending: { label: "Waiting for you", variant: "warning" },
} as const;

/**
 * Every clinician in the practice. Clinicians who signed up with this practice's name
 * wait at the top until the admin verifies (activates) them.
 */
export default async function AdminCliniciansPage() {
  const admin = await requireAdmin();
  const rows = await db
    .select({
      id: clinicians.id,
      name: clinicians.name,
      email: clinicians.email,
      status: clinicians.status,
      createdAt: clinicians.createdAt,
    })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician")))
    .orderBy(asc(clinicians.name));

  const waiting = rows.filter((r) => r.status === "pending");
  const team = rows.filter((r) => r.status !== "pending");
  const active = team.filter((r) => r.status === "active").length;

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline={`${active} active · ${team.length - active} deactivated`} title="Clinicians" />

      {waiting.length > 0 && (
        <section aria-labelledby="waiting-heading" className="grid gap-3">
          <div>
            <h2 id="waiting-heading" className="text-h3">
              Waiting for you to verify ({waiting.length})
            </h2>
            <p className="text-small text-muted-foreground">
              They signed up with your practice name. Activate the people you know; until then they can&apos;t see any
              patients.
            </p>
          </div>
          <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
            {waiting.map((c) => (
              <ClinicianRow key={c.id} clinician={c} meta={`${c.email} · asked to join ${dateFormat.format(c.createdAt)}`} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="team-heading" className="grid gap-3">
        <h2 id="team-heading" className="text-h3">
          Your clinicians
        </h2>
        {team.length === 0 ? (
          <EmptyState icon={Stethoscope} title="No clinicians yet">
            Ask your clinicians to create an account with the practice name &ldquo;{admin.practiceName}&rdquo;. They&apos;ll
            show up here for you to verify.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
            {team.map((c) => (
              <ClinicianRow key={c.id} clinician={c} meta={`${c.email} · joined ${dateFormat.format(c.createdAt)}`} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClinicianRow({
  clinician,
  meta,
}: {
  clinician: { id: string; name: string; status: "pending" | "active" | "deactivated" };
  meta: string;
}) {
  const badge = STATUS_BADGE[clinician.status];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:px-5">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
        aria-hidden
      >
        {initialsOf(clinician.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{clinician.name}</p>
        <p className="truncate text-small text-muted-foreground">{meta}</p>
      </div>
      <Badge variant={badge.variant}>{badge.label}</Badge>
      <ClinicianStatusActions clinicianId={clinician.id} name={clinician.name} status={clinician.status} />
    </li>
  );
}
