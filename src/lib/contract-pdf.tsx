import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, contracts, practices } from "@/db/schema";
import { contractSections } from "@/lib/contracts";
import { PDF_FONT } from "@/lib/pdf-fonts";
import { parseImageDataUrl, parseLogoDataUrl } from "@/lib/practice-logo";
import { isSignatureImage } from "@/lib/signature";

// A signed contract as a PDF (spec v2 section 5c): the letterhead it was sent on, the clauses
// and both drawn signatures with names and dates. Signed contracts only.

const FERN = "#2D6A4F";
const INK = "#25282D";
const MUTED = "#686D76";
const BORDER = "#DFE0E5";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingHorizontal: 48, paddingBottom: 60, fontFamily: PDF_FONT, fontSize: 10.5, color: INK, lineHeight: 1.45 },
  head: { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: "row", alignItems: "center", gap: 12 },
  letterheadImage: { maxHeight: 90, objectFit: "contain", objectPosition: "left" },
  logo: { height: 48, maxWidth: 100, objectFit: "contain" },
  practice: { fontWeight: "bold", fontSize: 15, color: FERN, lineHeight: 1.2 },
  muted: { color: MUTED },
  label: { fontSize: 8, color: MUTED, letterSpacing: 0.6, marginTop: 20 },
  title: { fontWeight: "bold", fontSize: 17, color: FERN, marginTop: 2, lineHeight: 1.2 },
  section: { marginTop: 10 },
  h: { fontWeight: "bold", color: FERN },
  sigs: { flexDirection: "row", gap: 16, marginTop: 22 },
  sig: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10 },
  sigBox: { height: 56, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 4 },
  sigImage: { maxHeight: 52, maxWidth: "100%", objectFit: "contain" },
  footer: { position: "absolute", left: 48, right: 48, bottom: 30, fontSize: 8, color: MUTED },
});

export async function renderContractPdf(contractId: string, scope: { practiceId: string } | { clinicianId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(contractId)) return null;
  const [row] = await db
    .select({ k: contracts, clinicianName: clinicians.name, practiceName: practices.name, logo: practices.logo })
    .from(contracts)
    .innerJoin(clinicians, eq(clinicians.id, contracts.clinicianId))
    .innerJoin(practices, eq(practices.id, contracts.practiceId))
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.status, "signed"),
        "practiceId" in scope ? eq(contracts.practiceId, scope.practiceId) : eq(contracts.clinicianId, scope.clinicianId),
      ),
    );
  if (!row) return null;
  const { k } = row;
  const lh = k.letterhead ?? { address: "", phone: "", email: "", image: null };
  const image = lh.image && parseImageDataUrl(lh.image, 900_000) ? lh.image : null;
  const logo = row.logo && parseLogoDataUrl(row.logo) ? row.logo : null;
  const contact = [lh.address, lh.phone, lh.email].filter((x) => x.trim()).join(" · ");
  const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
  const signers = [
    { label: "PRACTICE ADMIN", name: k.adminSignedName ?? "", image: k.adminSignature, at: k.adminSignedAt },
    { label: "CLINICIAN", name: row.clinicianName, image: k.clinicianSignature, at: k.clinicianSignedAt },
  ];

  const pdf = await renderToBuffer(
    <Document title={`${k.label} ${k.type}`} author={row.practiceName}>
      <Page size="A4" style={s.page}>
        {image ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
          <Image src={image} style={s.letterheadImage} />
        ) : (
          <View style={s.head}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {logo && <Image src={logo} style={s.logo} />}
            <View>
              <Text style={s.practice}>{row.practiceName}</Text>
              {contact && <Text style={s.muted}>{contact}</Text>}
            </View>
          </View>
        )}
        <Text style={s.label}>{k.label}</Text>
        <Text style={s.title}>{k.type}</Text>
        <Text style={s.muted}>
          Between {row.practiceName} and {row.clinicianName}
        </Text>
        {contractSections(k.type, k.terms, row.clinicianName, row.practiceName).map((sec) => (
          <View key={sec.h} style={s.section} wrap={false}>
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
                {sg.image && isSignatureImage(sg.image) && <Image src={sg.image} style={s.sigImage} />}
              </View>
              <Text style={{ fontWeight: "bold", fontSize: 9 }}>{sg.name}</Text>
              <Text style={[s.muted, { fontSize: 9 }]}>Signed electronically {day(sg.at)}</Text>
            </View>
          ))}
        </View>
        <Text style={s.footer} fixed>
          {row.practiceName} · {k.label} · Signed by both sides
        </Text>
      </Page>
    </Document>,
  );
  return { pdf, label: k.label };
}
