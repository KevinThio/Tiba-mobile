import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { billingReminders, notifications, practices } from "@/db/schema";
import { completedNotes, OVERDUE_DAYS, unbilledOverdue } from "@/lib/admin-billing";
import { formatMoney } from "@/lib/countries";
import { renderEmail, sendEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";
import { shortName } from "@/lib/reminders";

// Insurance billing reminders go to the practice admin (decided 21 Oct 2026): an email from
// "Send reminder" on Insurance billing, and an in-app notification whenever notes have waited
// more than 30 days (from the hourly cron). Patients appear as "Amina W." only.

const DAY = 86_400_000;
const MAX_ROWS = 25;

/** Emails the admin the signed notes still waiting to be billed, oldest first. */
export async function sendBillingReminder(admin: { id: string; email: string; practiceId: string }) {
  const [practice] = await db.select({ name: practices.name, country: practices.country }).from(practices).where(eq(practices.id, admin.practiceId));
  const waiting = (await completedNotes(admin.practiceId)).filter((n) => !n.billedAt && n.signedAt).reverse();
  if (!waiting.length) return { ok: false as const, message: "Every signed note is billed, so there's nothing to remind you about." };

  const now = Date.now();
  const days = (d: Date) => Math.floor((now - d.getTime()) / DAY);
  const overdue = waiting.filter((n) => days(n.signedAt!) > OVERDUE_DAYS).length;
  const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const rows: [string, string][] = waiting.slice(0, MAX_ROWS).map((n) => [
    `${days(n.signedAt!)} days`,
    `${shortName(n.patientName)} · ${date(n.startsAt)} · ${n.clinicianName} · ${formatMoney(n.feeMinor, practice?.country ?? "US", n.currency)}${n.insurer ? ` · ${n.insurer}` : ""}`,
  ]);
  const base = process.env.BETTER_AUTH_URL ?? "";
  const { html, text } = renderEmail({
    heading: `${waiting.length} ${waiting.length === 1 ? "note" : "notes"} to bill to insurance`,
    intro:
      overdue > 0
        ? `${overdue} of them ${overdue === 1 ? "has" : "have"} waited more than ${OVERDUE_DAYS} days. Oldest first.`
        : "None has waited more than 30 days yet. Oldest first.",
    rows,
    action: base ? { label: "Open Insurance billing", url: `${base}/admin/billing` } : undefined,
    outro: waiting.length > MAX_ROWS ? `And ${waiting.length - MAX_ROWS} more in Tiba.` : "Mark each one as billed in Tiba once it's sent.",
  });
  await sendEmail({
    to: admin.email,
    subject: `${practice?.name ?? "Tiba"}: ${waiting.length} ${waiting.length === 1 ? "note" : "notes"} to bill to insurance`,
    html,
    text,
  });
  await db.insert(billingReminders).values({
    practiceId: admin.practiceId,
    sentById: admin.id,
    sentTo: admin.email,
    noteCount: waiting.length,
    overdueCount: overdue,
  });
  return { ok: true as const, to: admin.email, count: waiting.length };
}

/** The last reminder sent for the practice, for "Last sent …" on Insurance billing. */
export async function lastBillingReminder(practiceId: string) {
  const [row] = await db
    .select({ at: billingReminders.createdAt, to: billingReminders.sentTo, count: billingReminders.noteCount })
    .from(billingReminders)
    .where(eq(billingReminders.practiceId, practiceId))
    .orderBy(desc(billingReminders.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * From the cron: tells each practice's admin, in Notifications, when notes have waited more than
 * 30 days to be billed. Only one unread reminder at a time, so it doesn't pile up hourly.
 */
export async function notifyUnbilledOverdue() {
  const all = await db.select({ id: practices.id }).from(practices);
  let notified = 0;
  for (const p of all) {
    const { count } = await unbilledOverdue(p.id);
    if (!count) continue;
    const [open] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.practiceId, p.id), eq(notifications.type, "unbilled"), isNull(notifications.readAt)))
      .limit(1);
    if (open) continue;
    await notifyAdmins(p.id, {
      type: "unbilled",
      title: `${count} ${count === 1 ? "note" : "notes"} unbilled for ${OVERDUE_DAYS}+ days`,
      detail: "Bill them to insurance, then mark them as billed.",
      href: "/admin/billing",
    });
    notified++;
  }
  return { practices: all.length, notified };
}
