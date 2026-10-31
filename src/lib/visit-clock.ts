import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { appointments, clinicians, notes, notifications, patients, visitClocks } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import {
  distanceMetres,
  distanceText,
  EARLY_CLOCK_IN_MS,
  FLAGGED_PLACES,
  HOME_RADIUS_M,
  placeLabel,
  type ClockPlace,
  type Position,
} from "@/lib/clock-place";
import { renderEmail, sendEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";
import { isSignatureImage } from "@/lib/signature";

// Clocking in and out of visits (electronic visit verification). The clinician clocks in on
// arrival and out before leaving, where the patient signs. In-person visits record the phone's
// position and how far it was from the patient's home; virtual visits record no position. Every
// clock-in and clock-out notifies the admins; ones away from the home (or without a position) also
// email them, without the patient's name. Rows are locked by drizzle/0036.

export type ClockRecord = { at: Date; place: ClockPlace; distanceM: number | null; accuracyM: number | null; signed: boolean };

const CLOCK_TYPES = ["clock", "clock_flag"];

const clockColumns = (t: typeof visitClocks) => ({
  at: t.at,
  place: t.place,
  distanceM: t.distanceM,
  accuracyM: t.accuracyM,
  signed: sql<boolean>`${t.patientSignature} is not null`,
});

/** A visit's clock-in and clock-out, if any. */
export async function visitClockState(appointmentId: string) {
  const rows = await db
    .select({ event: visitClocks.event, ...clockColumns(visitClocks) })
    .from(visitClocks)
    .where(eq(visitClocks.appointmentId, appointmentId));
  const pick = (event: "in" | "out"): ClockRecord | null => {
    const row = rows.find((r) => r.event === event);
    return row ? { at: row.at, place: row.place, distanceM: row.distanceM, accuracyM: row.accuracyM, signed: Boolean(row.signed) } : null;
  };
  return { in: pick("in"), out: pick("out") };
}

/**
 * Why a note can't be signed yet: the visit needs a clock-in and a clock-out first. Amendments
 * (version 2 and up) are exempt, because notes signed before clocking existed have none.
 */
export async function clockProblem(appointmentId: string, noteVersion: number) {
  if (noteVersion > 1) return null;
  const state = await visitClockState(appointmentId);
  if (!state.in) return "Clock in and out of the visit before you sign the note.";
  if (!state.out) return "Clock out of the visit before you sign the note.";
  return null;
}

type Clinician = { id: string; name: string; practiceId: string };
type ClockInput = { appointmentId: string; event: "in" | "out"; position: Position | null; patientSignature?: string | null };
export type ClockResult = { ok: true; place: ClockPlace; distanceM: number | null } | { ok: false; message: string };

const validPosition = (p: Position | null): Position | null =>
  p &&
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180 &&
  Number.isFinite(p.accuracy) &&
  p.accuracy >= 0
    ? p
    : null;

/**
 * Clocks the clinician in or out of their visit, now. Refused for missed visits and signed notes,
 * before EARLY_CLOCK_IN_MS ahead of the start, twice, or out before in. In-person clock-outs need
 * the patient's signature. Sets the visit's time in or time out to the same moment.
 */
export async function recordClock(clinician: Clinician, input: ClockInput): Promise<ClockResult> {
  const [visit] = await db
    .select({
      startsAt: appointments.startsAt,
      virtual: appointments.virtual,
      missedAt: appointments.missedAt,
      patientName: patients.fullName,
      homeLat: patients.homeLat,
      homeLng: patients.homeLng,
      signedAt: notes.signedAt,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(notes, eq(notes.appointmentId, appointments.id))
    .where(and(eq(appointments.id, input.appointmentId), eq(appointments.clinicianId, clinician.id)));
  if (!visit) return { ok: false, message: "We couldn't find that visit." };
  if (visit.missedAt) return { ok: false, message: "This visit is marked missed. If it did happen, undo that first." };
  if (visit.signedAt) return { ok: false, message: "The note is signed, so this visit can't be clocked any more." };

  const state = await visitClockState(input.appointmentId);
  const now = new Date();
  if (input.event === "in") {
    if (state.in) return { ok: false, message: "You're already clocked in. Refresh the page." };
    if (now.getTime() < visit.startsAt.getTime() - EARLY_CLOCK_IN_MS) {
      return { ok: false, message: "You can clock in from 2 hours before the visit starts." };
    }
  } else {
    if (!state.in) return { ok: false, message: "Clock in first." };
    if (state.out) return { ok: false, message: "You're already clocked out. Refresh the page." };
    if (!visit.virtual && !(input.patientSignature && isSignatureImage(input.patientSignature))) {
      return { ok: false, message: `${visit.patientName.split(" ")[0]} needs to sign before you clock out.` };
    }
  }

  // Virtual visits record no position at all.
  const position = visit.virtual ? null : validPosition(input.position);
  let place: ClockPlace;
  let distanceM: number | null = null;
  if (visit.virtual) place = "virtual";
  else if (!position) place = "unknown";
  else if (visit.homeLat === null || visit.homeLng === null) place = "no_home";
  else {
    distanceM = Math.round(distanceMetres({ lat: position.latitude, lng: position.longitude }, { lat: visit.homeLat, lng: visit.homeLng }));
    place = distanceM <= HOME_RADIUS_M ? "home" : "away";
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(visitClocks).values({
        practiceId: clinician.practiceId,
        appointmentId: input.appointmentId,
        clinicianId: clinician.id,
        event: input.event,
        at: now,
        virtual: visit.virtual,
        place,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        accuracyM: position ? Math.round(position.accuracy) : null,
        distanceM,
        patientSignature: input.event === "out" && !visit.virtual ? input.patientSignature! : null,
      });
      await tx
        .update(appointments)
        .set(input.event === "in" ? { timeIn: now, timeOut: null, updatedAt: now } : { timeOut: now, updatedAt: now })
        .where(eq(appointments.id, input.appointmentId));
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505") {
      return { ok: false, message: input.event === "in" ? "You're already clocked in. Refresh the page." : "You're already clocked out. Refresh the page." };
    }
    throw e;
  }

  await reportClock(clinician, input.appointmentId, input.event, visit.patientName, place, distanceM);
  return { ok: true, place, distanceM };
}

/** Tells the admins: a notification for every clock-in and clock-out, and an email when it's flagged. */
async function reportClock(clinician: Clinician, appointmentId: string, event: "in" | "out", patientName: string, place: ClockPlace, distanceM: number | null) {
  const flagged = FLAGGED_PLACES.includes(place);
  const verb = event === "in" ? "clocked in" : "clocked out";
  await notifyAdmins(clinician.practiceId, {
    type: flagged ? "clock_flag" : "clock",
    refId: appointmentId,
    title: `${clinician.name} ${verb}${flagged ? `: ${placeLabel(place, distanceM).toLowerCase()}` : ""}`,
    detail: `Visit with ${patientName} · ${placeLabel(place, distanceM)}`,
    href: `/admin/visits#visit-${appointmentId}`,
  });
  if (!flagged) return;

  const where =
    place === "away"
      ? `${distanceText(distanceM ?? 0)} from the patient's home`
      : place === "unknown"
        ? "without sharing their phone's location"
        : "but the patient's address isn't on the map, so Tiba couldn't check where they were";
  const heading = `${clinician.name} ${verb} ${place === "away" ? "away from the patient's home" : place === "unknown" ? "without their location" : "and needs a check"}`;
  try {
    const admins = await db
      .select({ email: clinicians.email })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, clinician.practiceId), eq(clinicians.role, "admin"), eq(clinicians.status, "active")));
    const base = appUrl();
    for (const admin of admins) {
      const email = renderEmail({
        heading,
        intro: `${clinician.name} ${verb} of an in-person visit ${where}. For the patient's privacy, the visit's details are only in Tiba.`,
        action: base ? { label: "See the visit in Tiba", url: `${base}/admin/visits#visit-${appointmentId}` } : undefined,
      });
      await sendEmail({ to: admin.email, subject: heading, ...email }).catch(() => undefined);
    }
  } catch {
    // The notification is already in Tiba; a failed email mustn't undo the clock-in.
  }
}

