import "server-only";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  clinicianProfiles,
  clinicians,
  diagnosisCodes,
  locations,
  noteAddenda,
  notes,
  noteVersions,
  patients,
  practices,
} from "@/db/schema";
import { disciplineLabel, isDiscipline } from "@/lib/disciplines";
import { goalsFromEvaluation } from "@/lib/note-context";
import { summarise } from "@/lib/note-summary";
import { billableUnits, CARE_LABEL, getTemplate, noteTitle, type Care, type Field, type NoteKind } from "@/lib/note-templates";
import { Answer, DetailGrid, Footer, kit, Letterhead, RunningHeader, Section, Signatures, Table } from "@/lib/pdf-kit";
import { PDF_FONT } from "@/lib/pdf-fonts";
import { parseLogoDataUrl } from "@/lib/practice-logo";
import { isValidTimeZone } from "@/lib/reminders";

// Signed note PDF, laid out like the daily notes clinicians know from therapy record systems: a
// running header, the patient's details, Diagnoses and Billing codes tables, the note's sections
// under bold ruled headings (Subjective, Objective…), the written note, signatures with the
// licence number, and any addenda. Only signed notes.

/** Whose PDFs may be read: one clinician's own, or (for the admin) the whole practice's. */
export type PdfScope = { clinicianId: string } | { practiceId: string };

export async function loadNoteForPdf(appointmentId: string, scope: PdfScope) {
  const [note] = await db
    .select({
      noteId: notes.id,
      kind: notes.kind,
      care: notes.care,
      fields: notes.fields,
      body: notes.body,
      signedAt: notes.signedAt,
      version: notes.version,
      amendmentReason: notes.amendmentReason,
      clinicianSignature: notes.clinicianSignature,
      patientSignature: notes.patientSignature,
      dxCode: notes.dxCode,
      dxDescription: diagnosisCodes.description,
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      patientId: patients.id,
      patientName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      startOfCare: patients.startOfCare,
      practiceId: practices.id,
      practiceName: practices.name,
      logo: practices.logo,
      practiceAddress: practices.letterheadAddress,
      practicePhone: practices.letterheadPhone,
      clinicianName: clinicians.name,
      discipline: clinicians.discipline,
      licenseNumber: clinicianProfiles.licenseNumber,
      locationName: locations.name,
      savedTimeZone: clinicians.timeZone,
    })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(practices, eq(practices.id, clinicians.practiceId))
    .leftJoin(clinicianProfiles, eq(clinicianProfiles.clinicianId, clinicians.id))
    .leftJoin(locations, eq(locations.id, clinicians.locationId))
    .leftJoin(diagnosisCodes, eq(diagnosisCodes.code, notes.dxCode))
    .where(
      and(
        eq(notes.appointmentId, appointmentId),
        "clinicianId" in scope ? eq(appointments.clinicianId, scope.clinicianId) : eq(clinicians.practiceId, scope.practiceId),
        isNotNull(notes.signedAt),
      ),
    );
  if (!note?.signedAt) return null;
  const [addenda, versions, evaluation] = await Promise.all([
    db
      .select({ body: noteAddenda.body, createdAt: noteAddenda.createdAt })
      .from(noteAddenda)
      .where(eq(noteAddenda.noteId, note.noteId))
      .orderBy(asc(noteAddenda.createdAt)),
    db
      .select({ version: noteVersions.version, signedAt: noteVersions.signedAt, reason: noteVersions.amendmentReason })
      .from(noteVersions)
      .where(eq(noteVersions.noteId, note.noteId))
      .orderBy(asc(noteVersions.version)),
    goalsFromEvaluation(note.patientId, note.care as Care, note.practiceId),
  ]);
  return { ...note, signedAt: note.signedAt, addenda, versions, goals: evaluation?.goals ?? [] };
}

type NoteData = NonNullable<Awaited<ReturnType<typeof loadNoteForPdf>>>;

