import "server-only";
import { and, asc, count, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, patientMessages, patients } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { renderEmail, sendEmail } from "@/lib/email";
import { clearNotifications, notifyAdmins } from "@/lib/notifications";
import { normalisePatientName } from "@/lib/patient-duplicates";

// Patient portal: a patient signs up with their practice, name, date of birth, email and a
// password (/patient/sign-up). The account waits until an admin links it to a patient record
// (Patient messages → Confirm), then the patient and the practice's admins message each other.
// Emails never carry a message or a patient's name: they only say there's something to read.

export const MESSAGE_MAX = 2000;

export type PortalMessage = {
  id: string;
  fromPatient: boolean;
  authorName: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
};

/** The conversation of one portal account, oldest first. */
export async function portalConversation(practiceId: string, accountId: string): Promise<PortalMessage[]> {
  return db
    .select({
      id: patientMessages.id,
      fromPatient: patientMessages.fromPatient,
      authorName: clinicians.name,
      body: patientMessages.body,
      createdAt: patientMessages.createdAt,
      readAt: patientMessages.readAt,
    })
    .from(patientMessages)
    .innerJoin(clinicians, eq(clinicians.id, patientMessages.authorId))
    .where(and(eq(patientMessages.practiceId, practiceId), eq(patientMessages.accountId, accountId)))
    .orderBy(asc(patientMessages.createdAt));
}

/** A patient portal account in this practice (any status), or null. */
export async function portalAccount(practiceId: string, accountId: string) {
  const [row] = await db
    .select({
      id: clinicians.id,
      name: clinicians.name,
      email: clinicians.email,
      birthDate: clinicians.birthDate,
      status: clinicians.status,
      patientId: clinicians.patientId,
      patientName: patients.fullName,
      createdAt: clinicians.createdAt,
    })
    .from(clinicians)
    .leftJoin(patients, eq(patients.id, clinicians.patientId))
    .where(and(eq(clinicians.id, accountId), eq(clinicians.practiceId, practiceId), eq(clinicians.role, "patient")));
  return row ?? null;
}

/**
 * People waiting for the admin to confirm their portal account, oldest first, each with the
 * practice's patients whose name and date of birth match what they gave (usually one).
 */
export async function portalRequests(practiceId: string) {
  const [requests, records] = await Promise.all([
    db
      .select({ id: clinicians.id, name: clinicians.name, email: clinicians.email, birthDate: clinicians.birthDate, createdAt: clinicians.createdAt })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "patient"), eq(clinicians.status, "pending")))
      .orderBy(asc(clinicians.createdAt)),
    linkablePatients(practiceId),
  ]);
  return requests.map((r) => ({
    ...r,
    matches: records.filter((p) => p.dateOfBirth === r.birthDate && normalisePatientName(p.fullName) === normalisePatientName(r.name)),
  }));
}

/** The practice's patients (not merged) that no portal account is linked to yet, by name. */
export async function linkablePatients(practiceId: string) {
  return db
    .select({ id: patients.id, fullName: patients.fullName, dateOfBirth: patients.dateOfBirth })
    .from(patients)
    .leftJoin(clinicians, eq(clinicians.patientId, patients.id))
    .where(and(eq(patients.practiceId, practiceId), ne(patients.status, "merged"), isNull(clinicians.id)))
    .orderBy(asc(patients.fullName));
}

/** Confirmed portal accounts with their latest message and how many the practice hasn't read. */
export async function portalConversations(practiceId: string) {
  const [accounts, latest, unread] = await Promise.all([
    db
      .select({ id: clinicians.id, name: clinicians.name, patientId: clinicians.patientId, patientName: patients.fullName, status: clinicians.status })
      .from(clinicians)
      .leftJoin(patients, eq(patients.id, clinicians.patientId))
      .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "patient"), ne(clinicians.status, "pending"))),
    db
      .selectDistinctOn([patientMessages.accountId], {
        accountId: patientMessages.accountId,
        body: patientMessages.body,
        fromPatient: patientMessages.fromPatient,
        createdAt: patientMessages.createdAt,
      })
      .from(patientMessages)
      .where(eq(patientMessages.practiceId, practiceId))
      .orderBy(patientMessages.accountId, desc(patientMessages.createdAt)),
    db
      .select({ accountId: patientMessages.accountId, n: count() })
      .from(patientMessages)
      .where(and(eq(patientMessages.practiceId, practiceId), eq(patientMessages.fromPatient, true), isNull(patientMessages.readAt)))
      .groupBy(patientMessages.accountId),
  ]);
  const last = new Map(latest.map((m) => [m.accountId, m]));
  const unreadBy = new Map(unread.map((u) => [u.accountId, Number(u.n)]));
  return accounts
    .map((a) => ({ ...a, last: last.get(a.id) ?? null, unread: unreadBy.get(a.id) ?? 0 }))
    .sort((a, b) => (b.last?.createdAt.getTime() ?? 0) - (a.last?.createdAt.getTime() ?? 0));
}

/** For the admin's menu badge and Overview: requests waiting and unread patient messages. */
export async function portalCounts(practiceId: string) {
  const [[requests], [unread]] = await Promise.all([
    db
      .select({ n: count() })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "patient"), eq(clinicians.status, "pending"))),
    db
      .select({ n: count() })
      .from(patientMessages)
      .where(and(eq(patientMessages.practiceId, practiceId), eq(patientMessages.fromPatient, true), isNull(patientMessages.readAt))),
  ]);
  return { requests: Number(requests?.n ?? 0), unread: Number(unread?.n ?? 0) };
}

/** Unread practice replies for a patient. */
export async function unreadForPatient(accountId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(patientMessages)
    .where(and(eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, false), isNull(patientMessages.readAt)));
  return Number(row?.n ?? 0);
}

