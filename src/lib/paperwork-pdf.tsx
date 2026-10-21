import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { practices } from "@/db/schema";
import { agreementStatus, loadAgreement } from "@/lib/agreements";
import { ageFrom } from "@/lib/format";
import { CARE_LABEL, careFromTypeOfCare, type Care } from "@/lib/note-templates";
import { SERVICES } from "@/lib/patient-options";
import { careTeam, patientRecord } from "@/lib/patients";
import { PDF_FONT } from "@/lib/pdf-fonts";
import { parseLogoDataUrl } from "@/lib/practice-logo";
import { isSignatureImage } from "@/lib/signature";

// PDFs for the paperwork screens: a fully signed service agreement (admin) and the patient record
// (clinician). Same letterhead as the invoice and note PDFs.

const FERN = "#2D6A4F";
const FERN_PALE = "#E6F2EB";
const INK = "#25282D";
const MUTED = "#686D76";
const BORDER = "#DFE0E5";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingHorizontal: 48, paddingBottom: 60, fontFamily: PDF_FONT, fontSize: 10.5, color: INK, lineHeight: 1.45 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  logo: { height: 48, maxWidth: 100, objectFit: "contain" },
  practice: { fontWeight: "bold", fontSize: 15, color: FERN, lineHeight: 1.2 },
  muted: { color: MUTED },
  title: { fontWeight: "bold", fontSize: 17, color: FERN, marginTop: 20, lineHeight: 1.2 },
  h: { fontWeight: "bold", color: FERN, marginTop: 12 },
  label: { fontSize: 7.5, color: MUTED, letterSpacing: 0.6, marginBottom: 2 },
  box: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, padding: 10, backgroundColor: FERN_PALE, borderRadius: 6 },
  cell: { width: "33%", paddingVertical: 3, paddingRight: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  sigs: { flexDirection: "row", gap: 16, marginTop: 22 },
  sig: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10 },
  sigBox: { height: 56, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 4 },
  sigImage: { maxHeight: 52, maxWidth: "100%", objectFit: "contain" },
  footer: { position: "absolute", left: 48, right: 48, bottom: 30, fontSize: 8, color: MUTED },
});

const day = (d: Date | string | null, tz = "UTC") =>
  d ? new Date(typeof d === "string" && d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz }) : "";

async function letterhead(practiceId: string) {
  const [p] = await db
    .select({ name: practices.name, logo: practices.logo, address: practices.letterheadAddress, phone: practices.letterheadPhone, email: practices.letterheadEmail })
    .from(practices)
    .where(eq(practices.id, practiceId));
  return {
    name: p?.name ?? "",
    logo: p?.logo && parseLogoDataUrl(p.logo) ? p.logo : null,
    contact: [p?.address, p?.phone, p?.email].filter((x): x is string => Boolean(x?.trim())).join(" · "),
  };
}

function Head({ lh }: { lh: Awaited<ReturnType<typeof letterhead>> }) {
  return (
    <View style={s.head}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {lh.logo && <Image src={lh.logo} style={s.logo} />}
      <View>
        <Text style={s.practice}>{lh.name}</Text>
        {lh.contact && <Text style={s.muted}>{lh.contact}</Text>}
      </View>
    </View>
  );
}

/** A fully signed service agreement, for the admin. */
export async function renderAgreementPdf(patientId: string, practiceId: string) {
  const found = await loadAgreement(patientId, practiceId);
  if (!found?.agreement || agreementStatus(found.agreement) !== "signed") return null;
  const a = found.agreement;
  const lh = await letterhead(practiceId);
  const signers = [
    { label: "PATIENT", name: found.patient.fullName, image: a.patientSignature!, at: a.patientSignedAt },
    { label: "PRACTICE ADMIN", name: a.adminSignedName ?? "", image: a.adminSignature!, at: a.adminSignedAt },
  ];
  const pdf = await renderToBuffer(
    <Document title="Service agreement" author={lh.name}>
      <Page size="A4" style={s.page}>
        <Head lh={lh} />
        <Text style={s.title}>Service agreement</Text>
        <Text style={s.muted}>{found.parties}</Text>
        {found.sections.map((sec) => (
          <View key={sec.h} wrap={false}>
            <Text style={s.h}>{sec.h}</Text>
            <Text>{sec.text}</Text>
          </View>
        ))}
        <View style={s.sigs} wrap={false}>
          {signers.map((sg) => (
            <View key={sg.label} style={s.sig}>
              <Text style={[s.muted, { fontSize: 8 }]}>{sg.label}</Text>
              <View style={s.sigBox}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                {isSignatureImage(sg.image) && <Image src={sg.image} style={s.sigImage} />}
              </View>
              <Text style={{ fontWeight: "bold", fontSize: 9 }}>{sg.name}</Text>
              <Text style={[s.muted, { fontSize: 9 }]}>Signed electronically {day(sg.at)}</Text>
            </View>
          ))}
        </View>
        <Text style={s.footer} fixed>
          {lh.name} · Service agreement · {found.patient.fullName} · Signed by both sides
        </Text>
      </Page>
    </Document>,
  );
  return { pdf };
}

