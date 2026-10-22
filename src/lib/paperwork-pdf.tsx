import "server-only";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { practices } from "@/db/schema";
import { agreementStatus, isComplete, loadAgreement } from "@/lib/agreements";
import { ageFrom } from "@/lib/format";
import { CARE_LABEL, careFromTypeOfCare, type Care } from "@/lib/note-templates";
import { SERVICES } from "@/lib/patient-options";
import { careTeam, patientRecord } from "@/lib/patients";
import { Clause, DetailGrid, Footer, kit, Letterhead, RunningHeader, Section, Signatures, Table } from "@/lib/pdf-kit";
import { PDF_FONT, SERIF_STACK } from "@/lib/pdf-fonts";
import { parseLogoDataUrl } from "@/lib/practice-logo";

// PDFs for the paperwork screens, built from the shared blocks in pdf-kit: a complete service
// agreement (admin; the serif used for legal documents) and the patient record (clinician; sans,
// like the notes).

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

/** A complete service agreement (signed by both, or a refusal the witness recorded), for the admin. */
export async function renderAgreementPdf(patientId: string, practiceId: string) {
  const found = await loadAgreement(patientId, practiceId);
  if (!found?.agreement || !isComplete(agreementStatus(found.agreement))) return null;
  const a = found.agreement;
  const d = found.details;
  const lh = await letterhead(practiceId);
  const v = (x: string) => x.trim() || "—";
  const place = (p: { address: string; city: string; state: string; zip: string }) =>
    [p.address, p.city, [p.state, p.zip].filter(Boolean).join(" ")].filter((x) => x.trim()).join(", ") || "—";
  const included = d.services.filter((x) => x.included);
  const clientName = d.signer.kind === "responsible" && d.signer.name ? `${d.signer.name} (${d.signer.relationship})` : found.patient.fullName;
  const signedOn = a.patientSignedAt ?? a.adminSignedAt;

  const pdf = await renderToBuffer(
    <Document title="Service agreement" author={lh.name}>
      <Page size="A4" style={[kit.page, { fontFamily: SERIF_STACK, fontSize: 11 }]}>
        <RunningHeader left={`Service agreement · ${found.patient.fullName}`} right={`${signedOn ? day(signedOn) : ""} · ${lh.name}`} />
        <Footer left={`${lh.name} · Service agreement · Private health information`} />
        <Letterhead logo={lh.logo} name={lh.name} lines={[lh.contact]} />
        <Text style={[kit.title, { fontSize: 18 }]}>Service agreement</Text>
        <Text style={kit.muted}>{found.parties}</Text>
        <Section title="Client" keepTogether>
          <DetailGrid
            rows={[
              ["Client name", found.patient.fullName],
              ["Date of birth", day(found.patient.dateOfBirth)],
              ["Date of referral", found.patient.referralDate ? day(found.patient.referralDate) : "—"],
              ["Initial contact", d.client.initialContactDate ? day(d.client.initialContactDate) : "—"],
              ["Address", place(d.client)],
              ["Telephone", v(d.client.phone)],
            ]}
          />
        </Section>
        <Section title="Emergency contact" keepTogether>
          <DetailGrid
            rows={[
              ["Name", d.emergency.name ? `${d.emergency.name}${d.emergency.relationship ? ` (${d.emergency.relationship})` : ""}` : "—"],
              ["Telephone", v(d.emergency.phone)],
              ["Address", place(d.emergency)],
            ]}
          />
        </Section>
        <Section title="Insurance details" keepTogether>
          <DetailGrid
            rows={[
              ["Responsible party", v(d.insurance.responsibleParty)],
              ["Telephone", v(d.insurance.phone)],
              ["Address", place(d.insurance)],
            ]}
          />
        </Section>
        <Section title="Services" keepTogether>
          {d.serviceNeeds.trim() ? (
            <Text style={{ marginBottom: 6 }}>
              <Text style={kit.bold}>I believe my service needs to be: </Text>
              {d.serviceNeeds.trim()}
            </Text>
          ) : null}
          <Table
            columns={[
              { label: "Service", width: "20%" },
              { label: "Frequency", width: "13%" },
              { label: "Duration", width: "13%" },
              { label: "Charge", width: "13%" },
              { label: "Payer", width: "15%" },
              { label: "Payer pays", width: "13%" },
              { label: "Client pays", width: "13%" },
            ]}
            rows={(included.length ? included : d.services).map((r) => [
              r.label,
              ...[r.frequency, r.duration, r.charge, r.payer, r.payerAmount, r.clientAmount].map((x) => (r.included ? v(x) : "N/A")),
            ])}
          />
        </Section>
        <Section title="Bill rate" keepTogether>
          <Text>
            {d.rates.notApplicable
              ? "Not applicable."
              : `Weekend: ${v(d.rates.weekend.amount)} for ${v(d.rates.weekend.hours)} hours / ${v(d.rates.weekend.visits)} visits. Weekdays: ${v(d.rates.weekday.amount)} for ${v(d.rates.weekday.hours)} hours / ${v(d.rates.weekday.visits)} visits.`}
          </Text>
        </Section>
        {found.sections.map((sec) => (
          <Clause key={sec.h} title={sec.h} text={sec.text} />
        ))}
        <Section title={"The client's answers"} keepTogether>
          <DetailGrid
            rows={[
              ["Access to personal funds", d.authorizations.personalFunds === null ? "—" : d.authorizations.personalFunds ? "Yes" : "No"],
              ["Use of personal vehicle", d.authorizations.vehicle === null ? "—" : d.authorizations.vehicle ? "Yes" : "No"],
              ["Services", a.refused ? "Refused to sign" : d.decision === "accept" ? "Accepted" : d.decision === "deny" ? "Denied" : "—"],
              ["Initials", v(d.initials)],
            ]}
          />
        </Section>
        <Section title="Signatures" keepTogether>
          <Signatures
            signers={[
              {
                image: a.refused ? null : a.patientSignature,
                empty: a.refused ? "Refused to sign" : "",
                lines: [
                  [d.signer.kind === "responsible" && !a.refused ? "Responsible party" : "Client", clientName],
                  ...(a.refused ? [] : [["Electronically signed on", day(a.patientSignedAt)] as [string, string]]),
                ],
              },
              {
                image: a.adminSignature,
                lines: [
                  ["Agency witness", a.adminSignedName ?? d.witnessName],
                  ["Electronically signed on", day(a.adminSignedAt)],
                ],
              },
            ]}
          />
        </Section>
      </Page>
    </Document>,
  );
  return { pdf };
}