/** A patient writes to the practice. The admins get a notification, and an email for the first unread one. */
export async function sendPatientMessage(account: { id: string; name: string; practiceId: string }, body: string) {
  const waiting = await unreadFromPatient(account.id);
  await db.insert(patientMessages).values({ practiceId: account.practiceId, accountId: account.id, fromPatient: true, authorId: account.id, body });
  await clearNotifications(account.practiceId, "patient_message", account.id).catch(() => undefined);
  await notifyAdmins(account.practiceId, {
    type: "patient_message",
    refId: account.id,
    title: `New message from ${account.name}`,
    detail: "Patient portal",
    href: `/admin/messages/${account.id}`,
  }).catch(() => undefined);
  if (waiting > 0) return;
  const admins = await db
    .select({ email: clinicians.email, practiceName: clinicians.practiceName })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, account.practiceId), eq(clinicians.role, "admin")));
  const base = appUrl();
  for (const admin of admins) {
    const email = renderEmail({
      heading: "A patient sent you a message",
      intro: `One of ${admin.practiceName}'s patients wrote to you through the patient portal. For their privacy, the message is only in Tiba.`,
      action: base ? { label: "Read it in Tiba", url: `${base}/admin/messages/${account.id}` } : undefined,
    });
    await sendEmail({ to: admin.email, subject: "A patient sent you a message", ...email }).catch(() => undefined);
  }
}

/** An admin replies. Marks the patient's messages read, and emails the patient if they've nothing unread yet. */
export async function sendPracticeReply(admin: { id: string; practiceId: string; practiceName: string }, accountId: string, body: string) {
  const account = await portalAccount(admin.practiceId, accountId);
  if (!account || account.status !== "active") return false;
  const [unseen] = await db
    .select({ n: count() })
    .from(patientMessages)
    .where(and(eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, false), isNull(patientMessages.readAt)));
  await db.insert(patientMessages).values({ practiceId: admin.practiceId, accountId, fromPatient: false, authorId: admin.id, body });
  await markReadByPractice(admin.practiceId, accountId);
  if (Number(unseen?.n ?? 0) === 0) {
    const base = appUrl();
    const email = renderEmail({
      heading: `${admin.practiceName} replied`,
      intro: `${admin.practiceName} answered your message in the Tiba patient portal. For your privacy, the reply is only in the portal.`,
      action: base ? { label: "Read it", url: `${base}/patient/sign-in` } : undefined,
    });
    await sendEmail({ to: account.email, subject: `${admin.practiceName} replied to your message`, ...email }).catch(() => undefined);
  }
  return true;
}

async function unreadFromPatient(accountId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(patientMessages)
    .where(and(eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, true), isNull(patientMessages.readAt)));
  return Number(row?.n ?? 0);
}

/** The practice opened the conversation. */
export async function markReadByPractice(practiceId: string, accountId: string) {
  await db
    .update(patientMessages)
    .set({ readAt: new Date() })
    .where(and(eq(patientMessages.practiceId, practiceId), eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, true), isNull(patientMessages.readAt)));
  await clearNotifications(practiceId, "patient_message", accountId).catch(() => undefined);
}

/** The patient opened their portal. */
export async function markReadByPatient(accountId: string) {
  await db
    .update(patientMessages)
    .set({ readAt: new Date() })
    .where(and(eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, false), isNull(patientMessages.readAt)));
}

/**
 * Confirms a portal request: links the account to one of the practice's patient records and lets
 * the patient in. Refused when the record already has a portal account.
 */
export async function approvePortalAccount(practiceId: string, accountId: string, patientId: string) {
  const account = await portalAccount(practiceId, accountId);
  if (!account || account.status !== "pending") return { ok: false as const, message: "This request isn't waiting any more. Please refresh the page." };
  const [record] = await linkablePatients(practiceId).then((rows) => rows.filter((p) => p.id === patientId));
  if (!record) return { ok: false as const, message: "Pick a patient record that doesn't have a portal account yet." };
  await db.update(clinicians).set({ status: "active", patientId, updatedAt: new Date() }).where(eq(clinicians.id, accountId));
  await clearNotifications(practiceId, "portal_request", accountId).catch(() => undefined);
  const base = appUrl();
  const [practice] = await db.select({ name: clinicians.practiceName }).from(clinicians).where(eq(clinicians.id, accountId));
  const email = renderEmail({
    heading: "Your patient portal is ready",
    intro: `${practice?.name ?? "Your practice"} confirmed your Tiba patient portal account. You can now send them messages.`,
    action: base ? { label: "Sign in", url: `${base}/patient/sign-in` } : undefined,
  });
  await sendEmail({ to: account.email, subject: "Your patient portal is ready", ...email }).catch(() => undefined);
  return { ok: true as const, name: record.fullName };
}

/** Declines a portal request (or turns off a confirmed account): the person can't send or read messages. */
export async function declinePortalAccount(practiceId: string, accountId: string) {
  const account = await portalAccount(practiceId, accountId);
  if (!account || account.status === "deactivated") return { ok: false as const, message: "This account is already turned off. Please refresh the page." };
  await db.update(clinicians).set({ status: "deactivated", updatedAt: new Date() }).where(eq(clinicians.id, accountId));
  await clearNotifications(practiceId, "portal_request", accountId).catch(() => undefined);
  if (account.status === "pending") {
    const email = renderEmail({
      heading: "We couldn't confirm your account",
      intro: "The practice couldn't match your patient portal account to their records. If you're their patient, please contact them directly.",
    });
    await sendEmail({ to: account.email, subject: "About your patient portal account", ...email }).catch(() => undefined);
  }
  return { ok: true as const };
}
