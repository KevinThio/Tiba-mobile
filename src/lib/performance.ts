import "server-only";
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";
import { db } from "@/db";
import { appointments, clinicians, invoices, patients, reviews } from "@/db/schema";

// Practice performance (spec v2 section 5b): admissions, invoices, missed visits and reviews in a
// period the admin picks. Everything is scoped to one practice.

export const PERFORMANCE_PERIODS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "180d", label: "Last 180 days", days: 180 },
  { key: "year", label: "This year", days: null },
] as const;

export type PerformancePeriod = (typeof PERFORMANCE_PERIODS)[number]["key"];

export const isPerformancePeriod = (v: unknown): v is PerformancePeriod => PERFORMANCE_PERIODS.some((p) => p.key === v);

/** Start of the period (inclusive) and now. Days count back from now; "This year" starts on 1 January in `timeZone`. */
export function periodRange(period: PerformancePeriod, timeZone: string, now = Temporal.Now.instant()) {
  const p = PERFORMANCE_PERIODS.find((x) => x.key === period)!;
  const start =
    p.days === null
      ? now.toZonedDateTimeISO(timeZone).with({ month: 1, day: 1 }).startOfDay().toInstant()
      : now.subtract({ hours: 24 * p.days });
  const local = (i: Temporal.Instant) => i.toZonedDateTimeISO(timeZone).toPlainDate().toString();
  return { start: new Date(start.epochMilliseconds), end: new Date(now.epochMilliseconds), startDate: local(start), endDate: local(now) };
}

type Money = { currency: string; minor: number }[];

function addMoney(totals: Money, currency: string, minor: number) {
  const row = totals.find((t) => t.currency === currency);
  if (row) row.minor += minor;
  else totals.push({ currency, minor });
}

export async function practicePerformance(practiceId: string, range: { start: Date; end: Date; startDate: string; endDate: string }) {
  const { start, end, startDate, endDate } = range;
  const inDates = (col: typeof patients.startOfCare | typeof patients.referralDate) => and(gte(col, startDate), sql`${col} <= ${endDate}`);

  const [admitted, invoiceRows, missedRows, reviewRows, team] = await Promise.all([
    // Admitted: added, started care or referred in the period. Merged duplicates don't count.
    db
      .select({
        id: patients.id,
        fullName: patients.fullName,
        addedAt: patients.createdAt,
        startOfCare: patients.startOfCare,
        referralDate: patients.referralDate,
      })
      .from(patients)
      .where(
        and(
          eq(patients.practiceId, practiceId),
          ne(patients.status, "merged"),
          or(and(gte(patients.createdAt, start), lt(patients.createdAt, end)), inDates(patients.startOfCare), inDates(patients.referralDate)),
        ),
      )
      .orderBy(desc(patients.createdAt)),
    db
      .select({ clinicianId: invoices.clinicianId, status: invoices.status, totalMinor: invoices.totalMinor, currency: invoices.currency })
      .from(invoices)
      .innerJoin(clinicians, eq(clinicians.id, invoices.clinicianId))
      .where(and(eq(clinicians.practiceId, practiceId), gte(invoices.createdAt, start), lt(invoices.createdAt, end))),
    db
      .select({ clinicianId: appointments.clinicianId, count: sql<number>`count(*)::int` })
      .from(appointments)
      .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
      .where(
        and(
          eq(clinicians.practiceId, practiceId),
          isNotNull(appointments.missedAt),
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end),
        ),
      )
      .groupBy(appointments.clinicianId),
    // Hidden reviews leave the average, as on Patient reviews.
    db
      .select({
        id: reviews.id,
        clinicianId: reviews.clinicianId,
        clinicianName: clinicians.name,
        rating: reviews.rating,
        text: reviews.text,
        name: reviews.name,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .leftJoin(clinicians, eq(clinicians.id, reviews.clinicianId))
      .where(and(eq(reviews.practiceId, practiceId), isNull(reviews.hiddenAt), gte(reviews.createdAt, start), lt(reviews.createdAt, end)))
      .orderBy(desc(reviews.createdAt)),
    db
      .select({ id: clinicians.id, name: clinicians.name, discipline: clinicians.discipline, status: clinicians.status })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "clinician")))
      .orderBy(asc(clinicians.name)),
  ]);

  const sent: Money = [];
  const byStatus = { paid: { count: 0, totals: [] as Money }, unpaid: { count: 0, totals: [] as Money }, issue: { count: 0, totals: [] as Money } };
  for (const i of invoiceRows) {
    addMoney(sent, i.currency, i.totalMinor);
    byStatus[i.status].count++;
    addMoney(byStatus[i.status].totals, i.currency, i.totalMinor);
  }

  const missedBy = new Map(missedRows.map((m) => [m.clinicianId, m.count]));
  const clinicianRows = team
    .map((c) => {
      const theirInvoices = invoiceRows.filter((i) => i.clinicianId === c.id);
      const totals: Money = [];
      for (const i of theirInvoices) addMoney(totals, i.currency, i.totalMinor);
      const theirReviews = reviewRows.filter((r) => r.clinicianId === c.id);
      return {
        id: c.id,
        name: c.name,
        discipline: c.discipline,
        active: c.status === "active",
        missed: missedBy.get(c.id) ?? 0,
        invoices: { count: theirInvoices.length, totals },
        reviews: { count: theirReviews.length, average: average(theirReviews.map((r) => r.rating)) },
      };
    })
    // Deactivated or waiting clinicians only show when they have something in the period.
    .filter((c) => c.active || c.missed || c.invoices.count || c.reviews.count);

  return {
    admitted,
    invoices: { count: invoiceRows.length, totals: sent, ...byStatus },
    missed: { count: missedRows.reduce((n, m) => n + m.count, 0), clinicians: missedRows.length },
    reviews: { rows: reviewRows, average: average(reviewRows.map((r) => r.rating)) },
    clinicians: clinicianRows,
  };
}

function average(ratings: number[]) {
  return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
}
