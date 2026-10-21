"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { noteBillings, notifications } from "@/db/schema";
import { signedNotesInPractice, unbilledOverdue } from "@/lib/admin-billing";
import { requireAdmin } from "@/lib/auth";
import { sendBillingReminder } from "@/lib/billing-reminders";
import { EmailNotConfiguredError } from "@/lib/email";

/**
 * Mark as billed (spec v2 Completed notes and Insurance billing): records that signed notes have
 * been billed to insurance. Billing is kept apart from the locked note itself.
 */
export async function markNotesBilled(input: { appointmentIds: string[] }): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  const parsed = z.object({ appointmentIds: z.array(z.uuid()).min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please refresh the page and try again." };
  const found = await signedNotesInPractice(parsed.data.appointmentIds, admin.practiceId);
  if (!found.length) return { ok: false, message: "We couldn't find those signed notes. Please refresh the page." };
  await db
    .insert(noteBillings)
    .values(found.map((n) => ({ noteId: n.noteId, billedById: admin.id })))
    .onConflictDoNothing();
  // Nothing left over 30 days: the "unbilled" notification has been dealt with.
  if ((await unbilledOverdue(admin.practiceId)).count === 0) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.practiceId, admin.practiceId), eq(notifications.type, "unbilled"), isNull(notifications.readAt)));
  }
  revalidatePath("/admin", "layout");
  return { ok: true, count: found.length };
}

/** "Send reminder" on Insurance billing: emails the admin the notes waiting to be billed. */
export async function sendBillingReminderNow(): Promise<{ ok: true; to: string; count: number } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  try {
    const result = await sendBillingReminder(admin);
    revalidatePath("/admin/billing");
    return result;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof EmailNotConfiguredError
          ? "Email isn't set up yet, so the reminder couldn't be sent."
          : "We couldn't send the reminder just now. Please try again.",
    };
  }
}
