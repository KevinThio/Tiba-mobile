import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { canWriteCare, caresDescription, disciplineLabel, isDiscipline, kindsForDiscipline, type Discipline } from "@/lib/disciplines";
import type { Care, NoteKind } from "@/lib/note-templates";

/** A clinician's Settings: discipline and default visit fee. Not in the session, so read here. */
export async function clinicianSettings(clinicianId: string) {
  const [row] = await db
    .select({
      discipline: clinicians.discipline,
      visitFeeMinor: clinicians.visitFeeMinor,
      visitFeeCurrency: clinicians.visitFeeCurrency,
    })
    .from(clinicians)
    .where(eq(clinicians.id, clinicianId));
  return {
    discipline: (isDiscipline(row?.discipline) ? row.discipline : null) as Discipline | null,
    visitFee: row?.visitFeeMinor != null && row.visitFeeCurrency ? { minor: row.visitFeeMinor, currency: row.visitFeeCurrency } : null,
  };
}

/** Spec v2: clinicians write the notes of their discipline. Null when allowed, else what to say. */
export async function disciplineProblem(clinicianId: string, care: Care, kind: NoteKind) {
  const { discipline } = await clinicianSettings(clinicianId);
  if (!discipline || (canWriteCare(discipline, care) && kindsForDiscipline(discipline, [kind]).length)) return null;
  return `Your discipline is ${disciplineLabel(discipline)}, so you write ${caresDescription(discipline)}. If that's wrong, change it in Settings.`;
}
