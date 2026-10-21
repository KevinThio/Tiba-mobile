import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicians, invoiceItems, invoices, patients, practices } from "@/db/schema";
import { formatMoneyForPdf } from "@/lib/countries";
import { parseLogoDataUrl } from "@/lib/practice-logo";

// Invoice PDF with the practice letterhead (same content as NoteLetterhead on screen).
// Times print in the clinician's time zone (saved from their browser), else UTC.

const FERN = "#2D6A4F";
const FERN_PALE = "#E6F2EB";
const INK = "#25282D";
const MUTED = "#686D76";
const BORDER = "#DFE0E5";

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: INK },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: BORDER },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, maxWidth: 320 },
  logo: { height: 52, maxWidth: 110, objectFit: "contain" },
  practice: { fontFamily: "Helvetica-Bold", fontSize: 16, color: FERN },
  muted: { color: MUTED },
  title: { fontFamily: "Helvetica-Bold", fontSize: 20, color: FERN, textAlign: "right" },
  meta: { textAlign: "right", marginTop: 4, color: MUTED },
  section: { marginTop: 22 },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { marginTop: 22, borderWidth: 1, borderColor: BORDER, borderRadius: 6 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER },
  th: { flexDirection: "row", backgroundColor: FERN_PALE },
  cell: { paddingVertical: 8, paddingHorizontal: 10 },
  cDate: { width: "22%" },
  cService: { width: "38%" },
  cTimes: { width: "22%" },
  cAmount: { width: "18%", textAlign: "right" },
  total: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14, gap: 24 },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 13, color: FERN },
  footer: { position: "absolute", left: 48, right: 48, bottom: 36, fontSize: 8, color: MUTED, textAlign: "center" },
});

export const invoiceNumberLabel = (n: number) => String(n).padStart(4, "0");

/** Whose invoices may be read: one clinician's own, or (for the admin) the whole practice's. */
export type InvoiceScope = { clinicianId: string } | { practiceId: string };

export async function loadInvoiceForPdf(invoiceId: string, scope: InvoiceScope) {
  const [head] = await db
    .select({
      number: invoices.number,
      createdAt: invoices.createdAt,
      totalMinor: invoices.totalMinor,
      currency: invoices.currency,
      dueDate: invoices.dueDate,
      country: practices.country,
      practiceName: clinicians.practiceName,
      clinicianName: clinicians.name,
      clinicianEmail: clinicians.email,
      logo: practices.logo,
      timeZone: clinicians.timeZone,
      patientName: patients.fullName,
      patientAddress: patients.address,
      patientPhone: patients.phone,
    })
    .from(invoices)
    .innerJoin(clinicians, eq(clinicians.id, invoices.clinicianId))
    .innerJoin(practices, eq(practices.id, clinicians.practiceId))
    .innerJoin(patients, eq(patients.id, invoices.patientId))
    .where(
      and(
        eq(invoices.id, invoiceId),
        "clinicianId" in scope ? eq(invoices.clinicianId, scope.clinicianId) : eq(clinicians.practiceId, scope.practiceId),
      ),
    );
  if (!head) return null;
  const items = await db
    .select({
      startsAt: appointments.startsAt,
      typeOfCare: appointments.typeOfCare,
      durationMinutes: appointments.durationMinutes,
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      feeMinor: invoiceItems.feeMinor,
    })
    .from(invoiceItems)
    .innerJoin(appointments, eq(appointments.id, invoiceItems.appointmentId))
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(appointments.startsAt));
  // "On receipt" when due the day it was made, otherwise the date ("30 Nov 2026").
  const made = head.createdAt.toLocaleDateString("en-CA", { timeZone: head.timeZone ?? "UTC" });
  const dueLabel =
    !head.dueDate || head.dueDate <= made
      ? "On receipt"
      : new Date(`${head.dueDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return { ...head, items, dueLabel };
}

type InvoiceData = NonNullable<Awaited<ReturnType<typeof loadInvoiceForPdf>>>;

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const timeZone = data.timeZone ?? "UTC";
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone });
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const logo = data.logo && parseLogoDataUrl(data.logo) ? data.logo : null;

  return (
    <Document title={`Invoice ${invoiceNumberLabel(data.number)}`} author={data.practiceName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.brand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {logo && <Image src={logo} style={s.logo} />}
            <View>
              <Text style={s.practice}>{data.practiceName}</Text>
              <Text style={s.muted}>{data.clinicianName}</Text>
              <Text style={s.muted}>{data.clinicianEmail}</Text>
            </View>
          </View>
          <View>
            <Text style={s.title}>INVOICE</Text>
            <Text style={s.meta}>No. {invoiceNumberLabel(data.number)}</Text>
            <Text style={s.meta}>{day(data.createdAt)}</Text>
            <Text style={s.meta}>Payment due: {data.dueLabel}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Bill to</Text>
          <Text style={s.bold}>{data.patientName}</Text>
          {data.patientAddress && <Text style={s.muted}>{data.patientAddress}</Text>}
          {data.patientPhone && <Text style={s.muted}>{data.patientPhone}</Text>}
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.cell, s.cDate, s.bold]}>Date</Text>
            <Text style={[s.cell, s.cService, s.bold]}>Service</Text>
            <Text style={[s.cell, s.cTimes, s.bold]}>Time in – out</Text>
            <Text style={[s.cell, s.cAmount, s.bold]}>Amount</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <Text style={[s.cell, s.cDate]}>{day(item.startsAt)}</Text>
              <Text style={[s.cell, s.cService]}>
                {item.typeOfCare} ({item.durationMinutes} min)
              </Text>
              <Text style={[s.cell, s.cTimes]}>
                {item.timeIn ? time(item.timeIn) : time(item.startsAt)} – {item.timeOut ? time(item.timeOut) : "–"}
              </Text>
              <Text style={[s.cell, s.cAmount]}>{formatMoneyForPdf(item.feeMinor, data.country, data.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={s.total}>
          <Text style={s.muted}>
            Total ({data.items.length} visit{data.items.length === 1 ? "" : "s"})
          </Text>
          <Text style={s.totalValue}>{formatMoneyForPdf(data.totalMinor, data.country, data.currency)}</Text>
        </View>

        <Text style={s.footer} fixed>
          {data.practiceName} · Invoice {invoiceNumberLabel(data.number)} · Thank you.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoiceId: string, scope: InvoiceScope) {
  const data = await loadInvoiceForPdf(invoiceId, scope);
  if (!data) return null;
  const pdf = await renderToBuffer(<InvoiceDocument data={data} />);
  return { pdf, data };
}
