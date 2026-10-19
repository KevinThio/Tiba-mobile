"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clinicians } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { EmailNotConfiguredError } from "@/lib/email";
import { isValidTimeZone, sendTomorrowReminder, tomorrowsVisits } from "@/lib/reminders";

const timeZoneSchema = z.string().refine(isValidTimeZone, "Unknown time zone.");

/** How many visits are booked tomorrow, and whether evening reminders are on. */
export async function getTomorrowSummary(timeZone: string) {
  const clinician = await requireClinician();
  const tz = timeZoneSchema.parse(timeZone);
  const [{ visits, label }, [settings]] = await Promise.all([
    tomorrowsVisits(clinician.id, tz),
    db.select({ reminderEmails: clinicians.reminderEmails }).from(clinicians).where(eq(clinicians.id, clinician.id)),
  ]);
  return { label, count: visits.length, reminderEmails: settings?.reminderEmails ?? false };
}

export async function setReminderEmails(enabled: boolean, timeZone: string) {
  const clinician = await requireClinician();
  const tz = timeZoneSchema.parse(timeZone);
  await db
    .update(clinicians)
    .set({ reminderEmails: z.boolean().parse(enabled), timeZone: tz })
    .where(eq(clinicians.id, clinician.id));
  return { ok: true as const };
}

export async function emailTomorrowNow(timeZone: string): Promise<{ ok: true; to: string; count: number } | { ok: false; message: string }> {
  const clinician = await requireClinician();
  const tz = timeZoneSchema.parse(timeZone);
  try {
    const { count } = await sendTomorrowReminder(clinician, tz);
    return { ok: true, to: clinician.email, count };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof EmailNotConfiguredError
          ? "Email isn't set up yet, so we couldn't send it."
          : "We couldn't send the email just now. Please try again in a moment.",
    };
  }
}
