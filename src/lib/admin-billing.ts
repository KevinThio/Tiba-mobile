import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, min, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicians, invoiceEvents, invoiceItems, invoices, noteBillings, notes, patients } from "@/db/schema";
import { invoicePatientLabel } from "@/lib/invoice-patients";

// Admin queries for Completed notes, Insurance billing and Invoices (spec v2 sections 5 and
// 5b). Every one is scoped to the admin's practice through clinicians.practice_id.

const DAY = 86_400_000;
export const OVERDUE_DAYS = 30;

/** Every signed note in the practice, newest first, with whether it's been billed to insurance. */
export function completedNotes(practiceId: string) {
  return db
    .select({
      appointmentId: appointments.id,
      noteId: notes.id,
      patientName: patients.fullName,
      insurer: patients.insurer,
      clinicianId: clinicians.id,
      clinicianName: clinicians.name,
      typeOfCare: appointments.typeOfCare,
      startsAt: appointments.startsAt,
      feeMinor: appointments.feeMinor,
      currency: appointments.currency,
      signedAt: notes.signedAt,
      billedAt: noteBillings.billedAt,
    })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(noteBillings, eq(noteBillings.noteId, notes.id))
    .where(and(eq(clinicians.practiceId, practiceId), isNotNull(notes.signedAt)))
    .orderBy(desc(notes.signedAt));
}

/** Notes signed more than 30 days ago and still not billed: for Overview and the menu badge. */
export async function unbilledOverdue(practiceId: string) {
  const [row] = await db
    .select({ n: count(), oldest: min(notes.signedAt) })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .leftJoin(noteBillings, eq(noteBillings.noteId, notes.id))
    .where(
      and(
        eq(clinicians.practiceId, practiceId),
        isNotNull(notes.signedAt),
        isNull(noteBillings.noteId),
        lt(notes.signedAt, new Date(Date.now() - OVERDUE_DAYS * DAY)),
      ),
    );
  return { count: row?.n ?? 0, oldest: row?.oldest ?? null };
}

/** Every invoice the practice's clinicians have sent, newest first. */
export function practiceInvoices(practiceId: string) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      totalMinor: invoices.totalMinor,
      currency: invoices.currency,
      createdAt: invoices.createdAt,
      seenAt: invoices.seenAt,
      paidOn: invoices.paidOn,
      issueCategory: invoices.issueCategory,
      patientName: invoicePatientLabel,
      clinicianId: clinicians.id,
      clinicianName: clinicians.name,
    })
    .from(invoices)
    .innerJoin(clinicians, eq(clinicians.id, invoices.clinicianId))
    .leftJoin(patients, eq(patients.id, invoices.patientId))
    .where(eq(clinicians.practiceId, practiceId))
    .orderBy(desc(invoices.createdAt));
}

/** Counts for Overview and the Invoices menu badge. */
export async function invoiceCounts(practiceId: string) {
  const [row] = await db
    .select({
      unseen: sql<number>`count(*) filter (where ${invoices.seenAt} is null)::int`,
      issues: sql<number>`count(*) filter (where ${invoices.status} = 'issue')::int`,
    })
    .from(invoices)
    .innerJoin(clinicians, eq(clinicians.id, invoices.clinicianId))
    .where(eq(clinicians.practiceId, practiceId));
  return { unseen: row?.unseen ?? 0, issues: row?.issues ?? 0 };
}

/** One invoice with its visits and history, if it's in the practice. */
export async function invoiceDetail(invoiceId: string, practiceId: string) {
  const [invoice] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      totalMinor: invoices.totalMinor,
      currency: invoices.currency,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      sentTo: invoices.sentTo,
      seenAt: invoices.seenAt,
      paidOn: invoices.paidOn,
      paidMethod: invoices.paidMethod,
      issueCategory: invoices.issueCategory,
      issueComment: invoices.issueComment,
      issueFlaggedAt: invoices.issueFlaggedAt,
      patientName: invoicePatientLabel,
      severalPatients: sql<boolean>`${invoices.patientId} is null`,
      insurer: patients.insurer,
      clinicianId: clinicians.id,
      clinicianName: clinicians.name,
    })
    .from(invoices)
    .innerJoin(clinicians, eq(clinicians.id, invoices.clinicianId))
    .leftJoin(patients, eq(patients.id, invoices.patientId))
    .where(and(eq(invoices.id, invoiceId), eq(clinicians.practiceId, practiceId)));
  if (!invoice) return null;

  const [visits, history] = await Promise.all([
    db
      .select({
        appointmentId: appointments.id,
        startsAt: appointments.startsAt,
        typeOfCare: appointments.typeOfCare,
        feeMinor: invoiceItems.feeMinor,
        patientName: patients.fullName,
      })
      .from(invoiceItems)
      .innerJoin(appointments, eq(appointments.id, invoiceItems.appointmentId))
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(eq(invoiceItems.invoiceId, invoiceId))
      .orderBy(asc(appointments.startsAt)),
    db
      .select({ id: invoiceEvents.id, kind: invoiceEvents.kind, detail: invoiceEvents.detail, at: invoiceEvents.createdAt, actor: clinicians.name })
      .from(invoiceEvents)
      .leftJoin(clinicians, eq(clinicians.id, invoiceEvents.actorId))
      .where(eq(invoiceEvents.invoiceId, invoiceId))
      .orderBy(asc(invoiceEvents.createdAt)),
  ]);
  return { invoice, visits, history };
}

/** The practice's clinicians, for filters. */
export function practiceClinicians(practiceId: string) {
  return db
    .select({ id: clinicians.id, name: clinicians.name })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "clinician")))
    .orderBy(asc(clinicians.name));
}

/** Signed notes in the practice by appointment id, for the admin's billing actions. */
export async function signedNotesInPractice(appointmentIds: string[], practiceId: string) {
  if (!appointmentIds.length) return [];
  return db
    .select({ noteId: notes.id, appointmentId: appointments.id })
    .from(notes)
    .innerJoin(appointments, eq(appointments.id, notes.appointmentId))
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .where(and(inArray(appointments.id, appointmentIds), eq(clinicians.practiceId, practiceId), isNotNull(notes.signedAt)));
}
