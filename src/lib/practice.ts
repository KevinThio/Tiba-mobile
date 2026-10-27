import "server-only";
import { and, asc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, patients, practices, reviews } from "@/db/schema";
import { billingCurrency } from "@/lib/countries";
import { practiceLogoUrl } from "@/lib/practice-logo";

/** The practice's logo URL, or null when it has none. Only checks that a logo exists; the image comes from /api/practice-logo. */
export async function practiceLogoUrlFor(practiceId: string) {
  const [row] = await db
    .select({ hasLogo: isNotNull(practices.logo), updatedAt: practices.updatedAt })
    .from(practices)
    .where(eq(practices.id, practiceId));
  return row?.hasLogo ? practiceLogoUrl(row.updatedAt) : null;
}

/** Whether the practice has an administrator. Practices made before v2 don't. */
export async function practiceHasAdmin(practiceId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "admin")));
  return (row?.n ?? 0) > 0;
}

/**
 * Who may change the practice name and logo: its admin, or a clinician whose practice
 * has no admin (accounts made before v2). Clinicians in an admin's practice can't.
 */
export async function canEditPractice(account: { role: string; practiceId: string }) {
  if (account.role === "admin") return true;
  if (account.role !== "clinician") return false;
  return !(await practiceHasAdmin(account.practiceId));
}

/** Count of clinicians waiting for the admin to verify them. */
export async function pendingClinicianCount(practiceId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "clinician"), eq(clinicians.status, "pending")));
  return row?.n ?? 0;
}

/** Count of patient reviews the admin hasn't opened yet. */
export async function newReviewCount(practiceId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.practiceId, practiceId), isNull(reviews.seenAt), isNull(reviews.hiddenAt)));
  return row?.n ?? 0;
}

/** Patients a clinician added as a possible duplicate, waiting for the admin's check (spec v2 section 5b). */
export function possibleDuplicates(practiceId: string) {
  return db
    .select({ id: patients.id, name: patients.fullName })
    .from(patients)
    .where(and(eq(patients.practiceId, practiceId), isNotNull(patients.duplicateFlaggedAt), ne(patients.status, "merged")))
    .orderBy(asc(patients.duplicateFlaggedAt));
}

/** The practice's country and the currency it bills in (the admin's choice, else the country's). */
export async function practiceBilling(practiceId: string) {
  const [row] = await db
    .select({ country: practices.country, currency: practices.currency })
    .from(practices)
    .where(eq(practices.id, practiceId));
  const country = row?.country ?? "US";
  return { country, currency: billingCurrency({ country, currency: row?.currency ?? null }), chosen: row?.currency ?? null };
}
