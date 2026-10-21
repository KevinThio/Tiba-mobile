import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicians, diagnosisCodes, noteAddenda, notes, noteVersions, patients, practices } from "@/db/schema";
import { CARE_LABEL, noteTitle, type Care } from "@/lib/note-templates";
import { PDF_FONT } from "@/lib/pdf-fonts";
import { parseLogoDataUrl } from "@/lib/practice-logo";
import { isValidTimeZone } from "@/lib/reminders";
import { isSignatureImage } from "@/lib/signature";

// Signed note PDF with the practice letterhead (same layout as NoteLetterhead and the invoice
// PDF): the written note, both signatures, then any addenda in date order. Only signed notes.

const FERN = "#2D6A4F";
const FERN_PALE = "#E6F2EB";
const INK = "#25282D";
const MUTED = "#686D76";
const BORDER = "#DFE0E5";
const AMBER = "#F3DCA3";

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingHorizontal: 48, paddingBottom: 64, fontFamily: PDF_FONT, fontSize: 10.5, color: INK, lineHeight: 1.45 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: BORDER },
  logo: { height: 52, maxWidth: 110, objectFit: "contain" },
  practice: { fontFamily: PDF_FONT, fontWeight: "bold", fontSize: 16, color: FERN, lineHeight: 1.2, marginBottom: 2 },
  muted: { color: MUTED },
  title: { fontFamily: PDF_FONT, fontWeight: "bold", fontSize: 18, color: FERN, marginTop: 22, lineHeight: 1.2 },
  subtitle: { color: MUTED, marginTop: 4 },
  details: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, padding: 12, backgroundColor: FERN_PALE, borderRadius: 6 },
  detail: { width: "33%", paddingVertical: 4, paddingRight: 8 },
  label: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  bold: { fontFamily: PDF_FONT, fontWeight: "bold" },
  body: { marginTop: 18 },
  para: { marginBottom: 9 },
  sigs: { flexDirection: "row", gap: 16, marginTop: 18 },
  sig: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10 },
  sigBox: { height: 58, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 4 },
  sigImage: { maxHeight: 54, maxWidth: "100%", objectFit: "contain" },
  sigLine: { fontSize: 9, gap: 1 },
  amended: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: AMBER, borderRadius: 6, gap: 2 },
  addenda: { marginTop: 22, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  addendum: { marginTop: 10 },
  footer: { position: "absolute", left: 48, right: 48, bottom: 32, fontSize: 8, color: MUTED },
});

/** Whose PDFs may be read: one clinician's own, or (for the admin) the whole practice's. */
export type PdfScope = { clinicianId: string } | { practiceId: string };

export async function loadNoteForPdf(appointmentId: string, scope: PdfScope) {
  const [note] = await db
    .select({
      noteId: notes.id,
      kind: notes.kind,
      care: notes.care,
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
      patientName: patients.fullName,
      dateOfBirth: patients.dateOfBirth,
      practiceName: practices.name,
      logo: practices.logo,
      clinicianName: clinicians.name,
      savedTimeZone: clinicians.timeZone,
    })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(practices, eq(practices.id, clinicians.practiceId))
    .leftJoin(diagnosisCodes, eq(diagnosisCodes.code, notes.dxCode))
    .where(
      and(
        eq(notes.appointmentId, appointmentId),
        "clinicianId" in scope ? eq(appointments.clinicianId, scope.clinicianId) : eq(clinicians.practiceId, scope.practiceId),
        isNotNull(notes.signedAt),
      ),
    );
  if (!note?.signedAt) return null;
  const addenda = await db
    .select({ body: noteAddenda.body, createdAt: noteAddenda.createdAt })
    .from(noteAddenda)
    .where(eq(noteAddenda.noteId, note.noteId))
    .orderBy(asc(noteAddenda.createdAt));
  const versions = await db
    .select({ version: noteVersions.version, signedAt: noteVersions.signedAt, reason: noteVersions.amendmentReason })
    .from(noteVersions)
    .where(eq(noteVersions.noteId, note.noteId))
    .orderBy(asc(noteVersions.version));
  return { ...note, signedAt: note.signedAt, addenda, versions };
}

