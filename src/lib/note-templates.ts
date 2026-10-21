// Visit note templates (spec v2 sections 4a and 4b, and the prototype). A note has a kind
// (progress, evaluation, OASIS or aide service plan) and a care (the discipline or type of
// therapy). Each template lists its sections ("fields") in groups. Every field counts as one
// section towards "6 of 10 sections done" unless it is optional. Shared by the editor and the
// server, so it must stay free of server-only code.

export type NoteKind = "progress" | "evaluation" | "oasis" | "service_plan";
export type Care = "pt" | "ot" | "st" | "rn" | "hha" | "individual" | "couples" | "assessment" | "followup";

type Base = { id: string; label: string; group: string; optional?: boolean; hint?: string };
export type MeasureItem = { id: string; label: string; unit: string; text?: boolean };
export type BillingCode = { code: string; label: string };

export type Field = Base &
  (
    | { type: "text"; placeholder?: string }
    | { type: "one"; options: string[] }
    | { type: "many"; options: string[] }
    | { type: "measures"; items: MeasureItem[] }
    | { type: "levels"; items: string[]; levels: string[] }
    | { type: "scores"; items: { id: string; label: string; max: number }[] }
    | { type: "goals" }
    | { type: "goalProgress" }
    | { type: "billing"; mode: "timed" | "units15" | "once" | "pickOne"; codes: BillingCode[] }
  );

export type Template = {
  kind: NoteKind;
  care: Care;
  /** Shown under "Type of note", e.g. "Progress note. Goals come from the evaluation." */
  typeLine: string;
  /** Group key → name, in order. SOAP letters, numbers, or none (therapy notes). */
  groups: { key: string; name: string }[];
  fields: Field[];
};

export type Goal = { id: string; text: string; term: "short" | "long"; weeks: number };

// ---------------------------------------------------------------------------
// Labels and mapping
// ---------------------------------------------------------------------------

export const CARE_LABEL: Record<Care, string> = {
  pt: "Physical therapy",
  ot: "Occupational therapy",
  st: "Speech therapy",
  rn: "Skilled nursing",
  hha: "Home health aide (CNA / HHA)",
  individual: "Individual therapy",
  couples: "Couples therapy",
  assessment: "Assessment",
  followup: "Follow-up call",
};

export const KIND_LABEL: Record<NoteKind, string> = {
  progress: "Visit note",
  evaluation: "Initial evaluation",
  oasis: "OASIS assessment",
  service_plan: "Aide service plan",
};

export const THERAPY_CARES: Care[] = ["individual", "couples", "assessment", "followup"];
export const DISCIPLINE_CARES: Care[] = ["pt", "ot", "st", "rn", "hha"];
export const isDiscipline = (care: Care) => DISCIPLINE_CARES.includes(care);

/** The template care for an appointment's free-text type of care. */
export function careFromTypeOfCare(typeOfCare: string): Care {
  const t = typeOfCare.toLowerCase();
  if (t.includes("physical") || /\bpt\b/.test(t)) return "pt";
  if (t.includes("occupational") || /\bot\b/.test(t)) return "ot";
  if (t.includes("speech") || /\b(st|slp)\b/.test(t)) return "st";
  if (t.includes("aide") || /\b(cna|hha)\b/.test(t)) return "hha";
  if (t.includes("nurs") || /\b(rn|lpn)\b/.test(t)) return "rn";
  if (t.includes("couple")) return "couples";
  if (t.includes("assessment")) return "assessment";
  if (t.includes("follow")) return "followup";
  return "individual";
}

/**
 * The note types a clinician can pick for a care. An aide service plan is written by the
 * nurse when skilled nursing is ordered, otherwise by PT or OT (spec v2 section 4b).
 */
export function kindsFor(care: Care, servicesOrdered: string[] = []): NoteKind[] {
  if (!isDiscipline(care)) return ["progress"];
  if (care === "hha") return ["progress"];
  const kinds: NoteKind[] = ["progress", "evaluation", "oasis"];
  const nurseOrdered = servicesOrdered.includes("RN");
  if (care === "rn" || ((care === "pt" || care === "ot") && !nurseOrdered)) kinds.push("service_plan");
  return kinds;
}

// ---------------------------------------------------------------------------
// Shared option lists
// ---------------------------------------------------------------------------

const ASSIST = ["Independent", "Supervision", "Min assist", "Mod assist", "Max assist"];
const AIDE_HELP = ["No help", "Device", "Standby", "Min", "Mod", "Max", "Total"];
const PLAN_FREQ = ["Every visit", "As needed", "Not needed"];
const VISITS_A_WEEK = ["1x a week", "2x a week", "3x a week"];
const DURATION = ["4 weeks", "6 weeks", "8 weeks", "12 weeks"];
const RISK = ["None noted", "Low", "Medium", "High"];

