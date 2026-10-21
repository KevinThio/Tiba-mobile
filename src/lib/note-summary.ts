// Turns a note's section answers into text: the summary on the Sign note screen, the "Section
// answers" on a signed note, and the written note Tiba makes when it's signed (spec v2: "Once
// signed, Tiba writes these sections up as a finished note"). A fixed sentence pattern per type
// of care, as in the prototype. Shared by the server and the browser.

import { billableUnits, type Care, type Field, type Goal, type Template } from "@/lib/note-templates";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const present = (v: unknown) => (typeof v === "number" ? true : typeof v === "string" && v.trim() !== "");
// Lower-cases the start of each listed item for use mid-sentence, but keeps acronyms ("CBT", "EFT").
const lc = (s: string) => s.replace(/(^|, )([A-Z])(?![A-Z])/g, (_, sep: string, c: string) => sep + c.toLowerCase());
/** Ends a sentence with a full stop unless it already has one. */
const end = (s: string) => s.trim().replace(/([^.!?])$/, "$1.");
// "4/10", "98°F" and "95%" sit next to the number; "72 bpm" and "12 cm" get a space.
const withUnit = (v: unknown, unit: string) => `${String(v).trim()}${/^[/°%]/.test(unit) ? "" : " "}${unit}`;

/** One section's answer as plain text, or null if it isn't answered. */
export function answerText(field: Field, value: unknown, goals: Goal[] = []): string | null {
  switch (field.type) {
    case "text":
    case "one":
      return present(value) ? String(value).trim() : null;
    case "many":
      return Array.isArray(value) && value.length ? value.join(", ") : null;
    case "measures": {
      if (!isRecord(value)) return null;
      const parts = field.items.filter((i) => present(value[i.id])).map((i) => `${i.label} ${withUnit(value[i.id], i.unit)}`);
      return parts.length ? parts.join(", ") : null;
    }
    case "levels": {
      if (!isRecord(value)) return null;
      const parts = field.items.filter((i) => present(value[i])).map((i) => `${i}: ${lc(String(value[i]))}`);
      return parts.length ? parts.join("; ") : null;
    }
    case "scores": {
      if (!isRecord(value)) return null;
      const parts = field.items.filter((i) => typeof value[i.id] === "number").map((i) => `${i.label}: ${value[i.id]}`);
      return parts.length ? parts.join("; ") : null;
    }
    case "goals": {
      if (!Array.isArray(value)) return null;
      const parts = (value as Goal[])
        .filter((g) => isRecord(g) && present(g.text))
        .map((g, i) => `${i + 1}. ${g.text.trim()} (${g.term === "long" ? "long term" : "short term"}, ${g.weeks} weeks)`);
      return parts.length ? parts.join(" ") : null;
    }
    case "goalProgress": {
      if (!isRecord(value)) return null;
      const parts = goals.filter((g) => present(value[g.id])).map((g) => `${g.text.trim()}: ${lc(String(value[g.id]))}`);
      return parts.length ? parts.join("; ") : null;
    }
    case "billing": {
      if (!isRecord(value)) return null;
      if (field.mode === "once" || field.mode === "pickOne") {
        const parts = field.codes.filter((c) => value[c.code] === true).map((c) => `${c.code} ${c.label}`);
        return parts.length ? parts.join(", ") : null;
      }
      const used = field.codes.filter((c) => Number(value[c.code]) > 0);
      if (!used.length) return null;
      const minutes = used.reduce((sum, c) => sum + Number(value[c.code]), 0);
      const units = billableUnits(minutes);
      return `${used.map((c) => `${c.code} ${c.label} ${value[c.code]} min`).join(", ")} (${minutes} timed minutes, ${units} billable ${units === 1 ? "unit" : "units"})`;
    }
  }
}

export type SummaryGroup = { key: string; name: string | null; answers: { id: string; label: string; text: string }[] };

