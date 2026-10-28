import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, files, patientMessages, patients, referrals } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { renderEmail, sendEmail } from "@/lib/email";
import { clearNotifications, notifyAdmins } from "@/lib/notifications";
import { normalisePatientName } from "@/lib/patient-duplicates";

// Patient and referral portals.
// - Patient portal: a patient signs up with their practice, name, date of birth, email and a
//   password (/patient/sign-up). The account waits until an admin links it to a patient record
//   (Patient messages → Confirm).
// - Referral portal: a referral source (hospital, doctor, agency) signs up with their practice,
//   name, organisation, email and password (/referral/sign-up), and waits until an admin confirms
//   them (Referral sources → Confirm). They can attach documents to their messages.
// Then the account and the practice's admins message each other. Emails never carry a message,
// a document or a patient's name: they only say there's something to read.

export const MESSAGE_MAX = 2000;
/** Documents per referral message. Each is at most ATTACHMENT_MAX_BYTES (under Vercel's 4.5 MB request limit). */
export const ATTACHMENTS_MAX = 5;
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;

export type PortalKind = "patient" | "referrer";

const KIND = {
  patient: {
    request: "portal_request",
    message: "patient_message",
    admin: "/admin/messages",
    signIn: "/patient/sign-in",
    who: "patient",
    portal: "patient portal",
  },
  referrer: {
    request: "referral_request",
    message: "referral_message",
    admin: "/admin/referrals",
    signIn: "/referral/sign-in",
    who: "referral source",
    portal: "referral portal",
  },
} as const;

export type PortalAttachment = { id: string; name: string; size: number };

export type PortalMessage = {
  id: string;
  fromPatient: boolean;
  authorName: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
  attachments: PortalAttachment[];
};

/** The conversation of one portal account, oldest first, with each message's documents. */
export async function portalConversation(practiceId: string, accountId: string): Promise<PortalMessage[]> {
  const rows = await db
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
  if (!rows.length) return [];
  const attached = await db
    .select({ id: files.id, messageId: files.ownerId, name: files.name, size: files.size })
    .from(files)
    .where(and(eq(files.practiceId, practiceId), eq(files.ownerKind, "message"), inArray(files.ownerId, rows.map((r) => r.id))))
    .orderBy(asc(files.createdAt));
  return rows.map((r) => ({
    ...r,
    attachments: attached.filter((f) => f.messageId === r.id).map(({ id, name, size }) => ({ id, name, size })),
  }));
}

/** A portal account of this kind in this practice (any status), or null. */
export async function portalAccount(practiceId: string, accountId: string, kind: PortalKind = "patient") {
  const [row] = await db
    .select({
      id: clinicians.id,
      name: clinicians.name,
      email: clinicians.email,
      birthDate: clinicians.birthDate,
      organisation: clinicians.organisation,
      status: clinicians.status,
      patientId: clinicians.patientId,
      patientName: patients.fullName,
      createdAt: clinicians.createdAt,
    })
    .from(clinicians)
    .leftJoin(patients, eq(patients.id, clinicians.patientId))
    .where(and(eq(clinicians.id, accountId), eq(clinicians.practiceId, practiceId), eq(clinicians.role, kind)));
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

/** Referral sources waiting for the admin to confirm them, oldest first. */
export async function referralRequests(practiceId: string) {
  return db
    .select({ id: clinicians.id, name: clinicians.name, email: clinicians.email, organisation: clinicians.organisation, createdAt: clinicians.createdAt })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, "referrer"), eq(clinicians.status, "pending")))
    .orderBy(asc(clinicians.createdAt));
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

/** Confirmed portal accounts of this kind with their latest message and how many the practice hasn't read. */
export async function portalConversations(practiceId: string, kind: PortalKind = "patient") {
  const ofKind = and(eq(patientMessages.practiceId, practiceId), eq(clinicians.role, kind));
  const [accounts, latest, unread] = await Promise.all([
    db
      .select({
        id: clinicians.id,
        name: clinicians.name,
        organisation: clinicians.organisation,
        patientId: clinicians.patientId,
        patientName: patients.fullName,
        status: clinicians.status,
      })
      .from(clinicians)
      .leftJoin(patients, eq(patients.id, clinicians.patientId))
      .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, kind), ne(clinicians.status, "pending"))),
    db
      .selectDistinctOn([patientMessages.accountId], {
        accountId: patientMessages.accountId,
        body: patientMessages.body,
        fromPatient: patientMessages.fromPatient,
        createdAt: patientMessages.createdAt,
      })
      .from(patientMessages)
      .innerJoin(clinicians, eq(clinicians.id, patientMessages.accountId))
      .where(ofKind)
      .orderBy(patientMessages.accountId, desc(patientMessages.createdAt)),
    db
      .select({ accountId: patientMessages.accountId, n: count() })
      .from(patientMessages)
      .innerJoin(clinicians, eq(clinicians.id, patientMessages.accountId))
      .where(and(ofKind, eq(patientMessages.fromPatient, true), isNull(patientMessages.readAt)))
      .groupBy(patientMessages.accountId),
  ]);
  const last = new Map(latest.map((m) => [m.accountId, m]));
  const unreadBy = new Map(unread.map((u) => [u.accountId, Number(u.n)]));
  return accounts
    .map((a) => ({ ...a, last: last.get(a.id) ?? null, unread: unreadBy.get(a.id) ?? 0 }))
    .sort((a, b) => (b.last?.createdAt.getTime() ?? 0) - (a.last?.createdAt.getTime() ?? 0));
}