const STATUS: Record<string, string> = { upcoming: "Upcoming", "needs-note": "Needs note", "needs-plan": "Needs plan", draft: "Draft", signed: "Signed", invoiced: "Invoiced" };
const EVALUATED: { service: string; care: Care }[] = [
  { service: "RN", care: "rn" },
  { service: "PT", care: "pt" },
  { service: "OT", care: "ot" },
  { service: "ST", care: "st" },
];

/** The patient record (spec v2 Patient record → Download PDF), for the clinician: their own visits only. */
export async function renderPatientRecordPdf(patientId: string, clinician: { id: string; practiceId: string; name: string }, timeZone: string) {
  const record = await patientRecord(patientId, clinician.practiceId, clinician.id);
  if (!record || record.patient.status === "merged") return null;
  const { patient, diagnoses, visits } = record;
  const [team, lh] = await Promise.all([careTeam(patientId, clinician.practiceId), letterhead(clinician.practiceId)]);
  const ordered = SERVICES.filter((x) => patient.servicesOrdered.includes(x.value)).map((x) => x.label);
  const when = (d: Date) =>
    d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone });
  const details: [string, string][] = [
    ["PATIENT", patient.fullName],
    ["DATE OF BIRTH", `${day(patient.dateOfBirth)} · ${ageFrom(patient.dateOfBirth)}`],
    ["PHONE", patient.phone ?? "Not added"],
    ["EMAIL", patient.email ?? "Not added"],
    ["ORDERING DOCTOR", patient.orderingDoctor ?? "Not added"],
    ["ASSIGNED CLINICIAN", patient.assignedName],
  ];

  const pdf = await renderToBuffer(
    <Document title={`Patient record · ${patient.fullName}`} author={lh.name}>
      <Page size="A4" style={s.page}>
        <Head lh={lh} />
        <Text style={s.title}>Patient record</Text>
        <Text style={s.muted}>
          Prepared by {clinician.name} on {day(new Date(), timeZone)}
        </Text>
        <View style={s.box}>
          {details.map(([k, v]) => (
            <View key={k} style={s.cell}>
              <Text style={s.label}>{k}</Text>
              <Text>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={s.h}>Diagnosis codes</Text>
        <Text>{diagnoses.length ? diagnoses.map((d) => `${d.code} ${d.description}`).join("; ") : "None recorded."}</Text>
        <Text style={s.h}>Care team</Text>
        <Text>Services ordered: {ordered.length ? ordered.join(", ") : "None recorded."}</Text>
        {EVALUATED.filter((e) => patient.servicesOrdered.includes(e.service)).map((e) => {
          const ev = team.evaluations.get(e.care);
          return (
            <Text key={e.care}>
              {CARE_LABEL[e.care]}: {ev ? `${ev.goals} goals set ${day(ev.signedAt)} by ${ev.author}` : "needs an evaluation"}
            </Text>
          );
        })}
        {patient.servicesOrdered.includes("HHA") && (
          <Text>
            Aide service plan:{" "}
            {team.plan?.status === "signed" ? `signed ${day(team.plan.at)} by ${team.plan.author}` : team.plan ? `draft by ${team.plan.author}` : "needs a plan"}
          </Text>
        )}
        <Text style={s.h}>Visits with {clinician.name}</Text>
        {visits.length ? (
          visits.map((v) => (
            <View key={v.id} style={s.row} wrap={false}>
              <Text>
                {when(v.startsAt)} · {v.typeOfCare}
              </Text>
              <Text style={s.muted}>
                {/* Aide visits wait for a signed service plan, as on the record screen. */}
                {STATUS[
                  (v.status === "needs-note" || v.status === "draft") && careFromTypeOfCare(v.typeOfCare) === "hha" && team.plan?.status !== "signed"
                    ? "needs-plan"
                    : v.status
                ]}
              </Text>
            </View>
          ))
        ) : (
          <Text style={s.muted}>No visits yet.</Text>
        )}
        <Text style={s.footer} fixed>
          {lh.name} · Patient record · {patient.fullName} · Private health information
        </Text>
      </Page>
    </Document>,
  );
  return { pdf };
}