type NoteData = NonNullable<Awaited<ReturnType<typeof loadNoteForPdf>>>;

function NoteDocument({ data, timeZone }: { data: NoteData; timeZone: string }) {
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const stamp = (d: Date) => `${day(d)}, ${time(d)}`;
  const logo = data.logo && parseLogoDataUrl(data.logo) ? data.logo : null;
  const care = data.care as Care;
  const title = noteTitle(data.kind, care);
  const from = data.timeIn ?? data.startsAt;
  const to = data.timeOut ?? new Date(data.startsAt.getTime() + data.durationMinutes * 60_000);
  const dob = new Date(`${data.dateOfBirth}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const paragraphs = data.body.split(/\n{2,}/).filter((p) => p.trim());
  const signatures = [
    { label: "Clinician", name: data.clinicianName, image: data.clinicianSignature },
    { label: "Patient", name: data.patientName, image: data.patientSignature },
  ];

  return (
    <Document title={`${title} · ${day(from)}`} author={data.practiceName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {logo && <Image src={logo} style={s.logo} />}
          <View>
            <Text style={s.practice}>{data.practiceName}</Text>
            <Text style={s.muted}>{data.clinicianName}</Text>
          </View>
        </View>

        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>
          {CARE_LABEL[care]}
          {data.dxCode ? ` · ${data.dxCode} ${data.dxDescription ?? ""}`.trimEnd() : ""}
        </Text>

        {data.version > 1 && (
          <View style={s.amended}>
            <Text style={s.bold}>Amended note · version {data.version}</Text>
            {data.amendmentReason && <Text>Reason: {data.amendmentReason}</Text>}
            <Text style={s.muted}>
              {data.versions.map((v) => `Version ${v.version} signed ${stamp(v.signedAt)}`).join(" · ")}. Earlier versions are
              kept in Tiba.
            </Text>
          </View>
        )}

        <View style={s.details}>
          <View style={s.detail}>
            <Text style={s.label}>Patient</Text>
            <Text style={s.bold}>{data.patientName}</Text>
          </View>
          <View style={s.detail}>
            <Text style={s.label}>Date of birth</Text>
            <Text>{dob}</Text>
          </View>
          <View style={s.detail}>
            <Text style={s.label}>Clinician</Text>
            <Text>{data.clinicianName}</Text>
          </View>
          <View style={s.detail}>
            <Text style={s.label}>Date</Text>
            <Text>{day(from)}</Text>
          </View>
          <View style={s.detail}>
            <Text style={s.label}>{data.timeIn && data.timeOut ? "Time in and out" : "Booked for"}</Text>
            <Text>
              {time(from)}–{time(to)}
            </Text>
          </View>
          <View style={s.detail}>
            <Text style={s.label}>Signed</Text>
            <Text>{stamp(data.signedAt)}</Text>
          </View>
        </View>

        <View style={s.body}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={s.para}>
              {p}
            </Text>
          ))}
        </View>

        <View style={s.sigs} wrap={false}>
          {signatures.map((sig) => (
            <View key={sig.label} style={s.sig}>
              <Text style={s.label}>{sig.label}</Text>
              <View style={s.sigBox}>
                {sig.image && isSignatureImage(sig.image) ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
                  <Image src={sig.image} style={s.sigImage} />
                ) : (
                  <Text style={s.muted}>Didn&apos;t sign</Text>
                )}
              </View>
              <View style={s.sigLine}>
                <Text style={s.bold}>{sig.name}</Text>
                {sig.image && <Text style={s.muted}>Signed electronically {stamp(data.signedAt)}</Text>}
              </View>
            </View>
          ))}
        </View>

        {data.addenda.length > 0 && (
          <View style={s.addenda}>
            <Text style={[s.bold, { color: FERN, fontSize: 12 }]}>Addenda</Text>
            {data.addenda.map((a, i) => (
              <View key={i} style={s.addendum} wrap={false}>
                <Text style={s.label}>
                  Added {stamp(a.createdAt)} by {data.clinicianName}
                </Text>
                <Text>{a.body}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer} fixed>
          {data.practiceName} · {title} · {data.patientName} · Signed and locked
        </Text>
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