/** Switch a visit between in person and virtual, before anyone clocks in (drizzle/0036 also checks). */
export async function setVisitVirtual(clinicianId: string, appointmentId: string, virtual: boolean) {
  const state = await visitClockState(appointmentId);
  if (state.in) return { ok: false as const, message: "You've clocked in, so this can't change now." };
  const updated = await db
    .update(appointments)
    .set({ virtual, updatedAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicianId, clinicianId)))
    .returning({ id: appointments.id });
  return updated.length ? { ok: true as const } : { ok: false as const, message: "We couldn't find that visit." };
}

export type VisitRecord = {
  appointmentId: string;
  startsAt: Date;
  durationMinutes: number;
  typeOfCare: string;
  virtual: boolean;
  patientName: string;
  clinicianId: string;
  clinicianName: string;
  in: ClockRecord | null;
  out: ClockRecord | null;
};

export const RECORD_DAYS = 30;

/**
 * The practice's visits from the last RECORD_DAYS days that were due by now or clocked in (not
 * missed), newest first, with their clock-in and clock-out. Signatures load one at a time.
 */
export async function practiceVisitRecords(practiceId: string): Promise<VisitRecord[]> {
  const clockIn = alias(visitClocks, "clock_in");
  const clockOut = alias(visitClocks, "clock_out");
  const now = new Date();
  const since = new Date(now.getTime() - RECORD_DAYS * 86_400_000);
  const rows = await db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      typeOfCare: appointments.typeOfCare,
      virtual: appointments.virtual,
      patientName: patients.fullName,
      clinicianId: clinicians.id,
      clinicianName: clinicians.name,
      inAt: clockIn.at,
      inPlace: clockIn.place,
      inDistance: clockIn.distanceM,
      inAccuracy: clockIn.accuracyM,
      outAt: clockOut.at,
      outPlace: clockOut.place,
      outDistance: clockOut.distanceM,
      outAccuracy: clockOut.accuracyM,
      outSigned: sql<boolean>`${clockOut.patientSignature} is not null`,
    })
    .from(appointments)
    .innerJoin(clinicians, eq(clinicians.id, appointments.clinicianId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(clockIn, and(eq(clockIn.appointmentId, appointments.id), eq(clockIn.event, "in")))
    .leftJoin(clockOut, and(eq(clockOut.appointmentId, appointments.id), eq(clockOut.event, "out")))
    .where(
      and(
        eq(clinicians.practiceId, practiceId),
        isNull(appointments.missedAt),
        gte(appointments.startsAt, since),
        or(lte(appointments.startsAt, now), sql`${clockIn.id} is not null`),
      ),
    )
    .orderBy(desc(appointments.startsAt), asc(patients.fullName))
    .limit(400);
  return rows.map((r) => ({
    appointmentId: r.appointmentId,
    startsAt: r.startsAt,
    durationMinutes: r.durationMinutes,
    typeOfCare: r.typeOfCare,
    virtual: r.virtual,
    patientName: r.patientName,
    clinicianId: r.clinicianId,
    clinicianName: r.clinicianName,
    in: r.inAt && r.inPlace ? { at: r.inAt, place: r.inPlace, distanceM: r.inDistance, accuracyM: r.inAccuracy, signed: false } : null,
    out:
      r.outAt && r.outPlace
        ? { at: r.outAt, place: r.outPlace, distanceM: r.outDistance, accuracyM: r.outAccuracy, signed: Boolean(r.outSigned) }
        : null,
  }));
}

/** The patient's clock-out signature on a visit in the practice (a PNG data URL), for the admin. */
export async function clockOutSignature(practiceId: string, appointmentId: string) {
  const [row] = await db
    .select({ signature: visitClocks.patientSignature })
    .from(visitClocks)
    .where(and(eq(visitClocks.practiceId, practiceId), eq(visitClocks.appointmentId, appointmentId), eq(visitClocks.event, "out")));
  return row?.signature ?? null;
}

/** Marks the admin's clock notifications read once they've opened the visit records. */
export async function markClockNoticesRead(adminId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, adminId), inArray(notifications.type, CLOCK_TYPES), isNull(notifications.readAt)));
}
