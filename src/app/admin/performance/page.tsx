import { eq } from "drizzle-orm";
import { CalendarX2, ChartColumn, CircleCheck, Clock, ReceiptText, Star, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/countries";
import { disciplineLabel, isDiscipline } from "@/lib/disciplines";
import { isPerformancePeriod, PERFORMANCE_PERIODS, periodRange, practicePerformance, type PerformancePeriod } from "@/lib/performance";
import { isValidTimeZone } from "@/lib/reminders";
import { cn } from "@/lib/utils";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Practice performance (spec v2 section 5b): admissions, invoices sent and their status, missed
 * visits and patient reviews for the chosen period, overall and by clinician.
 */
export default async function PerformancePage({ searchParams }: PageProps<"/admin/performance">) {
  const admin = await requireAdmin();
  const { period: raw } = await searchParams;
  const period: PerformancePeriod = isPerformancePeriod(raw) ? raw : "30d";

  const [me] = await db.select({ timeZone: clinicians.timeZone }).from(clinicians).where(eq(clinicians.id, admin.id));
  const timeZone = me?.timeZone && isValidTimeZone(me.timeZone) ? me.timeZone : "UTC";
  const range = periodRange(period, timeZone);
  const p = await practicePerformance(admin.practiceId, range);

  const money = (totals: { currency: string; minor: number }[]) =>
    totals.length ? totals.map((t) => formatMoney(t.minor, admin.country, t.currency)).join(" + ") : formatMoney(0, admin.country);
  const maxMissed = Math.max(1, ...p.clinicians.map((c) => c.missed));
  const split = [
    { key: "paid", label: "Paid", count: p.invoices.paid.count, bar: "bg-primary" },
    { key: "unpaid", label: "Unpaid", count: p.invoices.unpaid.count, bar: "bg-chart-2" },
    { key: "issue", label: "Issues", count: p.invoices.issue.count, bar: "bg-destructive" },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader overline="Practice performance" title="Performance" />

      <nav aria-label="Period" className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {PERFORMANCE_PERIODS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "30d" ? "/admin/performance" : `/admin/performance?period=${x.key}`}
            aria-current={x.key === period ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border-[1.5px] px-4 text-small font-semibold transition-colors duration-120 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring",
              x.key === period ? "border-primary bg-secondary text-primary" : "border-input bg-card hover:bg-muted",
            )}
          >
            {x.label}
          </Link>
        ))}
      </nav>
      <p className="-mt-5 text-small text-muted-foreground">
        {DAY.format(new Date(range.startDate))} to {DAY.format(new Date(range.endDate))}
      </p>

      <section aria-label="Totals" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={UserPlus} label="Patients admitted" value={p.admitted.length}>
          {p.admitted.length ? (
            <ul className="grid gap-0.5">
              {p.admitted.slice(0, 6).map((a) => (
                <li key={a.id} className="truncate">
                  <Link href={`/admin/patients/${a.id}`} className="underline-offset-2 hover:underline">
                    {a.fullName}
                  </Link>
                </li>
              ))}
              {p.admitted.length > 6 && <li>and {p.admitted.length - 6} more</li>}
            </ul>
          ) : (
            "No new patients."
          )}
        </Stat>
        <Stat icon={ReceiptText} label="Invoices sent" value={p.invoices.count}>
          {money(p.invoices.totals)} in total
        </Stat>
        <Stat icon={CircleCheck} label="Paid" value={p.invoices.paid.count}>
          {money(p.invoices.paid.totals)} received
        </Stat>
        <Stat icon={Clock} label="Unpaid" value={p.invoices.unpaid.count}>
          {money(p.invoices.unpaid.totals)} waiting
          {p.invoices.issue.count > 0 && ` · ${plural(p.invoices.issue.count, "issue")} (${money(p.invoices.issue.totals)})`}
        </Stat>
        <Stat icon={CalendarX2} label="Missed visits" value={p.missed.count} alert={p.missed.count > 0}>
          {p.missed.count ? `Across ${plural(p.missed.clinicians, "clinician")}` : "None in this period."}
        </Stat>
        <Stat icon={Star} label="Patient reviews" value={p.reviews.rows.length}>
          {p.reviews.average === null ? "No reviews in this period." : `Average ${p.reviews.average.toFixed(1)} of 5`}
        </Stat>
      </section>

      <section aria-labelledby="split-heading" className="grid gap-3 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
        <h2 id="split-heading" className="text-h3">
          Invoices sent in this period
        </h2>
        {p.invoices.count ? (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-sunken" aria-hidden>
              {split.map((s) => s.count > 0 && <span key={s.key} className={s.bar} style={{ width: `${(s.count / p.invoices.count) * 100}%` }} />)}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-small">
              {split.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", s.bar)} aria-hidden />
                  {s.label} {s.count}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">No invoices were sent in this period.</p>
        )}
      </section>

      <section aria-labelledby="clinicians-heading" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="clinicians-heading" className="text-h2">
            By clinician
          </h2>
          <p className="text-muted-foreground">Missed visits, invoices and patient reviews in this period.</p>
        </div>
        {p.clinicians.length ? (
          <ul className="grid grid-cols-1 rounded-lg border border-border-subtle bg-card shadow-sm">
            {p.clinicians.map((c) => (
              <li key={c.id} className="grid gap-3 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:px-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)] md:items-center">
                <div className="min-w-0">
                  <Link href={`/admin/clinicians/${c.id}`} className="font-semibold underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-small text-muted-foreground">
                    {isDiscipline(c.discipline) ? disciplineLabel(c.discipline) : "Clinician"}
                    {!c.active && " · not active"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className={cn("text-small", c.missed >= 2 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {plural(c.missed, "missed visit")}
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                    <span
                      className={cn("block h-full rounded-full", c.missed >= 2 ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${(c.missed / maxMissed) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-small">
                  <span className="text-muted-foreground md:sr-only">Invoices </span>
                  {c.invoices.count} · {money(c.invoices.totals)}
                </p>
                <p className="flex items-center gap-1 text-small">
                  <Star className="size-4 fill-primary text-primary" aria-hidden />
                  {c.reviews.average === null ? (
                    <span className="text-muted-foreground">No reviews</span>
                  ) : (
                    <span>
                      {c.reviews.average.toFixed(1)} ({c.reviews.count})
                      <span className="sr-only"> {c.reviews.count === 1 ? "review" : "reviews"}</span>
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ChartColumn} title="No clinicians yet">
            Clinicians show here once they join your practice and you activate them.
          </EmptyState>
        )}
      </section>

      <section aria-labelledby="reviews-heading" className="grid gap-3">
        <h2 id="reviews-heading" className="text-h2">
          Reviews in this period
        </h2>
        {p.reviews.rows.length ? (
          <ul className="grid grid-cols-1 gap-3">
            {p.reviews.rows.map((r) => (
              <li key={r.id} className="grid gap-2 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-0.5" role="img" aria-label={`${r.rating} of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={cn("size-4", n <= r.rating ? "fill-primary text-primary" : "text-border-strong")} aria-hidden />
                    ))}
                  </span>
                  <span className="text-caption text-muted-foreground">{DAY.format(r.createdAt)}</span>
                </div>
                <p className="whitespace-pre-line">{r.text}</p>
                <p className="text-small text-muted-foreground">
                  {r.name || "Anonymous"} · {r.clinicianName ? `Saw ${r.clinicianName}` : "No clinician named"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-border-subtle bg-card px-5 py-4 text-muted-foreground shadow-sm">
            No patient reviews in this period.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  alert = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-2 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <p className="flex items-center gap-2 text-small font-semibold text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      {/* Not cn(): tailwind-merge takes text-h1 for a colour and drops it. */}
      <p className={`font-heading text-h1 ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
      <div className="text-small text-muted-foreground">{children}</div>
    </div>
  );
}
