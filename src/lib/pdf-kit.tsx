import "server-only";
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { isSignatureImage } from "@/lib/signature";

// Shared building blocks for every PDF, after the layout clinicians know from therapy record
// systems: a running header on each page, bold section headings over a full-width rule, a
// two-column "Label: value" block, tables with even ruled lines, signature blocks, and "Page X of
// Y". Text styles inherit the font from the Page (sans or serif, see pdf-fonts.ts).

export const INK = "#1F2226";
export const MUTED = "#5F646C";
export const FERN = "#2D6A4F";
export const RULE = "#1F2226";
export const LINE = "#9AA0A8";

export const kit = StyleSheet.create({
  page: { paddingTop: 64, paddingHorizontal: 48, paddingBottom: 64, fontSize: 10, color: INK, lineHeight: 1.4 },
  running: { position: "absolute", top: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", gap: 16, paddingBottom: 5, borderBottomWidth: 1.2, borderBottomColor: RULE, fontSize: 8.5 },
  // Pinned from the top: react-pdf drops fixed elements positioned from the bottom. Pages are A4 (842pt).
  footer: { position: "absolute", top: 806, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", gap: 16, fontSize: 8, color: MUTED },
  letterhead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  logo: { height: 46, maxWidth: 100, objectFit: "contain" },
  practice: { fontWeight: "bold", fontSize: 15, color: FERN, lineHeight: 1.25 },
  muted: { color: MUTED },
  bold: { fontWeight: "bold" },
  title: { fontWeight: "bold", fontSize: 16, lineHeight: 1.25 },
  section: { marginTop: 16 },
  sectionTitle: { fontWeight: "bold", fontSize: 12, paddingBottom: 3, marginBottom: 7, borderBottomWidth: 1, borderBottomColor: RULE },
  sub: { fontWeight: "bold", marginTop: 6, marginBottom: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridItem: { width: "50%", flexDirection: "row", paddingVertical: 2.5, paddingRight: 10 },
  gridLabel: { width: "46%", fontWeight: "bold", paddingRight: 6 },
  gridValue: { width: "54%" },
  table: { borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: LINE },
  tr: { flexDirection: "row" },
  cell: { paddingVertical: 4, paddingHorizontal: 6, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: LINE },
  sigs: { flexDirection: "row", gap: 28, marginTop: 4 },
  sig: { flex: 1 },
  sigBox: { height: 60, justifyContent: "flex-end", paddingBottom: 3, borderBottomWidth: 0.75, borderBottomColor: RULE, marginBottom: 5 },
  sigImage: { maxHeight: 56, maxWidth: 200, objectFit: "contain", objectPosition: "left" },
});

/** Printed at the top of every page: what the document is on the left, date and who on the right. */
export function RunningHeader({ left, right }: { left: string; right: string }) {
  return (
    <View style={kit.running} fixed>
      <Text>{left}</Text>
      <Text>{right}</Text>
    </View>
  );
}

/** Printed at the bottom of every page, with "Page X of Y" on the right. */
export function Footer({ left }: { left: string }) {
  return (
    <View style={kit.footer} fixed>
      <Text>{left}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

/** Practice logo, name and a contact line, at the top of the first page. */
export function Letterhead({ logo, name, lines }: { logo: string | null; name: string; lines: string[] }) {
  return (
    <View style={kit.letterhead}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {logo && <Image src={logo} style={kit.logo} />}
      <View>
        <Text style={kit.practice}>{name}</Text>
        {lines.filter(Boolean).map((l) => (
          <Text key={l} style={kit.muted}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * A bold heading over a full-width rule, then its content. `keepTogether` keeps a short section
 * on one page; otherwise the heading moves to the next page unless a few lines fit under it.
 */
export function Section({ title, children, keepTogether = false }: { title: string; children: React.ReactNode; keepTogether?: boolean }) {
  return (
    <View style={kit.section} wrap={!keepTogether}>
      <Text style={kit.sectionTitle} minPresenceAhead={72}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Clauses of a legal document: short ones stay whole on a page, long ones may break across. */
export function Clause({ title, text }: { title: string; text: string }) {
  return (
    <Section title={title} keepTogether={text.length < 900}>
      <Text style={{ textAlign: "justify" }}>{text}</Text>
    </Section>
  );
}

/** A bold sub-heading with its text underneath. */
export function Answer({ label, text }: { label: string; text: string }) {
  return (
    <View wrap={false}>
      <Text style={kit.sub}>{label}</Text>
      <Text>{text}</Text>
    </View>
  );
}

/** "Label: value" pairs in two columns, with bold labels. */
export function DetailGrid({ rows }: { rows: [string, string][] }) {
  return (
    <View style={kit.grid}>
      {rows.map(([label, value]) => (
        <View key={label} style={kit.gridItem}>
          <Text style={kit.gridLabel}>{label}:</Text>
          <Text style={kit.gridValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export type Column = { label: string; width: string; align?: "left" | "right" };

/** A table with even ruled lines and a bold header row. `bold` rows (totals) print bold. */
export function Table({ columns, rows, bold = [] }: { columns: Column[]; rows: string[][]; bold?: number[] }) {
  const cell = (c: Column, extra?: Style) => [kit.cell, { width: c.width, textAlign: c.align ?? "left" }, ...(extra ? [extra] : [])];
  return (
    <View style={kit.table}>
      <View style={kit.tr} wrap={false}>
        {columns.map((c) => (
          <Text key={c.label} style={cell(c, kit.bold)}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={kit.tr} wrap={false}>
          {columns.map((c, j) => (
            <Text key={c.label} style={cell(c, bold.includes(i) ? kit.bold : undefined)}>
              {r[j] ?? ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export type Signer = { image: string | null; lines: [string, string][]; empty?: string };

/** Signatures side by side: the drawn signature over a rule, then bold "Label: value" lines. */
export function Signatures({ signers }: { signers: Signer[] }) {
  return (
    <View style={kit.sigs} wrap={false}>
      {signers.map((sg, i) => (
        <View key={i} style={kit.sig}>
          <View style={kit.sigBox}>
            {sg.image && isSignatureImage(sg.image) ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
              <Image src={sg.image} style={kit.sigImage} />
            ) : (
              <Text style={kit.muted}>{sg.empty ?? ""}</Text>
            )}
          </View>
          {sg.lines.map(([label, value]) => (
            <Text key={label}>
              <Text style={kit.bold}>{label}: </Text>
              {value}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
