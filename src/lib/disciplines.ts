// Disciplines (spec v2 section 4b and section 11 permissions): each clinician sets theirs in
// Settings, and it decides which notes they can write. Shared by the server and the browser.

import { THERAPY_CARES, type Care, type NoteKind } from "@/lib/note-templates";

export const DISCIPLINES = [
  { value: "RN", label: "Registered nurse (RN)" },
  { value: "LPN", label: "Licensed practical nurse (LPN)" },
  { value: "PT", label: "Physical therapist (PT)" },
  { value: "OT", label: "Occupational therapist (OT)" },
  { value: "SLP", label: "Speech-language pathologist (SLP)" },
  { value: "HHA", label: "Home health aide / CNA" },
  { value: "MH", label: "Mental health therapist" },
] as const;

export type Discipline = (typeof DISCIPLINES)[number]["value"];
export const DISCIPLINE_VALUES = DISCIPLINES.map((d) => d.value) as [Discipline, ...Discipline[]];

export const isDiscipline = (value: unknown): value is Discipline =>
  typeof value === "string" && (DISCIPLINE_VALUES as string[]).includes(value);

export const disciplineLabel = (d: Discipline) => DISCIPLINES.find((x) => x.value === d)!.label;

// The types of care each discipline documents.
const CARES: Record<Discipline, Care[]> = {
  RN: ["rn"],
  LPN: ["rn"],
  PT: ["pt"],
  OT: ["ot"],
  SLP: ["st"],
  HHA: ["hha"],
  MH: THERAPY_CARES,
};

/** Whether a clinician of this discipline writes notes for this type of care. No discipline set yet: anything. */
export const canWriteCare = (discipline: Discipline | null, care: Care) => !discipline || CARES[discipline].includes(care);

/**
 * The note types a clinician can pick, from the ones the care allows (kindsFor). An LPN works
 * under an RN, so writes visit notes only: evaluations, OASIS and service plans need the RN.
 */
export function kindsForDiscipline(discipline: Discipline | null, kinds: NoteKind[]): NoteKind[] {
  if (discipline === "LPN") return kinds.filter((k) => k === "progress");
  return kinds;
}

/** Plain words for a refusal: "physical therapy notes". */
export function caresDescription(discipline: Discipline) {
  const words: Record<Discipline, string> = {
    RN: "skilled nursing notes, evaluations, OASIS and aide service plans",
    LPN: "skilled nursing visit notes",
    PT: "physical therapy notes",
    OT: "occupational therapy notes",
    SLP: "speech therapy notes",
    HHA: "aide visit notes",
    MH: "therapy notes",
  };
  return words[discipline];
}