/** Answered sections, in their groups (therapy notes have one unnamed group). */
export function summarise(template: Template, fields: Record<string, unknown>, goals: Goal[] = []): SummaryGroup[] {
  const groups = template.groups.length ? template.groups : [{ key: "", name: null as string | null }];
  return groups
    .map((g) => ({
      key: g.key,
      name: g.name,
      answers: template.fields
        .filter((f) => f.group === g.key)
        .flatMap((f) => {
          const text = answerText(f, fields[f.id], goals);
          return text ? [{ id: f.id, label: f.label, text }] : [];
        }),
    }))
    .filter((g) => g.answers.length > 0);
}

/**
 * The written note, in paragraphs separated by blank lines. `when` is the visit date and time,
 * already formatted in the clinician's time zone, e.g. "16 Oct 2026, 09:00–09:50".
 */
export function writeNote(input: {
  template: Template;
  fields: Record<string, unknown>;
  goals?: Goal[];
  firstName: string;
  when: string;
}): string {
  const { template, fields, goals = [], firstName: nm, when } = input;
  const f = (id: string) => {
    const field = template.fields.find((x) => x.id === id);
    return field ? answerText(field, fields[id], goals) : null;
  };
  const say = (id: string, fallback: string) => lc(f(id) ?? fallback);
  const risk = `Risk check: ${say("risk", "not recorded")}.`;

  if (template.groups.length) {
    const out = [opening(template, nm, when)];
    for (const g of summarise(template, fields, goals)) {
      const parts = g.answers.map((a) => {
        const field = template.fields.find((x) => x.id === a.id)!;
        return field.type === "text" ? end(a.text) : `${a.label}: ${end(a.text)}`;
      });
      out.push(`${g.name}. ${parts.join(" ")}`);
    }
    return out.join("\n\n");
  }

  const care: Care = template.care;
  const paragraphs = (() => {
    switch (care) {
      case "couples":
        return [
          `${nm} attended a couples therapy session on ${when} (${say("attended", "attendance not recorded")}). The session focused on ${say("focus", "nothing recorded")}, using ${f("approach") ?? "no approaches recorded"}.`,
          end(f("session") ?? ""),
          risk,
          `Plan: ${end(f("plan") ?? "none recorded")}`,
        ];
      case "assessment":
        return [
          `${nm} attended an initial assessment on ${when}.`,
          `Reason for referral: ${end(f("reason") ?? "not recorded")} ${nm} presented as ${say("presented", "not recorded")}.`,
          `History: ${end(f("history") ?? "not recorded")}`,
          risk,
          `Formulation: ${end(f("formulation") ?? "not recorded")} Recommendation: ${say("recommend", "none")}.`,
        ];
      case "followup":
        return [
          `Follow-up call with ${nm} on ${when} (${say("callreason", "reason not recorded")}).`,
          end(f("update") ?? ""),
          risk,
          `Next step: ${end(f("next") ?? "none recorded")}`,
        ];
      default:
        return [
          `${nm} attended an individual therapy session on ${when}. Mood presented as ${say("mood", "not recorded")}. The session focused on ${say("focus", "nothing recorded")}, using ${f("approach") ?? "no approaches recorded"}.`,
          end(f("session") ?? ""),
          risk,
          `Plan: ${end(f("plan") ?? "none recorded")}`,
        ];
    }
  })();
  return paragraphs.filter((p) => p && p !== ".").join("\n\n");
}

const CARE_WORDS: Record<Care, string> = {
  pt: "physical therapy",
  ot: "occupational therapy",
  st: "speech therapy",
  rn: "skilled nursing",
  hha: "home health aide",
  individual: "individual therapy",
  couples: "couples therapy",
  assessment: "assessment",
  followup: "follow-up",
};

function opening(template: Template, nm: string, when: string) {
  const care = CARE_WORDS[template.care];
  switch (template.kind) {
    case "evaluation":
      return `${nm} had ${article(care)} ${care} initial evaluation on ${when}.`;
    case "oasis":
      return `${nm} had an OASIS assessment (${care}) on ${when}.`;
    case "service_plan":
      return `Aide service plan for ${nm}, written on ${when}.`;
    default:
      return `${nm} had ${article(care)} ${care} visit on ${when}.`;
  }
}

const article = (s: string) => (/^[aeiou]/i.test(s) ? "an" : "a");
