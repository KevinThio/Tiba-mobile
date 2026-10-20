import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, practices } from "@/db/schema";
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
  return !(await practiceHasAdmin(account.practiceId));
}

/** Count of clinicians waiting for the admin to verify them. */
export async function pendingClinicianCount(practiceId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.status, "pending")));
  return row?.n ?? 0;
}
