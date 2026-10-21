import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";

// Duplicate patient check (spec v2 section 5b): the same name and date of birth in the same
// practice. Names are compared ignoring case, spaces and punctuation ("AMINA HASSAN" =
// "Amina Hassan"), the same normalising as practice names (src/lib/practice-name.ts).

const nameKey = sql`trim(regexp_replace(lower(${patients.fullName}), '[^a-z0-9]+', ' ', 'g'))`;
export const normalisePatientName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function findDuplicatePatient(practiceId: string, fullName: string, dateOfBirth: string) {
  const key = normalisePatientName(fullName);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [match] = await db
    .select({ id: patients.id, name: patients.fullName, dateOfBirth: patients.dateOfBirth })
    .from(patients)
    .where(and(eq(patients.practiceId, practiceId), eq(patients.dateOfBirth, dateOfBirth), sql`${nameKey} = ${key}`))
    .limit(1);
  return match ?? null;
}