/** Billing codes as table rows: minutes per timed code with the total and its units, or the codes billed once. */
function billingRows(field: Extract<Field, { type: "billing" }> | undefined, value: unknown) {
  if (!field || typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (field.mode === "once" || field.mode === "pickOne") {
    const rows = field.codes.filter((c) => v[c.code] === true).map((c) => [c.code, c.label, "", "1"]);
    return rows.length ? { rows, bold: [] } : null;
  }
  const used = field.codes.filter((c) => Number(v[c.code]) > 0);
  if (!used.length) return null;
  const minutes = used.reduce((sum, c) => sum + Number(v[c.code]), 0);
  const rows = used.map((c) => [c.code, c.label, String(v[c.code]), ""]);
  rows.push(["", field.mode === "units15" ? "Total (15-minute units)" : "Total timed minutes (8-minute rule)", String(minutes), String(billableUnits(minutes))]);
  return { rows, bold: [rows.length - 1] };
}

function NoteDocument({ data, timeZone }: { data: NoteData; timeZone: string }) {
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const stamp = (d: Date) => `${day(d)}, ${time(d)}`;
  const isoDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const logo = data.logo && parseLogoDataUrl(data.logo) ? data.logo : null;
  const care = data.care as Care;
  const kind = (data.kind as NoteKind | null) ?? "progress";
  const template = getTemplate(kind, care);
  // "Visit note (Physical therapy)", like the discipline in a daily note's title.
  const title = `${noteTitle(kind, care)} (${CARE_LABEL[care]})`;
  const from = data.timeIn ?? data.startsAt;
  const to = data.timeOut ?? new Date(data.startsAt.getTime() + data.durationMinutes * 60_000);
  const role = isDiscipline(data.discipline) ? disciplineLabel(data.discipline) : null;
  const groups = summarise(template, data.fields ?? {}, data.goals).filter((g) => !g.answers.some((a) => a.id === "billing"));
  const billingField = template.fields.find((f): f is Extract<Field, { type: "billing" }> => f.type === "billing");
  const billing = billingRows(billingField, data.fields?.billing);
  const paragraphs = data.body.split(/\n{2,}/).filter((p) => p.trim());

  const details: [string, string][] = [
    ["Date", day(from)],
    [data.timeIn && data.timeOut ? "Time in / out" : "Booked for", `${time(from)} – ${time(to)}${day(to) !== day(from) ? " next day" : ""}`],
    ["Date of birth", isoDay(data.dateOfBirth)],
    ["Practice", data.practiceName],
    ["Type of care", CARE_LABEL[care]],
    ["Treating clinician", role ? `${data.clinicianName} · ${role}` : data.clinicianName],
  ];
  if (data.locationName) details.push(["Location", data.locationName]);
  if (data.startOfCare) details.push(["Start of care", isoDay(data.startOfCare)]);

  return (
    <Document title={`${title} · ${day(from)}`} author={data.practiceName}>
      <Page size="A4" style={[kit.page, { fontFamily: PDF_FONT }]}>
        <RunningHeader left={`${title} · ${data.patientName}`} right={`${day(from)} · ${data.clinicianName}`} />
        <Footer left={`${data.practiceName} · Signed and locked · Private health information`} />

        <Letterhead logo={logo} name={data.practiceName} lines={[[data.practiceAddress, data.practicePhone].filter(Boolean).join(" · ")]} />
        <Text style={kit.title}>{title}</Text>

        <Section title={data.patientName}>
          <DetailGrid rows={details} />
        </Section>

        {data.version > 1 && (
          <Section title={`Amended note · version ${data.version}`} keepTogether>
            {data.amendmentReason && (
              <Text>
                <Text style={kit.bold}>Reason: </Text>
                {data.amendmentReason}
              </Text>
            )}
            <Text style={kit.muted}>
              {data.versions.map((v) => `Version ${v.version} signed ${stamp(v.signedAt)}`).join(" · ")}. Earlier versions are kept in
              Tiba.
            </Text>
          </Section>
        )}

        {data.dxCode && (
          <Section title="Diagnoses: ICD-10" keepTogether>
            <Table
              columns={[
                { label: "Code", width: "18%" },
                { label: "Diagnosis", width: "82%" },
              ]}
              rows={[[data.dxCode, data.dxDescription ?? ""]]}
            />
          </Section>
        )}

        {billing && (
          <Section title="Billing codes" keepTogether>
            <Table
              columns={[
                { label: "Code", width: "14%" },
                { label: "Description", width: "52%" },
                { label: "Minutes", width: "17%", align: "right" },
                { label: "Units", width: "17%", align: "right" },
              ]}
              rows={billing.rows}
              bold={billing.bold}
            />
          </Section>
        )}

        {groups.map((g) => (
          <Section key={g.key || "session"} title={g.name ?? "Session"}>
            {g.answers.map((a) =>
              // A section with one answer of the same name ("Plan" under Plan) needs no sub-heading.
              a.label === g.name ? (
                <Text key={a.id}>{a.text}</Text>
              ) : (
                <Answer key={a.id} label={a.label} text={a.text} />
              ),
            )}
          </Section>
        ))}

        <Section title="Written note">
          {paragraphs.map((p, i) => (
            <Text key={i} style={{ marginBottom: 6 }}>
              {p}
            </Text>
          ))}
        </Section>

        <Section title="Signatures" keepTogether>
          <Signatures
            signers={[
              {
                image: data.clinicianSignature,
                lines: [
                  ["Clinician", role ? `${data.clinicianName} · ${role}` : data.clinicianName],
                  ...(data.licenseNumber ? [["Licence #", data.licenseNumber] as [string, string]] : []),
                  ["Electronically signed on", stamp(data.signedAt)],
                ],
              },
              {
                image: data.patientSignature,
                empty: "Didn't sign",
                lines: [
                  ["Patient", data.patientName],
                  ...(data.patientSignature ? [["Signed on the device", stamp(data.signedAt)] as [string, string]] : []),
                ],
              },
            ]}
          />
        </Section>

        {data.addenda.length > 0 && (
          <Section title="Addenda">
            {data.addenda.map((a, i) => (
              <View key={i} wrap={false}>
                <Text style={kit.sub}>
                  Added {stamp(a.createdAt)} by {data.clinicianName}
                </Text>
                <Text>{a.body}</Text>
              </View>
            ))}
          </Section>
        )}

      </Page>
    </Document>
  );
}

/** The PDF, with times in `timeZone` (the viewer's), else the clinician's saved zone, else UTC. */
export async function renderNotePdf(appointmentId: string, scope: PdfScope, timeZone?: string | null) {
  const data = await loadNoteForPdf(appointmentId, scope);
  if (!data) return null;
  const zone = [timeZone, data.savedTimeZone].find((z): z is string => !!z && isValidTimeZone(z)) ?? "UTC";
  const pdf = await renderToBuffer(<NoteDocument data={data} timeZone={zone} />);
  return { pdf, data, timeZone: zone };
}
