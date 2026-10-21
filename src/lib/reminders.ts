import "server-only";
import { and, asc, eq, gte, lt, or, isNull, ne } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";
import { db } from "@/db";
import { appointments, clinicians, patients } from "@/db/schema";
import { renderEmail, sendEmail } from "@/lib/email";

// "Tomorrow's appointments" emails to the clinician.
// Sent on request from the Appointments page, and every evening by /api/cron/reminders
// for clinicians who turned it on. Days and times use the clinician's own time zone.

export const REMINDER_HOUR = 18; // 6 pm local time

export function isValidTimeZone(tz: string) {
  try {
    Temporal.Now.zonedDateTimeISO(tz);
    return true;
  } catch {
    return false;
  }
}

/** Start and end (exclusive) of tomorrow in `timeZone`, plus today's local date. */
export function tomorrowIn(timeZone: string, now = Temporal.Now.instant()) {
  const local = now.toZonedDateTimeISO(timeZone);
  const start = local.add({ days: 1 }).startOfDay();
  const end = start.add({ days: 1 });
  return {
    today: local.toPlainDate().toString(),
    hour: local.hour,
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
    label: start.toPlainDate().toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
  };
}

/** Tomorrow's visits for one clinician, ready to show or email. */
export async function tomorrowsVisits(clinicianId: string, timeZone: string) {
  const { start, end, label } = tomorrowIn(timeZone);
  const rows = await db
    .select({
      startsAt: appointments.startsAt,
      durationMinutes: appointments.durationMinutes,
      typeOfCare: appointments.typeOfCare,
      patientName: patients.fullName,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.clinicianId, clinicianId), gte(appointments.startsAt, start), lt(appointments.startsAt, end)))
    .orderBy(asc(appointments.startsAt));
  return { label, visits: rows };
}

/** Patients appear as "Amina W." in emails: enough to recognise, less exposed if forwarded. */
/** "Amina Wanjiru" → "Amina W.": the most patient detail reminder emails carry. */
export function shortName(fullName: string) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

export async function sendTomorrowReminder(clinician: { id: string; name: string; email: string }, timeZone: string) {
  const { label, visits } = await tomorrowsVisits(clinician.id, timeZone);
  const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const count = visits.length;
  const { html, text } = renderEmail({
    heading: count ? `Tomorrow: ${count} visit${count === 1 ? "" : "s"}` : "Nothing booked for tomorrow",
    intro: count
      ? `Here's your day for ${label}.`
      : `You have no visits booked for ${label}. Enjoy the breathing room.`,
    rows: visits.map((v) => [time(v.startsAt), `${shortName(v.patientName)} · ${v.typeOfCare} · ${v.durationMinutes} min`]),
    outro: count ? "Open Tiba to see the full details." : undefined,
  });
  const result = await sendEmail({
    to: clinician.email,
    subject: count ? `Tomorrow: ${count} visit${count === 1 ? "" : "s"} (${label})` : `Nothing booked for ${label}`,
    html,
    text,
  });
  return { ...result, count };
}

/**
 * Sends the evening reminder to every clinician who wants it and hasn't had today's yet,
 * once it's past REMINDER_HOUR where they are. Safe to run as often as you like (e.g. hourly).
 */
export async function sendDueReminders(now = Temporal.Now.instant()) {
  const candidates = await db
    .select({ id: clinicians.id, name: clinicians.name, email: clinicians.email, timeZone: clinicians.timeZone, last: clinicians.lastReminderSentOn })
    .from(clinicians)
    .where(eq(clinicians.reminderEmails, true));

  let sent = 0;
  let failed = 0;
  for (const c of candidates) {
    if (!c.timeZone || !isValidTimeZone(c.timeZone)) continue;
    const { today, hour } = tomorrowIn(c.timeZone, now);
    if (hour < REMINDER_HOUR || c.last === today) continue;
    // Claim today's slot first so two overlapping runs can't both send.
    const claimed = await db
      .update(clinicians)
      .set({ lastReminderSentOn: today })
      .where(and(eq(clinicians.id, c.id), or(isNull(clinicians.lastReminderSentOn), ne(clinicians.lastReminderSentOn, today))))
      .returning({ id: clinicians.id });
    if (claimed.length === 0) continue;
    try {
      await sendTomorrowReminder(c, c.timeZone);
      sent++;
    } catch {
      // Give it another go on the next run.
      await db.update(clinicians).set({ lastReminderSentOn: c.last }).where(eq(clinicians.id, c.id));
      failed++;
    }
  }
  return { checked: candidates.length, sent, failed };
}
