import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicians, invoiceItems, invoices, patients, practices } from "@/db/schema";
import { formatMoney } from "@/lib/countries";
import { formatDuration } from "@/lib/format";
import { DetailGrid, FERN, Footer, kit, Letterhead, RunningHeader, Section, Table } from "@/lib/pdf-kit";
import { PDF_FONT } from "@/lib/pdf-fonts";
import { parseLogoDataUrl } from "@/lib/practice-logo";

// Invoice PDF with the practice letterhead, built from the shared blocks in pdf-kit (bold ruled
// headings, a table with even lines, page numbers). Times print in the clinician's time zone
// (saved from their browser), else UTC.

const s = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  title: { fontWeight: "bold", fontSize: 22, lineHeight: 1.2, letterSpacing: 1, textAlign: "right" },
  meta: { textAlign: "right", marginTop: 2 },
  total: { flexDirection: "row", justifyContent: "flex-end", alignItems: "baseline", marginTop: 12, gap: 24 },
  totalValue: { fontWeight: "bold", fontSize: 14, color: FERN },
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
    // No patient when the invoice covers several: then it's billed to the practice.
    .leftJoin(patients, eq(patients.id, invoices.patientId))
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
      patientName: patients.fullName,
    })
    .from(invoiceItems)
    .innerJoin(appointments, eq(appointments.id, invoiceItems.appointmentId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
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

  const number = invoiceNumberLabel(data.number);
  // Several patients: the clinician bills the practice, and each visit row names its patient.
  const several = data.patientName === null;
  const patientCount = new Set(data.items.map((i) => i.patientName)).size;
  const billTo = data.patientName ?? data.practiceName;
  const money = (minor: number) => formatMoney(minor, data.country, data.currency);

  return (
    <Document title={`Invoice ${number}`} author={data.practiceName}>
      <Page size="A4" style={[kit.page, { fontFamily: PDF_FONT }]}>
        <RunningHeader left={`Invoice ${number} · ${billTo}`} right={`${day(data.createdAt)} · ${data.clinicianName}`} />
        <Footer left={`${data.practiceName} · Invoice ${number} · Thank you.`} />
        <View style={s.head}>
          <Letterhead logo={logo} name={data.practiceName} lines={[data.clinicianName, data.clinicianEmail]} />
          <View>
            <Text style={s.title}>INVOICE</Text>
            <Text style={s.meta}>
              <Text style={kit.bold}>No. </Text>
              {number}
            </Text>
          </View>
        </View>

        <Section title="Invoice details" keepTogether>
          <DetailGrid
            rows={[
              ["Invoice date", day(data.createdAt)],
              ["Payment due", data.dueLabel],
              ["Bill to", billTo],
              ...(several ? [["Patients", String(patientCount)] as [string, string]] : []),
              ...(data.patientPhone ? [["Phone", data.patientPhone] as [string, string]] : []),
              ...(data.patientAddress ? [["Address", data.patientAddress] as [string, string]] : []),
            ]}
          />
        </Section>

        <Section title="Visits">
          <Table
            columns={[
              { label: "Date", width: several ? "15%" : "20%" },
              ...(several ? [{ label: "Patient", width: "20%" }] : []),
              { label: "Service", width: several ? "27%" : "40%" },
              { label: "Time in – out", width: "20%" },
              { label: "Amount", width: several ? "18%" : "20%", align: "right" as const },
            ]}
            rows={[
              ...data.items.map((item) => [
                day(item.startsAt),
                ...(several ? [item.patientName] : []),
                `${item.typeOfCare} (${formatDuration(item.durationMinutes)})`,
                `${time(item.timeIn ?? item.startsAt)}${item.timeOut ? ` – ${time(item.timeOut)}` : ""}`,
                money(item.feeMinor),
              ]),
            ]}
          />
          <View style={s.total} wrap={false}>
            <Text style={kit.bold}>
              Total ({data.items.length} visit{data.items.length === 1 ? "" : "s"})
            </Text>
            <Text style={s.totalValue}>{money(data.totalMinor)}</Text>
          </View>
        </Section>
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