/**
 * For the admin's menu badge and Overview: requests waiting, unread messages from this kind of
 * account and (referral sources) referrals waiting for a decision. A referral's own message isn't
 * counted as unread: the waiting referral is.
 */
export async function portalCounts(practiceId: string, kind: PortalKind = "patient") {
  const [[requests], [unread], [waiting]] = await Promise.all([
    db
      .select({ n: count() })
      .from(clinicians)
      .where(and(eq(clinicians.practiceId, practiceId), eq(clinicians.role, kind), eq(clinicians.status, "pending"))),
    db
      .select({ n: count() })
      .from(patientMessages)
      .innerJoin(clinicians, eq(clinicians.id, patientMessages.accountId))
      .leftJoin(referrals, eq(referrals.messageId, patientMessages.id))
      .where(
        and(
          eq(patientMessages.practiceId, practiceId),
          eq(clinicians.role, kind),
          eq(patientMessages.fromPatient, true),
          isNull(patientMessages.readAt),
          isNull(referrals.id),
        ),
      ),
    kind === "referrer"
      ? db
          .select({ n: count() })
          .from(referrals)
          .where(and(eq(referrals.practiceId, practiceId), eq(referrals.status, "pending")))
      : [{ n: 0 }],
  ]);
  return { requests: Number(requests?.n ?? 0), unread: Number(unread?.n ?? 0), referrals: Number(waiting?.n ?? 0) };
}

/** Where a referral source's uploaded documents wait until they send the message. */
export const draftOwner = (accountId: string) => `draft:${accountId}`;

/**
 * A portal account writes to the practice, with any documents it uploaded for this message
 * (referral sources only). The admins get a notification, and an email for the first unread one.
 * Returns false when an attachment isn't one of the account's waiting uploads. `options.within`
 * runs in the same transaction with the new message's id (a referral is saved this way), and
 * `options.notice` replaces the notification and email wording.
 */
export async function sendFromPortal(
  account: { id: string; name: string; practiceId: string },
  body: string,
  kind: PortalKind = "patient",
  attachmentIds: string[] = [],
  options: {
    within?: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], messageId: string) => Promise<unknown>;
    notice?: { title: string; heading: string; intro: (practiceName: string) => string };
  } = {},
) {
  const k = KIND[kind];
  const waiting = await unreadFromAccount(account.id);
  const sent = await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(patientMessages)
      .values({ practiceId: account.practiceId, accountId: account.id, fromPatient: true, authorId: account.id, body })
      .returning({ id: patientMessages.id });
    if (attachmentIds.length) {
      const moved = await tx
        .update(files)
        .set({ ownerId: message.id })
        .where(
          and(
            inArray(files.id, attachmentIds),
            eq(files.practiceId, account.practiceId),
            eq(files.ownerKind, "message"),
            eq(files.ownerId, draftOwner(account.id)),
          ),
        )
        .returning({ id: files.id });
      if (moved.length !== attachmentIds.length) {
        tx.rollback();
      }
    }
    if (options.within) await options.within(tx, message.id);
    // Uploads left behind (removed before sending, or a closed tab) are cleared after a day.
    await tx
      .delete(files)
      .where(
        and(
          eq(files.ownerKind, "message"),
          eq(files.ownerId, draftOwner(account.id)),
          lt(files.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      );
    return true;
  }).catch(() => false);
  if (!sent) return false;

  await clearNotifications(account.practiceId, k.message, account.id).catch(() => undefined);
  await notifyAdmins(account.practiceId, {
    type: k.message,
    refId: account.id,
    title: options.notice?.title ?? `New message from ${account.name}`,
    detail: kind === "referrer" && attachmentIds.length ? `Referral portal · ${documents(attachmentIds.length)}` : kind === "referrer" ? "Referral portal" : "Patient portal",
    href: `${k.admin}/${account.id}`,
  }).catch(() => undefined);
  if (waiting > 0) return true;
  const admins = await db
    .select({ email: clinicians.email, practiceName: clinicians.practiceName })
    .from(clinicians)
    .where(and(eq(clinicians.practiceId, account.practiceId), eq(clinicians.role, "admin")));
  const base = appUrl();
  for (const admin of admins) {
    const email = renderEmail({
      heading: options.notice?.heading ?? `A ${k.who} sent you a message`,
      intro: options.notice
        ? options.notice.intro(admin.practiceName)
        : kind === "referrer"
          ? `One of ${admin.practiceName}'s referral sources wrote to you through the referral portal. For privacy, the message and any documents are only in Tiba.`
          : `One of ${admin.practiceName}'s patients wrote to you through the patient portal. For their privacy, the message is only in Tiba.`,
      action: base ? { label: "Read it in Tiba", url: `${base}${k.admin}/${account.id}` } : undefined,
    });
    await sendEmail({ to: admin.email, subject: options.notice?.heading ?? `A ${k.who} sent you a message`, ...email }).catch(() => undefined);
  }
  return true;
}

