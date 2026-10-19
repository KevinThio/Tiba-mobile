"use server";

import { and, asc, desc, eq, gte, ilike, isNotNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, notes, patients } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { parseFeeToMinor } from "@/lib/format";

export type AppointmentSummary = {
  id: string;
  startsAt: string; // ISO
  durationMinutes: number;
  typeOfCare: string;
  feeMinor: number;
  patientId: string;
  patientName: string;
  signed: boolean;
};

export type PatientOption = { id: string; fullName: string; dateOfBirth: string; phone: string | null };

const summaryColumns = {
  id: appointments.id,
  startsAt: appointments.startsAt,
  durationMinutes: appointments.durationMinutes,
  typeOfCare: appointments.typeOfCare,
  feeMinor: appointments.feeMinor,
  patientId: patients.id,
  patientName: patients.fullName,
  signed: isNotNull(notes.signedAt),
};

function toSummary(row: { startsAt: Date; signed: unknown } & Omit<AppointmentSummary, "startsAt" | "signed">) {
  return { ...row, startsAt: row.startsAt.toISOString(), signed: Boolean(row.signed) };
}

/** Appointments in [start, end), for the calendar's visible range. */
export async function listAppointments(range: { start: string; end: string }): Promise<AppointmentSummary[]> {
  const clinician = await requireClinician();
  const { start, end } = z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) }).parse(range);
  const rows = await db
    .select(summaryColumns)
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.clinicianId, clinician.id),
        gte(appointments.startsAt, new Date(start)),
        lt(appointments.startsAt, new Date(end)),
      ),
    )
    .orderBy(asc(appointments.startsAt));
  return rows.map(toSummary);
}

/** Typo-tolerant patient search. An empty query returns the most recently added patients. */
export async function searchPatients(query: string): Promise<PatientOption[]> {
  const clinician = await requireClinician();
  const q = z.string().trim().max(100).parse(query);
  const columns = { id: patients.id, fullName: patients.fullName, dateOfBirth: patients.dateOfBirth, phone: patients.phone };
  const mine = eq(patients.clinicianId, clinician.id);

  if (!q) {
    return db.select(columns).from(patients).where(mine).orderBy(desc(patients.createdAt)).limit(6);
  }
  const similarity = sql<number>`word_similarity(${q}, ${patients.fullName})`;
  const contains = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select(columns)
    .from(patients)
    .where(and(mine, or(sql`${similarity} > 0.3`, ilike(patients.fullName, contains))))
    .orderBy(desc(similarity), asc(patients.fullName))
    .limit(8);
}

/** Types of care used before, each with the fee charged most recently, to pre-fill the booking form. */
export async function getCareTypes(): Promise<{ typeOfCare: string; feeMinor: number }[]> {
  const clinician = await requireClinician();
  return db
    .selectDistinctOn([appointments.typeOfCare], { typeOfCare: appointments.typeOfCare, feeMinor: appointments.feeMinor })
    .from(appointments)
    .where(eq(appointments.clinicianId, clinician.id))
    .orderBy(appointments.typeOfCare, desc(appointments.createdAt))
    .limit(20);
}

const today = () => new Date().toISOString().slice(0, 10);

const bookingSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.coerce.number().int().min(10).max(480),
  typeOfCare: z.string().trim().min(1, "Add the type of care, for example “Individual session”.").max(100),
  fee: z.string().trim(),
  patient: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), id: z.uuid("Choose a patient from the list.") }),
    z.object({
      kind: z.literal("new"),
      fullName: z.string().trim().min(2, "Add the patient's full name.").max(200),
      dateOfBirth: z.iso
        .date("Add the patient's date of birth.")
        .refine((d) => d <= today(), "The date of birth can't be in the future."),
      gender: z.string().trim().max(50).optional(),
      phone: z.string().trim().max(50).optional(),
    }),
  ]),
});

export type BookingInput = z.input<typeof bookingSchema>;
export type BookingResult = { ok: true; appointment: AppointmentSummary } | { ok: false; message: string };

export async function createAppointment(input: BookingInput): Promise<BookingResult> {
  const clinician = await requireClinician();
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details and try again." };
  }
  const { startsAt, durationMinutes, typeOfCare, fee, patient } = parsed.data;
  const feeMinor = parseFeeToMinor(fee);
  if (feeMinor === null) {
    return { ok: false, message: "Add the fee as a number, for example 2500 or 2500.50." };
  }

  return db.transaction(async (tx) => {
    let patientRow: { id: string; fullName: string };
    if (patient.kind === "existing") {
      const [found] = await tx
        .select({ id: patients.id, fullName: patients.fullName })
        .from(patients)
        .where(and(eq(patients.id, patient.id), eq(patients.clinicianId, clinician.id)));
      if (!found) return { ok: false as const, message: "We couldn't find that patient. Please choose them again." };
      patientRow = found;
    } else {
      [patientRow] = await tx
        .insert(patients)
        .values({
          clinicianId: clinician.id,
          fullName: patient.fullName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender || null,
          phone: patient.phone || null,
        })
        .returning({ id: patients.id, fullName: patients.fullName });
    }

    const [created] = await tx
      .insert(appointments)
      .values({
        clinicianId: clinician.id,
        patientId: patientRow.id,
        startsAt: new Date(startsAt),
        durationMinutes,
        typeOfCare,
        feeMinor,
      })
      .returning();

    return {
      ok: true as const,
      appointment: {
        id: created.id,
        startsAt: created.startsAt.toISOString(),
        durationMinutes: created.durationMinutes,
        typeOfCare: created.typeOfCare,
        feeMinor: created.feeMinor,
        patientId: patientRow.id,
        patientName: patientRow.fullName,
        signed: false,
      },
    };
  });
}