const STATUS: Record<string, string> = { upcoming: "Upcoming", "needs-note": "Needs note", "needs-plan": "Needs plan", draft: "Draft", signed: "Signed", invoiced: "Invoiced", missed: "Missed" };
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
    ["Date of birth", `${day(patient.dateOfBirth)} · ${ageFrom(patient.dateOfBirth)}`],
    ["Phone", patient.phone ?? "Not added"],
    ["Email", patient.email ?? "Not added"],
    ["Ordering doctor", patient.orderingDoctor ?? "Not added"],
    ["Assigned clinician", patient.assignedName],
    ["Prepared by", `${clinician.name}, ${day(new Date(), timeZone)}`],
  ];
  const plan =
    team.plan?.status === "signed" ? `Signed ${day(team.plan.at)} by ${team.plan.author}` : team.plan ? `Draft by ${team.plan.author}` : "Needs a plan";
  const care: [string, string][] = [
    ["Services ordered", ordered.length ? ordered.join(", ") : "None recorded"],
    ...EVALUATED.filter((e) => patient.servicesOrdered.includes(e.service)).map((e): [string, string] => {
      const ev = team.evaluations.get(e.care);
      return [CARE_LABEL[e.care], ev ? `${ev.goals} goals set ${day(ev.signedAt)} by ${ev.author}` : "Needs an evaluation"];
    }),
    ...(patient.servicesOrdered.includes("HHA") ? [["Aide service plan", plan] as [string, string]] : []),
  ];

  const pdf = await renderToBuffer(
    <Document title={`Patient record · ${patient.fullName}`} author={lh.name}>
      <Page size="A4" style={[kit.page, { fontFamily: PDF_FONT }]}>
        <RunningHeader left={`Patient record · ${patient.fullName}`} right={`${day(new Date(), timeZone)} · ${clinician.name}`} />
        <Footer left={`${lh.name} · Patient record · Private health information`} />
        <Letterhead logo={lh.logo} name={lh.name} lines={[lh.contact]} />
        <Text style={kit.title}>Patient record</Text>
        <Section title={patient.fullName} keepTogether>
          <DetailGrid rows={details} />
        </Section>
        <Section title="Diagnoses: ICD-10" keepTogether>
          {diagnoses.length ? (
            <Table
              columns={[
                { label: "Code", width: "18%" },
                { label: "Diagnosis", width: "82%" },
              ]}
              rows={diagnoses.map((d) => [d.code, d.description])}
            />
          ) : (
            <Text style={kit.muted}>None recorded.</Text>
          )}
        </Section>
        <Section title="Care team" keepTogether>
          <DetailGrid rows={care} />
        </Section>
        <Section title={`Visits with ${clinician.name}`}>
          {visits.length ? (
            <Table
              columns={[
                { label: "Date and time", width: "32%" },
                { label: "Type of care", width: "46%" },
                { label: "Status", width: "22%" },
              ]}
              rows={visits.map((v) => [
                when(v.startsAt),
                v.typeOfCare,
                // Aide visits wait for a signed service plan, as on the record screen.
                STATUS[
                  (v.status === "needs-note" || v.status === "draft") && careFromTypeOfCare(v.typeOfCare) === "hha" && team.plan?.status !== "signed"
                    ? "needs-plan"
                    : v.status
                ],
              ])}
            />
          ) : (
            <Text style={kit.muted}>No visits yet.</Text>
          )}
        </Section>
      </Page>
    </Document>,
  );
  return { pdf };
}
