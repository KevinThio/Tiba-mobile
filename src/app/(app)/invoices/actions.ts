"use server";

import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clinicians, invoiceItems, invoices, notes, patients } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { EmailNotConfiguredError, renderEmail, sendEmail } from "@/lib/email";
import { formatFee } from "@/lib/format";
import { invoiceNumberLabel, renderInvoicePdf } from "@/lib/invoice-pdf";
import { isValidTimeZone } from "@/lib/reminders";
import { PERIODS, type Period } from "./periods";


export type InvoiceableVisit = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  typeOfCare: string;
  feeMinor: number;
  patientId: string;
  patientName: string;
  invoiceEmail: string | null;
  signed: boolean;
  timeIn: string | null;
  timeOut: string | null;
  invoiceNumber: number | null;
};

/** Every visit from the chosen period up to now, newest first, with its invoice (if any). */
export async function listVisitsForInvoicing(period: Period): Promise<InvoiceableVisit[]> {
  const clinician = await requireClinician();
  const days = PERIODS[z.enum(Object.keys(PERIODS) as [Period, ...Period[]]).parse(period)];
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      typeOfCare: appointments.typeOfCare,
      feeMinor: appointments.feeMinor,
      patientId: patients.id,
      patientName: patients.fullName,
      invoiceEmail: patients.invoiceEmail,
      signed: isNotNull(notes.signedAt),
      timeIn: appointments.timeIn,
      timeOut: appointments.timeOut,
      invoiceNumber: invoices.number,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .leftJoin(invoiceItems, eq(invoiceItems.appointmentId, appointments.id))
    .leftJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(and(eq(appointments.clinicianId, clinician.id), gte(appointments.startsAt, since), lte(appointments.startsAt, now)))
    .orderBy(desc(appointments.startsAt));

  return rows.map((r) => ({
    ...r,
    startsAt: r.startsAt.toISOString(),
    signed: Boolean(r.signed),
    timeIn: r.timeIn?.toISOString() ?? null,
    timeOut: r.timeOut?.toISOString() ?? null,
  }));
}

export type InvoiceSummary = {
  id: string;
  number: number;
  patientName: string;
  createdAt: string;
  totalMinor: number;
  visits: number;
  sentTo: string | null;
  sentAt: string | null;
};

export async function listInvoices(): Promise<InvoiceSummary[]> {
  const clinician = await requireClinician();
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      patientName: patients.fullName,
      createdAt: invoices.createdAt,
      totalMinor: invoices.totalMinor,
      sentTo: invoices.sentTo,
      sentAt: invoices.sentAt,
      visits: db.$count(invoiceItems, eq(invoiceItems.invoiceId, invoices.id)),
    })
    .from(invoices)
    .innerJoin(patients, eq(patients.id, invoices.patientId))
    .where(eq(invoices.clinicianId, clinician.id))
    .orderBy(desc(invoices.number))
    .limit(20);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null }));
}

const emailSchema = z.email("That email address doesn't look quite right. Please check it.").max(254);

const createSchema = z.object({
  appointmentIds: z.array(z.uuid()).min(1, "Tick at least one visit.").max(200),
  email: z.union([z.literal(""), emailSchema]).optional(),
  timeZone: z.string().refine(isValidTimeZone).optional(),
});

type EmailOutcome = { emailed: true; to: string } | { emailed: false; emailError?: string };
export type CreateInvoiceResult = ({ ok: true; invoiceId: string; number: number } & EmailOutcome) | { ok: false; message: string };

