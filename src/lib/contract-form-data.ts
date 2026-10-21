import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicians } from "@/db/schema";

/** Active clinicians in the practice: the people a contract can be sent to. */
export function activeClinicians(practiceId: string) {
  return db
    .select({ id: clinicians.id, name: clinicians.name })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "clinician"), eq(clinicians.status, "active")))
    .orderBy(asc(clinicians.name));
}