const SOAP = [
  { key: "S", name: "Subjective" },
  { key: "O", name: "Objective" },
  { key: "A", name: "Assessment" },
  { key: "P", name: "Plan" },
  { key: "B", name: "Billing" },
];

const VITALS: MeasureItem[] = [
  { id: "temp", label: "Temperature", unit: "°F" },
  { id: "pulse", label: "Pulse", unit: "bpm" },
  { id: "resp", label: "Respiration", unit: "/min" },
  { id: "bp", label: "Blood pressure", unit: "mmHg", text: true },
  { id: "o2", label: "Oxygen", unit: "%" },
  { id: "weight", label: "Weight", unit: "lb" },
];

const PAIN: MeasureItem[] = [
  { id: "now", label: "Today", unit: "/10" },
  { id: "best", label: "At best", unit: "/10" },
  { id: "worst", label: "At worst", unit: "/10" },
];

const BODY_SYSTEMS = ["Heart", "Breathing", "Neuro", "Skin", "Bowel", "Bladder", "Nutrition"];
const WOUND: MeasureItem[] = [
  { id: "l", label: "Length", unit: "cm" },
  { id: "w", label: "Width", unit: "cm" },
  { id: "d", label: "Depth", unit: "cm" },
];

// Shared ids (subjective, assessment, plan, goals, risk…) keep answers when the type changes.
const text = (id: string, label: string, group: string, extra: Partial<Base> & { placeholder?: string } = {}): Field => ({
  type: "text",
  id,
  label,
  group,
  ...extra,
});
const one = (id: string, label: string, group: string, options: string[], extra: Partial<Base> = {}): Field => ({
  type: "one",
  id,
  label,
  group,
  options,
  ...extra,
});
const many = (id: string, label: string, group: string, options: string[], extra: Partial<Base> = {}): Field => ({
  type: "many",
  id,
  label,
  group,
  options,
  ...extra,
});
const measures = (id: string, label: string, group: string, items: MeasureItem[], extra: Partial<Base> = {}): Field => ({
  type: "measures",
  id,
  label,
  group,
  items,
  ...extra,
});
const levels = (id: string, label: string, group: string, items: string[], lv: string[], extra: Partial<Base> = {}): Field => ({
  type: "levels",
  id,
  label,
  group,
  items,
  levels: lv,
  ...extra,
});
const billing = (mode: "timed" | "units15" | "once" | "pickOne", codes: BillingCode[], label = "Billing codes and minutes"): Field => ({
  type: "billing",
  id: "billing",
  label,
  group: "B",
  mode,
  codes,
});
const goalProgress: Field = { type: "goalProgress", id: "goalProgress", label: "Goal progress", group: "A" };
const goals: Field = { type: "goals", id: "goals", label: "Goals", group: "A" };

// ---------------------------------------------------------------------------
// Therapy notes (spec v2 section 4a)
// ---------------------------------------------------------------------------

