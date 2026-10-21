import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, notifications } from "@/db/schema";

// In-app notifications (spec v2 section 5b). One row per recipient; nothing is emailed yet
// (spec section 7). Never put more patient detail in them than the screen they open shows.

type Notice = { type: string; refId?: string | null; title: string; detail?: string | null; href: string };

/** Notifies every admin of the practice (there's one for now). Never fails the caller's work. */
export async function notifyAdmins(practiceId: string, notice: Notice) {
  try {
    const admins = await db
      .select({ id: clinicians.id })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "admin")));
    if (!admins.length) return;
    await db.insert(notifications).values(admins.map((a) => ({ practiceId, recipientId: a.id, ...notice })));
  } catch {
    // A missed notification mustn't undo an invoice or a patient; the screens still show the work.
  }
}

/** Notifies one clinician (contracts and invoice issues, once those screens exist). */
export async function notifyAccount(practiceId: string, recipientId: string, notice: Notice) {
  try {
    await db.insert(notifications).values({ practiceId, recipientId, ...notice });
  } catch {}
}

/** Marks notifications about something as read once it's been dealt with (e.g. a duplicate merged). */
export async function clearNotifications(practiceId: string, type: string, refId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.practiceId, practiceId), eq(notifications.type, type), eq(notifications.refId, refId), isNull(notifications.readAt)));
}

export async function unreadNotificationCount(accountId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, accountId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export function listNotifications(accountId: string) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      detail: notifications.detail,
      href: notifications.href,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .where(eq(notifications.recipientId, accountId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}