export const documents = (n: number) => (n === 1 ? "1 document" : `${n} documents`);

/** An admin replies. Marks the account's messages read, and emails them if they've nothing unread yet. */
export async function sendPracticeReply(
  admin: { id: string; practiceId: string; practiceName: string },
  accountId: string,
  body: string,
  kind: PortalKind = "patient",
) {
  const account = await portalAccount(admin.practiceId, accountId, kind);
  if (!account || account.status !== "active") return false;
  const [unseen] = await db
    .select({ n: count() })
    .from(patientMessages)
    .where(and(eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, false), isNull(patientMessages.readAt)));
  await db.insert(patientMessages).values({ practiceId: admin.practiceId, accountId, fromPatient: false, authorId: admin.id, body });
  await markReadByPractice(admin.practiceId, accountId, kind);
  if (Number(unseen?.n ?? 0) === 0) {
    const base = appUrl();
    const k = KIND[kind];
    const email = renderEmail({
      heading: `${admin.practiceName} replied`,
      intro: `${admin.practiceName} answered your message in the Tiba ${k.portal}. For your privacy, the reply is only in the portal.`,
      action: base ? { label: "Read it", url: `${base}${k.signIn}` } : undefined,
    });
    await sendEmail({ to: account.email, subject: `${admin.practiceName} replied to your message`, ...email }).catch(() => undefined);
  }
  return true;
}

async function unreadFromAccount(accountId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(patientMessages)
    .where(and(eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, true), isNull(patientMessages.readAt)));
  return Number(row?.n ?? 0);
}

/** The practice opened the conversation. */
export async function markReadByPractice(practiceId: string, accountId: string, kind: PortalKind = "patient") {
  await db
    .update(patientMessages)
    .set({ readAt: new Date() })
    .where(and(eq(patientMessages.practiceId, practiceId), eq(patientMessages.accountId, accountId), eq(patientMessages.fromPatient, true), isNull(patientMessages.readAt)));
  await clearNotifications(practiceId, KIND[kind].message, accountId).catch(() => undefined);
}

/** The patient or referral source opened their portal. */
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

/** Confirms a referral source: they can now send the practice messages and documents. */
export async function approveReferralAccount(practiceId: string, accountId: string) {
  const account = await portalAccount(practiceId, accountId, "referrer");
  if (!account || account.status !== "pending") return { ok: false as const, message: "This request isn't waiting any more. Please refresh the page." };
  await db.update(clinicians).set({ status: "active", updatedAt: new Date() }).where(eq(clinicians.id, accountId));
  await clearNotifications(practiceId, "referral_request", accountId).catch(() => undefined);
  const base = appUrl();
  const [practice] = await db.select({ name: clinicians.practiceName }).from(clinicians).where(eq(clinicians.id, accountId));
  const email = renderEmail({
    heading: "Your referral portal is ready",
    intro: `${practice?.name ?? "The practice"} confirmed your Tiba referral portal account. You can now send them messages and documents.`,
    action: base ? { label: "Sign in", url: `${base}/referral/sign-in` } : undefined,
  });
  await sendEmail({ to: account.email, subject: "Your referral portal is ready", ...email }).catch(() => undefined);
  return { ok: true as const };
}

/** Declines a portal request (or turns off a confirmed account): the person can't send or read messages. */
export async function declinePortalAccount(practiceId: string, accountId: string, kind: PortalKind = "patient") {
  const account = await portalAccount(practiceId, accountId, kind);
  if (!account || account.status === "deactivated") return { ok: false as const, message: "This account is already turned off. Please refresh the page." };
  await db.update(clinicians).set({ status: "deactivated", updatedAt: new Date() }).where(eq(clinicians.id, accountId));
  await clearNotifications(practiceId, KIND[kind].request, accountId).catch(() => undefined);
  if (account.status === "pending") {
    const email = renderEmail({
      heading: "We couldn't confirm your account",
      intro:
        kind === "referrer"
          ? "The practice couldn't confirm your referral portal account. If you send them referrals, please contact them directly."
          : "The practice couldn't match your patient portal account to their records. If you're their patient, please contact them directly.",
    });
    await sendEmail({ to: account.email, subject: `About your ${KIND[kind].portal} account`, ...email }).catch(() => undefined);
  }
  return { ok: true as const };
}