function therapy(care: Care): Template {
  const base = { kind: "progress" as const, care, typeLine: "Sections change with the type of care.", groups: [] };
  const risk = one("risk", "Risk check", "", RISK);
  const happened = text("session", "What happened", "", { placeholder: "What you talked about and how it went" });
  const plan = text("plan", "Plan and homework", "", { placeholder: "Goals, homework, next steps" });
  switch (care) {
    case "couples":
      return {
        ...base,
        fields: [
          one("attended", "Who attended", "", ["Both partners", "One partner"]),
          many("focus", "What you worked on", "", ["Communication", "Conflict", "Trust", "Intimacy", "Parenting", "Separation"]),
          many("approach", "Approaches used", "", ["Gottman method", "EFT", "Active listening", "Time-out plan", "Psychoeducation"]),
          happened,
          risk,
          plan,
        ],
      };
    case "assessment":
      return {
        ...base,
        fields: [
          text("reason", "Reason for referral", "", { placeholder: "Who referred them and why" }),
          many("presented", "How they presented", "", ["Calm", "Anxious", "Tearful", "Agitated", "Withdrawn", "Engaged"]),
          text("history", "Relevant history", "", { placeholder: "Past support, medication, life events" }),
          risk,
          text("formulation", "Initial formulation", "", { placeholder: "What seems to be keeping things going" }),
          one("recommend", "Recommendation", "", ["Start therapy", "Refer on", "Watchful waiting"]),
        ],
      };
    case "followup":
      return {
        ...base,
        fields: [
          one("callreason", "Reason for call", "", ["Check-in", "Medication", "Crisis", "Scheduling"]),
          text("update", "Update", "", { placeholder: "How they are doing since the last visit" }),
          risk,
          text("next", "Agreed next step", "", { placeholder: "What happens now" }),
        ],
      };
    default:
      return {
        ...base,
        fields: [
          one("mood", "Mood today", "", ["Low", "Flat", "Okay", "Good", "Bright"]),
          many("focus", "What you worked on", "", ["Anxiety", "Low mood", "Sleep", "Relationships", "Work stress", "Trauma", "Self-esteem"]),
          many("approach", "Approaches used", "", ["CBT", "Breathing", "Grounding", "Psychoeducation", "Behavioural activation", "Motivational interviewing"]),
          happened,
          risk,
          plan,
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Discipline progress notes (SOAP), spec v2 section 4a
// ---------------------------------------------------------------------------

const PROGRESS_LINE = "Progress note. Goals come from the evaluation.";
const EVAL_LINE = "Initial evaluation. Sets the goals.";

function progress(care: Care): Template {
  const base = { kind: "progress" as const, care, typeLine: PROGRESS_LINE, groups: SOAP };
  const assessment = text("assessment", "Assessment", "A", { placeholder: "How they are doing against the plan" });
  const plan = text("plan", "Plan", "P", { placeholder: "What happens next" });
  switch (care) {
    case "pt":
      return {
        ...base,
        fields: [
          text("subjective", "What they told you", "S"),
          measures("pain", "Pain", "S", PAIN),
          measures("measures", "Measurements", "O", [
            { id: "flex", label: "Flexion", unit: "°" },
            { id: "ext", label: "Extension", unit: "°" },
            { id: "str", label: "Strength", unit: "/5" },
            { id: "tug", label: "Timed Up and Go", unit: "sec" },
          ]),
          many("treatment", "Treatment given", "O", ["Therapeutic exercise", "Manual therapy", "Neuromuscular re-education", "Gait training", "Balance training", "Ice or heat", "Home program review"]),
          one("response", "How they responded", "O", ["Tolerated well", "Some discomfort", "Had to stop early"]),
          goalProgress,
          assessment,
          plan,
          one("frequency", "Visits", "P", VISITS_A_WEEK),
          billing("timed", [
            { code: "97110", label: "Therapeutic exercise" },
            { code: "97140", label: "Manual therapy" },
            { code: "97112", label: "Neuromuscular re-education" },
            { code: "97116", label: "Gait training" },
            { code: "97530", label: "Therapeutic activities" },
          ]),
        ],
      };
    case "ot":
      return {
        ...base,
        fields: [
          text("subjective", "What they told you", "S"),
          levels("adl", "Help needed with daily tasks", "O", ["Dressing", "Bathing", "Toileting", "Eating", "Grooming"], ASSIST),
          measures("measures", "Measurements", "O", [
            { id: "gripR", label: "Grip, right", unit: "kg" },
            { id: "gripL", label: "Grip, left", unit: "kg" },
            { id: "pegR", label: "Nine-hole peg, right", unit: "sec" },
            { id: "pegL", label: "Nine-hole peg, left", unit: "sec" },
          ]),
          many("treatment", "Treatment given", "O", ["Daily task training", "Fine motor", "Upper body strength", "Splint or orthosis", "Thinking strategies", "Energy saving", "Home safety"]),
          goalProgress,
          assessment,
          plan,
          one("frequency", "Visits", "P", VISITS_A_WEEK),
          billing("timed", [
            { code: "97535", label: "Self-care and home training" },
            { code: "97530", label: "Therapeutic activities" },
            { code: "97110", label: "Therapeutic exercise" },
            { code: "97112", label: "Neuromuscular re-education" },
            { code: "97763", label: "Orthotic management" },
          ]),
        ],
      };
    case "st":
      return {
        ...base,
        fields: [
          text("subjective", "What they or their family told you", "S"),
          many("areas", "Areas worked on", "O", ["Speech sounds", "Understanding language", "Using language", "Fluency", "Voice", "Swallowing", "Thinking and memory"]),
          measures("accuracy", "Accuracy", "O", [
            { id: "t1", label: "Target 1", unit: "%" },
            { id: "t2", label: "Target 2", unit: "%" },
            { id: "trials", label: "Trials", unit: "tries" },
          ]),
          one("cueing", "Level of help", "O", ["Independent", "Minimal cues", "Moderate cues", "Maximal cues"]),
          goalProgress,
          assessment,
          plan,
          text("homePractice", "Home practice", "P"),
          billing(
            "once",
            [
              { code: "92507", label: "Speech and language treatment" },
              { code: "92526", label: "Swallowing treatment" },
              { code: "92609", label: "Speech device training" },
            ],
            "Billing codes",
          ),
        ],
      };
    default:
      // Skilled nursing visit (RN or LPN).
      return {
        ...base,
        fields: [
          text("subjective", "What the patient or family told you", "S"),
          measures("pain", "Pain", "S", [PAIN[0]]),
          measures("vitals", "Vital signs", "O", [...VITALS, { id: "sugar", label: "Blood sugar", unit: "mg/dL" }]),
          levels("systems", "Body systems", "O", BODY_SYSTEMS, ["Normal", "Changed", "Not checked"]),
          measures("wound", "Wound size", "O", WOUND, { optional: true }),
          many("skilledCare", "Skilled care given", "O", ["Wound care", "Medicine management", "Injection or IV", "Catheter care", "Ostomy care", "Diabetes care", "Observation and assessment"]),
          one("medReview", "Medicine review", "O", ["No changes", "Changes made", "Problem found"]),
          goalProgress,
          assessment,
          one("homebound", "Homebound status", "A", ["Homebound, confirmed", "No longer homebound"]),
          many("teaching", "Teaching given", "P", ["Medicines", "Wound care", "Diet", "When to call", "Fall safety", "Their condition"]),
          one("doctor", "Doctor contacted", "P", ["Not needed", "Called, no new orders", "Called, new orders"]),
          plan,
          billing("units15", [
            { code: "G0299", label: "Skilled nursing, RN" },
            { code: "G0300", label: "Skilled nursing, LPN" },
            { code: "G0162", label: "Care plan management" },
            { code: "G0495", label: "Training and education" },
          ]),
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Initial evaluations (spec v2 section 4b)
// ---------------------------------------------------------------------------

function evaluation(care: Care): Template {
  const base = { kind: "evaluation" as const, care, typeLine: EVAL_LINE, groups: SOAP };
  const assessment = text("assessment", "Assessment", "A");
  const complexity = one("complexity", "Complexity", "A", ["Low", "Moderate", "High"]);
  const visits = one("frequency", "Visits", "P", VISITS_A_WEEK);
  const duration = one("duration", "For", "P", DURATION);
  const priorFunction = one("priorFunction", "Before this problem", "S", ["Independent", "Needed some help", "Needed a lot of help"]);
  switch (care) {
    case "pt":
      return {
        ...base,
        fields: [
          text("reason", "Reason for referral", "S"),
          text("history", "History of the problem", "S"),
          many("medicalHistory", "Medical history", "S", ["Diabetes", "Heart disease", "High blood pressure", "Stroke", "Arthritis", "Osteoporosis", "Recent surgery", "Falls this year", "None"]),
          priorFunction,
          many("home", "Home setup", "S", ["Lives alone", "Lives with family", "Steps to enter", "Stairs inside", "Tub or shower", "Has a walker or cane"]),
          text("wants", "What they want to get back to", "S"),
          measures("pain", "Pain", "O", PAIN),
          measures("measures", "Range of motion and strength", "O", [
            { id: "flex", label: "Flexion", unit: "°" },
            { id: "ext", label: "Extension", unit: "°" },
            { id: "str", label: "Strength", unit: "/5" },
          ]),
          measures("tests", "Balance and function tests", "O", [
            { id: "tug", label: "Timed Up and Go", unit: "sec" },
            { id: "berg", label: "Berg balance", unit: "/56" },
            { id: "chair", label: "30-sec chair stand", unit: "reps" },
          ]),
          levels("mobility", "Mobility", "O", ["Bed mobility", "Sit to stand", "Walking", "Stairs"], ASSIST),
          assessment,
          complexity,
          one("potential", "Rehab potential", "A", ["Good", "Fair", "Poor"]),
          goals,
          visits,
          duration,
          many("plannedTreatment", "Planned treatment", "P", ["Therapeutic exercise", "Manual therapy", "Gait training", "Balance training", "Home exercise program", "Ice or heat", "Patient education"]),
          billing("pickOne", [
            { code: "97161", label: "PT evaluation, low complexity" },
            { code: "97162", label: "PT evaluation, moderate complexity" },
            { code: "97163", label: "PT evaluation, high complexity" },
          ], "Billing code"),
        ],
      };
    case "ot":
      return {
        ...base,
        fields: [
          text("profile", "Occupational profile", "S", { placeholder: "Roles, routines and what matters to them" }),
          text("history", "History of the problem", "S"),
          priorFunction,
          many("home", "Home setup", "S", ["Lives alone", "Lives with family", "Steps to enter", "Tub or shower", "Grab bars", "Raised toilet seat"]),
          levels("adl", "Daily task levels", "O", ["Dressing", "Bathing", "Toileting", "Eating", "Grooming", "Meal prep"], ASSIST),
          measures("measures", "Grip and nine-hole peg", "O", [
            { id: "gripR", label: "Grip, right", unit: "kg" },
            { id: "gripL", label: "Grip, left", unit: "kg" },
            { id: "pegR", label: "Nine-hole peg, right", unit: "sec" },
            { id: "pegL", label: "Nine-hole peg, left", unit: "sec" },
          ]),
          one("safety", "Thinking and safety", "O", ["No concerns", "Some concerns", "Needs supervision"]),
          assessment,
          complexity,
          goals,
          visits,
          duration,
          many("plannedTreatment", "Planned treatment", "P", ["Daily task training", "Fine motor", "Splint or orthosis", "Equipment training", "Home safety", "Caregiver training"]),
          billing("pickOne", [
            { code: "97165", label: "OT evaluation, low complexity" },
            { code: "97166", label: "OT evaluation, moderate complexity" },
            { code: "97167", label: "OT evaluation, high complexity" },
          ], "Billing code"),
        ],
      };
    case "st":
      return {
        ...base,
        fields: [
          text("history", "Case history", "S"),
          many("areas", "Areas of concern", "S", ["Speech sounds", "Understanding language", "Using language", "Fluency", "Voice", "Swallowing", "Thinking and memory"]),
          text("tests", "Tests given", "O"),
          measures("scores", "Scores", "O", [
            { id: "std", label: "Standard score", unit: "" },
            { id: "pct", label: "Percentile", unit: "%ile" },
            { id: "intel", label: "Intelligibility", unit: "%" },
          ]),
          one("oral", "Oral mechanism", "O", ["Within normal limits", "Mild concerns", "Significant concerns"]),
          assessment,
          one("severity", "Severity", "A", ["Mild", "Moderate", "Severe"]),
          goals,
          visits,
          duration,
          text("homePractice", "Home program", "P"),
          billing("pickOne", [
            { code: "92521", label: "Fluency evaluation" },
            { code: "92522", label: "Speech sound evaluation" },
            { code: "92523", label: "Speech sound and language evaluation" },
            { code: "92610", label: "Swallowing evaluation" },
          ], "Billing code"),
        ],
      };
    default:
      // Skilled nursing start of care (RN).
      return {
        ...base,
        typeLine: "Start of care. Sets the nursing goals.",
        fields: [
          text("reason", "Reason for home care", "S"),
          many("medicalHistory", "Medical history", "S", ["Diabetes", "Heart failure", "COPD", "High blood pressure", "Stroke", "Kidney disease", "Dementia", "Cancer"]),
          many("homebound", "Why they are homebound", "S", ["Leaves home only for medical care", "Needs help or a device to leave", "Leaving home takes great effort", "Unsafe to leave alone"]),
          measures("vitals", "Vital signs", "O", VITALS),
          levels("systems", "Body systems", "O", BODY_SYSTEMS, ["Normal", "Changed", "Not checked"]),
          measures("wound", "Wound size", "O", WOUND, { optional: true }),
          measures("fallRisk", "Fall risk", "O", [{ id: "mahc", label: "MAHC-10 score", unit: "/10" }]),
          one("medList", "Medicine list", "O", ["Matches the orders", "Changes needed"]),
          assessment,
          goals,
          many("requestServices", "Services to ask the doctor for", "P", ["Skilled nursing", "PT", "OT", "ST", "Home health aide", "Social work"]),
          text("visitPlan", "Visit plan", "P"),
          text("emergencyPlan", "Emergency plan", "P"),
          billing("units15", [{ code: "G0299", label: "Skilled nursing, RN" }]),
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// CNA / home health aide visit (six numbered parts, like the agency's paper form)
// ---------------------------------------------------------------------------

const NUMBERED = (names: string[]) => names.map((name, i) => ({ key: String(i + 1), name }));

function aideVisit(): Template {
  return {
    kind: "progress",
    care: "hha",
    typeLine: "Aide visit. Follows the patient's signed aide service plan.",
    groups: NUMBERED(["Visit", "Vitals and status", "Daily living", "Medicines and meals", "Care tasks", "Notes"]),
    fields: [
      text("purpose", "Purpose of visit", "1"),
      one("diet", "Diet", "1", ["Regular", "Diabetic", "Low sodium", "Other"]),
      measures("vitals", "Vital signs", "2", [
        { id: "temp", label: "Temperature", unit: "°F" },
        { id: "pulse", label: "Pulse", unit: "bpm" },
        { id: "resp", label: "Respiration", unit: "/min" },
        { id: "weight", label: "Weight", unit: "lb" },
        { id: "bpR", label: "BP right arm", unit: "mmHg", text: true },
        { id: "bpL", label: "BP left arm", unit: "mmHg", text: true },
      ]),
      many("skin", "Skin", "2", ["Good condition", "Colour changed", "Redness", "Rash", "Sores"]),
      text("area", "Body area affected", "2", { optional: true }),
      many("alert", "Thinking and alertness", "2", ["Alert", "Knows date and time", "Drowsy", "Forgetful", "Confused"]),
      ...[
        ["eating", "Cooking and eating", ["Preparing meal", "Serving meal", "Using appliances", "Eating", "Using utensils", "Drinking fluids", "Using cups", "Cutting food"]],
        ["hygiene", "Bathing and hygiene", ["Toilet transfers", "Toileting", "Bath transfers", "Shower transfers", "Bathing", "Brushing hair", "Shaving", "Cleaning teeth"]],
        ["mobility", "Mobility", ["Range of motion, passive", "Range of motion, active", "Bed transfers", "Moving in bed"]],
        ["dressing", "Dressing and grooming", ["Upper body dressing", "Lower body dressing", "Shoes and socks", "Tying laces"]],
      ].map(([id, label, items]) =>
        levels(id as string, label as string, "3", items as string[], AIDE_HELP, {
          optional: true,
          hint: "Tap the help level for each task you did. Leave the rest blank.",
        }),
      ),
      one("medHelp", "Medicine help", "4", ["None needed", "Reminders", "Assistance"]),
      text("medsTimes", "Medicines and times", "4", { optional: true }),
      levels("meals", "Meal log", "4", ["Breakfast", "Morning snack", "Lunch", "Afternoon snack", "Dinner", "Evening snack"], ["All", "Half", "A little", "Refused"]),
      many("companion", "Companion care", "5", ["Morning wake-up", "News and daily events", "Phone and door", "TV or movies", "Letters", "Mail and newspaper", "Reading together", "Meal planning", "Help with walking", "Booking appointments", "House plants", "Crafts or games", "Visiting neighbours", "Scrapbook", "Evening tuck-in"], { optional: true }),
      many("homeHelp", "Home help", "5", ["Prepare and clean up meals", "Grocery shopping", "Tidy pantry or closet", "Clean fridge", "Dusting", "Make beds", "Change linens", "Laundry", "Vacuum or mop", "Take out rubbish", "Escort to appointments", "Pick up prescriptions", "Dry cleaning", "Pet care", "Escort to salon or barber"], { optional: true }),
      text("observations", "Other things you noticed", "6", { optional: true }),
      text("narrative", "Daily narrative", "6", { placeholder: "How the visit went, in your own words" }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Aide service plan (spec v2 section 4b)
// ---------------------------------------------------------------------------

function servicePlan(care: Care): Template {
  return {
    kind: "service_plan",
    care,
    typeLine: "One plan per patient. Update it when orders change.",
    groups: NUMBERED(["Orders", "Safety", "Personal care", "Mobility and meals", "Home and medicines", "Goals and supervision"]),
    fields: [
      one("aideVisits", "Aide visits", "1", ["1x a week", "2x a week", "3x a week", "5x a week", "Daily"]),
      one("aideFor", "For", "1", ["2 weeks", "4 weeks", "8 weeks", "60 days"]),
      one("visitLength", "Visit length", "1", ["1 hour", "2 hours", "3 hours", "4 hours"]),
      many("precautions", "Precautions", "2", ["Fall risk", "Diabetic: no nail cutting", "Oxygen in use", "Bleeding risk", "Hip precautions", "Infection control", "Choking risk", "Memory loss", "Fragile skin"]),
      many("activity", "Activity allowed", "2", ["Up as tolerated", "Walker", "Cane", "Wheelchair", "Transfer with help", "Bed rest"]),
      one("diet", "Diet", "2", ["Regular", "Diabetic", "Low sodium", "Soft or pureed", "Thickened liquids"]),
      measures("callIf", "Call the nurse or therapist if", "2", [
        { id: "temp", label: "Temp above", unit: "°F" },
        { id: "pulseHi", label: "Pulse above", unit: "bpm" },
        { id: "pulseLo", label: "Pulse below", unit: "bpm" },
        { id: "sys", label: "Systolic BP above", unit: "mmHg" },
        { id: "sugar", label: "Blood sugar below", unit: "mg/dL" },
      ]),
      one("bath", "Bath type", "3", ["Shower", "Tub", "Bed bath", "Sponge bath"]),
      levels("personal", "Personal care tasks", "3", ["Bathing", "Hair care", "Mouth care", "Shaving", "Skin care", "Nail care, file only", "Dressing", "Toileting and continence care", "Catheter care"], PLAN_FREQ),
      levels("mobilityTasks", "Mobility tasks", "4", ["Transfers", "Walking help", "Range of motion exercises", "Turning and positioning"], PLAN_FREQ),
      levels("mealTasks", "Meal tasks", "4", ["Meal prep", "Help with eating", "Encourage fluids"], PLAN_FREQ),
      levels("homeTasks", "Home tasks", "5", ["Light housekeeping", "Laundry", "Change linens", "Shopping and errands"], PLAN_FREQ),
      one("planMedHelp", "Medicine help", "5", ["Reminders only", "None"]),
      text("aideGoals", "Goals of aide care", "6"),
      text("reportNow", "Report right away", "6", { placeholder: "Changes the aide must report the same day" }),
      one("supervision", "Supervisory visit", "6", ["Every 14 days (skilled care ongoing)", "Every 60 days (aide only)"]),
    ],
  };
}

// ---------------------------------------------------------------------------
// OASIS assessment (CMS home health). Key OASIS-E items for documentation; item codes
// are shown so the agency can match them. Not the full form for iQIES submission.
// ---------------------------------------------------------------------------

const GG_CODES = [
  "06 Independent",
  "05 Setup or clean-up",
  "04 Supervision or touching",
  "03 Partial or moderate help",
  "02 Substantial or maximal help",
  "01 Dependent",
  "07 Refused",
  "09 Not applicable",
  "10 Not attempted (environment)",
  "88 Not attempted (medical or safety)",
];

function oasis(care: Care): Template {
  return {
    kind: "oasis",
    care,
    typeLine: "OASIS assessment. Key OASIS-E items with their codes.",
    groups: NUMBERED(["Assessment", "Senses and mind", "Body", "Daily living", "Medicines", "Summary"]),
    fields: [
      one("timepoint", "M0100 Reason for assessment", "1", [
        "Start of care (SOC)",
        "Resumption of care (ROC)",
        "Recertification (follow-up)",
        "Other follow-up",
        "Transfer to an inpatient facility",
        "Discharge from agency",
      ]),
      text("otherDx", "M1023 Other diagnoses", "1", {
        optional: true,
        hint: "The primary diagnosis is the diagnosis code above (M1021).",
      }),
      many("hospRisk", "M1033 Risk for hospitalisation", "1", [
        "History of falls",
        "Unintentional weight loss",
        "Multiple hospitalisations",
        "Multiple ED visits",
        "Decline in mental or emotional status",
        "Difficulty following medical instructions",
        "Taking 5 or more medicines",
        "Reports exhaustion",
        "Other risk",
        "None of the above",
      ]),
      one("living", "M1100 Living arrangement", "1", ["Lives alone", "Lives with others", "Lives in a congregate setting"]),
      one("assistance", "M1100 Help available", "1", ["Around the clock", "Regular daytime", "Regular night-time", "Occasional or short-term", "None"]),
      one("hearing", "B0200 Hearing", "2", ["Adequate", "Minimal difficulty", "Moderate difficulty", "Highly impaired"]),
      one("vision", "B1000 Vision", "2", ["Adequate", "Impaired", "Moderately impaired", "Highly impaired", "Severely impaired"]),
      measures("bims", "C0500 BIMS summary score", "2", [{ id: "score", label: "Score", unit: "/15" }], {
        hint: "Brief Interview for Mental Status. Use 99 if the interview couldn't be completed.",
      }),
      measures("phq2", "D0150 PHQ-2 mood", "2", [
        { id: "interest", label: "Little interest or pleasure", unit: "0–3" },
        { id: "down", label: "Feeling down or hopeless", unit: "0–3" },
      ]),
      one("dyspnea", "M1400 Short of breath", "3", [
        "Not short of breath",
        "Walking more than 20 feet or climbing stairs",
        "With moderate exertion",
        "With minimal exertion",
        "At rest",
      ]),
      one("pressureUlcer", "M1306 Unhealed pressure ulcer or injury, stage 2 or higher", "3", ["No", "Yes"]),
      one("stasisUlcer", "M1330 Stasis ulcer", "3", ["No", "Yes, observable", "Yes, not observable"]),
      one("surgicalWound", "M1340 Surgical wound", "3", ["No", "Yes, observable", "Yes, not observable"]),
      one("urinary", "M1610 Urinary incontinence or catheter", "3", ["No incontinence or catheter", "Incontinent", "Requires a urinary catheter"]),
      one("bowel", "M1620 Bowel incontinence", "3", [
        "Very rarely or never",
        "Less than once a week",
        "One to three times a week",
        "Four to six times a week",
        "On a daily basis",
        "More often than once daily",
        "Has an ostomy",
      ]),
      {
        type: "scores",
        id: "adl",
        label: "M1800–M1860 Daily living (score each)",
        group: "4",
        hint: "0 means independent; higher numbers mean more help, as in the OASIS guidance.",
        items: [
          { id: "M1800", label: "M1800 Grooming", max: 3 },
          { id: "M1810", label: "M1810 Dressing upper body", max: 3 },
          { id: "M1820", label: "M1820 Dressing lower body", max: 3 },
          { id: "M1830", label: "M1830 Bathing", max: 6 },
          { id: "M1840", label: "M1840 Toilet transferring", max: 4 },
          { id: "M1850", label: "M1850 Transferring", max: 5 },
          { id: "M1860", label: "M1860 Ambulation or locomotion", max: 6 },
        ],
      },
      levels("ggSelfCare", "GG0130 Self-care", "4", ["Eating", "Oral hygiene", "Toileting hygiene"], GG_CODES),
      levels(
        "ggMobility",
        "GG0170 Mobility",
        "4",
        ["Roll left and right", "Sit to lying", "Lying to sitting", "Sit to stand", "Chair or bed transfer", "Toilet transfer", "Walk 10 feet", "Walk 50 feet with two turns", "Walk 150 feet"],
        GG_CODES,
      ),
      one("drugReview", "M2001 Drug regimen review", "5", ["No issues found", "Issues found", "Not taking any medicines"]),
      {
        type: "scores",
        id: "oralMeds",
        label: "M2020 Managing oral medicines",
        group: "5",
        hint: "0 means able to take them correctly without help.",
        items: [{ id: "M2020", label: "M2020 Oral medicines", max: 3 }],
      },
      text("assessment", "Clinical summary", "6"),
      text("plan", "Plan and orders", "6"),
    ],
  };
}

// ---------------------------------------------------------------------------
// Lookup and progress
// ---------------------------------------------------------------------------

/** The template for a note type and care. Unsupported combinations fall back to a visit note. */
export function getTemplate(kind: NoteKind, care: Care): Template {
  if (!isDiscipline(care)) return therapy(care);
  if (care === "hha") return aideVisit();
  if (kind === "evaluation") return evaluation(care);
  if (kind === "oasis") return oasis(care);
  if (kind === "service_plan") return servicePlan(care);
  return progress(care);
}

/** Timed codes: total minutes → billable units under the 8-minute rule (8–22 is 1, 23–37 is 2…). */
export const billableUnits = (minutes: number) => (minutes >= 8 ? Math.floor((minutes + 7) / 15) : 0);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : typeof v === "number" ? true : false);

/** Whether a section has an answer. `goalCount` is how many goals the evaluation set. */
export function isFilled(field: Field, value: unknown, goalCount = 0): boolean {
  switch (field.type) {
    case "text":
    case "one":
      return nonEmpty(value);
    case "many":
      return Array.isArray(value) && value.length > 0;
    case "measures":
    case "levels":
      return isRecord(value) && Object.values(value).some(nonEmpty);
    case "scores":
      return isRecord(value) && field.items.every((i) => typeof value[i.id] === "number");
    case "goals":
      return Array.isArray(value) && value.some((g) => isRecord(g) && nonEmpty(g.text));
    case "goalProgress":
      return goalCount > 0 && isRecord(value) && Object.values(value).filter(nonEmpty).length >= goalCount;
    case "billing":
      return isRecord(value) && Object.values(value).some((v) => v === true || (typeof v === "number" && v > 0));
  }
}

/** Sections that count towards "N of M done". Goal progress only counts when there are goals. */
export function countedFields(template: Template, goalCount: number) {
  return template.fields.filter((f) => !f.optional && !(f.type === "goalProgress" && goalCount === 0));
}

export function missingFields(template: Template, values: Record<string, unknown>, goalCount: number) {
  return countedFields(template, goalCount).filter((f) => !isFilled(f, values[f.id], goalCount));
}

/** Fields that are never copied by "Prefill from last visit" (spec v2: billing minutes and visit times). */
export const NOT_PREFILLED = new Set(["billing"]);

/** A starting note type from the appointment's type of care ("PT evaluation", "OASIS recert"…). */
export function kindFromTypeOfCare(typeOfCare: string): NoteKind {
  const t = typeOfCare.toLowerCase();
  if (t.includes("oasis")) return "oasis";
  if (t.includes("service plan") || t.includes("care plan")) return "service_plan";
  if (t.includes("evaluation") || t.includes("start of care") || /\beval\b/.test(t)) return "evaluation";
  return "progress";
}