export async function createInvoice(input: z.input<typeof createSchema>): Promise<CreateInvoiceResult> {
  const clinician = await requireClinician();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details." };
  const ids = [...new Set(parsed.data.appointmentIds)];
  const email = parsed.data.email || null;

  const created = await db.transaction(async (tx) => {
    const visits = await tx
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        startsAt: appointments.startsAt,
        feeMinor: appointments.feeMinor,
        invoiced: invoiceItems.invoiceId,
      })
      .from(appointments)
      .leftJoin(invoiceItems, eq(invoiceItems.appointmentId, appointments.id))
      .where(and(eq(appointments.clinicianId, clinician.id), inArray(appointments.id, ids)));

    if (visits.length !== ids.length) return { ok: false as const, message: "Some of those visits couldn't be found. Please refresh and try again." };
    if (new Set(visits.map((v) => v.patientId)).size > 1) return { ok: false as const, message: "An invoice is for one patient. Please tick visits for one patient at a time." };
    if (visits.some((v) => v.invoiced)) return { ok: false as const, message: "One of those visits is already on an invoice. Please refresh and try again." };
    if (visits.some((v) => v.startsAt > new Date())) return { ok: false as const, message: "Only visits that have happened can be invoiced." };

    // Gap-free numbering: take the next number in this transaction.
    const [{ number }] = await tx
      .update(clinicians)
      .set({
        lastInvoiceNumber: sql`${clinicians.lastInvoiceNumber} + 1`,
        ...(parsed.data.timeZone && { timeZone: parsed.data.timeZone }),
      })
      .where(eq(clinicians.id, clinician.id))
      .returning({ number: clinicians.lastInvoiceNumber });

    const totalMinor = visits.reduce((sum, v) => sum + v.feeMinor, 0);
    const [invoice] = await tx
      .insert(invoices)
      .values({ clinicianId: clinician.id, number, patientId: visits[0].patientId, totalMinor })
      .returning({ id: invoices.id });
    await tx.insert(invoiceItems).values(visits.map((v) => ({ invoiceId: invoice.id, appointmentId: v.id, feeMinor: v.feeMinor })));
    if (email) await tx.update(patients).set({ invoiceEmail: email }).where(eq(patients.id, visits[0].patientId));

    return { ok: true as const, invoiceId: invoice.id, number };
  });

  if (!created.ok) return created;
  revalidatePath("/invoices");
  if (!email) return { ...created, emailed: false };
  return { ...created, ...(await sendInvoiceEmail(created.invoiceId, clinician.id, email)) };
}

/** Email an existing invoice (again), e.g. to a different address. */
export async function emailInvoice(input: { invoiceId: string; email: string }): Promise<{ ok: true; to: string } | { ok: false; message: string }> {
  const clinician = await requireClinician();
  const parsed = z.object({ invoiceId: z.uuid(), email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the email address." };
  const outcome = await sendInvoiceEmail(parsed.data.invoiceId, clinician.id, parsed.data.email);
  revalidatePath("/invoices");
  return outcome.emailed ? { ok: true, to: outcome.to } : { ok: false, message: outcome.emailError ?? "We couldn't send it." };
}

async function sendInvoiceEmail(invoiceId: string, clinicianId: string, to: string): Promise<EmailOutcome> {
  try {
    const rendered = await renderInvoicePdf(invoiceId, clinicianId);
    if (!rendered) return { emailed: false, emailError: "We couldn't find that invoice." };
    const { pdf, data } = rendered;
    const label = invoiceNumberLabel(data.number);
    const { html, text } = renderEmail({
      heading: `Invoice ${label}`,
      intro: `Please find attached invoice ${label} from ${data.practiceName}.`,
      rows: [
        ["Total", formatFee(data.totalMinor)],
        ["Visits", String(data.items.length)],
      ],
      outro: `Any questions? Just reply to ${data.clinicianEmail}.`,
    });
    await sendEmail({
      to,
      subject: `Invoice ${label} from ${data.practiceName}`,
      html,
      text,
      attachments: [{ filename: `invoice-${label}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
    await db
      .update(invoices)
      .set({ sentTo: to, sentAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.clinicianId, clinicianId)));
    await db
      .update(patients)
      .set({ invoiceEmail: to })
      .where(inArray(patients.id, db.select({ id: invoices.patientId }).from(invoices).where(eq(invoices.id, invoiceId))));
    return { emailed: true, to };
  } catch (error) {
    return {
      emailed: false,
      emailError:
        error instanceof EmailNotConfiguredError
          ? "Email isn't set up yet, so the invoice wasn't sent."
          : "The invoice is saved, but we couldn't email it just now. You can send it from the list below.",
    };
  }
}
