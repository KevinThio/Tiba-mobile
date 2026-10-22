import "server-only";
import { Document, Image, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, contracts, practices } from "@/db/schema";
import { contractSections } from "@/lib/contracts";
import { Clause, Footer, kit, Letterhead, RunningHeader, Section, Signatures } from "@/lib/pdf-kit";
import { SERIF_STACK } from "@/lib/pdf-fonts";
import { parseImageDataUrl, parseLogoDataUrl } from "@/lib/practice-logo";

// A signed contract as a PDF (spec v2 section 5c): the letterhead it was sent on, the clauses
// under bold ruled headings and both drawn signatures with names and dates. Set in the serif
// (Times New Roman style) used for legal documents. Signed contracts only.

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

  const pdf = await renderToBuffer(
    <Document title={`${k.label} ${k.type}`} author={row.practiceName}>
      <Page size="A4" style={[kit.page, { fontFamily: SERIF_STACK, fontSize: 11 }]}>
        <RunningHeader left={`${k.type} · ${k.label}`} right={`${row.practiceName} · ${row.clinicianName}`} />
        <Footer left={`${row.practiceName} · ${k.label} · Signed by both sides`} />
        {image ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
          <Image src={image} style={{ maxHeight: 90, objectFit: "contain", objectPosition: "left", marginBottom: 14 }} />
        ) : (
          <Letterhead logo={logo} name={row.practiceName} lines={[contact]} />
        )}
        <Text style={[kit.title, { fontSize: 18 }]}>{k.type}</Text>
        <Text style={kit.muted}>
          {k.label} · Between {row.practiceName} and {row.clinicianName}
        </Text>
        {contractSections(k.type, k.terms, row.clinicianName, row.practiceName).map((sec) => (
          <Clause key={sec.h} title={sec.h} text={sec.text} />
        ))}
        <Section title="Signatures" keepTogether>
          <Signatures
            signers={[
              {
                image: k.adminSignature,
                lines: [
                  ["For the practice", k.adminSignedName ?? ""],
                  ["Electronically signed on", day(k.adminSignedAt)],
                ],
              },
              {
                image: k.clinicianSignature,
                lines: [
                  ["Clinician", row.clinicianName],
                  ["Electronically signed on", day(k.clinicianSignedAt)],
                ],
              },
            ]}
          />
        </Section>
      </Page>
    </Document>,
  );
  return { pdf, label: k.label };
}
