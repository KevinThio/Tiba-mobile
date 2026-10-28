import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clinicians, files, patientMessages, referrals } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { renderEmail, sendEmail } from "@/lib/email";
import { formatBirthDate } from "@/lib/practice-join";
import { markReadByPractice, sendFromPortal, type PortalAttachment } from "@/lib/portal";
import type { ReferralStatus } from "@/lib/referral-status";

// Referrals (referral portal): a referral source sends the practice a patient's name, date of
// birth, insurer and insurance ID, with an optional note and documents. Each referral arrives as a
// portal message, which carries the documents. The admin accepts or declines it; the decision
// goes back to the referral source as a practice message, and by an email that names no one.

export type Referral = {
  id: string;
  referrerId: string;
  referrerName: string;
  organisation: string | null;
  patientName: string;
  birthDate: string;
  insurer: string;
  insuranceId: string | null;
  note: string | null;
  status: ReferralStatus;
  createdAt: Date;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
  attachments: PortalAttachment[];
};

const decider = alias(clinicians, "decider");

/** The practice's referrals, newest first: all of them, or one referral source's, optionally one status. */
export async function listReferrals(practiceId: string, filter: { referrerId?: string; status?: ReferralStatus } = {}): Promise<Referral[]> {
  const rows = await db
    .select({
      id: referrals.id,
      referrerId: referrals.referrerId,
      referrerName: clinicians.name,
      organisation: clinicians.organisation,
      messageId: referrals.messageId,
      patientName: referrals.patientName,
      birthDate: referrals.birthDate,
      insurer: referrals.insurer,
      insuranceId: referrals.insuranceId,
      note: referrals.note,
      status: referrals.status,
      createdAt: referrals.createdAt,
      decidedAt: referrals.decidedAt,
      decidedByName: decider.name,
      decisionNote: referrals.decisionNote,
    })
    .from(referrals)
    .innerJoin(clinicians, eq(clinicians.id, referrals.referrerId))
    .leftJoin(decider, eq(decider.id, referrals.decidedById))
    .where(
      and(
        eq(referrals.practiceId, practiceId),
        filter.referrerId ? eq(referrals.referrerId, filter.referrerId) : undefined,
        filter.status ? eq(referrals.status, filter.status) : undefined,
      ),
    )
    .orderBy(desc(referrals.createdAt));
  const messageIds = rows.map((r) => r.messageId).filter((id): id is string => Boolean(id));
  const attached = messageIds.length
    ? await db
        .select({ id: files.id, messageId: files.ownerId, name: files.name, size: files.size })
        .from(files)
        .where(and(eq(files.practiceId, practiceId), eq(files.ownerKind, "message"), inArray(files.ownerId, messageIds)))
        .orderBy(asc(files.createdAt))
    : [];
  return rows.map(({ messageId, ...r }) => ({
    ...r,
    attachments: attached.filter((f) => f.messageId === messageId).map(({ id, name, size }) => ({ id, name, size })),
  }));
}

/** How many referrals are waiting, accepted and declined (the practice's, or one referral source's). */
export async function referralCounts(practiceId: string, referrerId?: string) {
  const rows = await db
    .select({ status: referrals.status, n: count() })
    .from(referrals)
    .where(and(eq(referrals.practiceId, practiceId), referrerId ? eq(referrals.referrerId, referrerId) : undefined))
    .groupBy(referrals.status);
  const of = (s: ReferralStatus) => Number(rows.find((r) => r.status === s)?.n ?? 0);
  const counts = { pending: of("pending"), accepted: of("accepted"), declined: of("declined") };
  return { ...counts, all: counts.pending + counts.accepted + counts.declined };
}

export type NewReferral = {
  patientName: string;
  birthDate: string;
  insurer: string;
  insuranceId: string | null;
  note: string | null;
};

/**
 * A referral source sends a referral: saved with its portal message (and the documents uploaded
 * for it) in one transaction. Returns false when a document isn't one of their waiting uploads.
 */
export async function createReferral(account: { id: string; name: string; practiceId: string }, referral: NewReferral, attachmentIds: string[]) {
  const cover = referral.insuranceId ? `${referral.insurer} · ID ${referral.insuranceId}` : referral.insurer;
  const body = [`New referral: ${referral.patientName}, born ${formatBirthDate(referral.birthDate)}.`, `Insurance: ${cover}.`, referral.note]
    .filter(Boolean)
    .join("\n");
  return sendFromPortal(account, body, "referrer", attachmentIds, {
    within: (tx, messageId) => tx.insert(referrals).values({ practiceId: account.practiceId, referrerId: account.id, messageId, ...referral }),
    notice: {
      title: `New referral from ${account.name}`,
      heading: "You have a new referral",
      intro: (practice) => `One of ${practice}'s referral sources sent you a referral through the referral portal. For privacy, the patient's details are only in Tiba.`,
    },
  });
}

/**
 * The admin accepts or declines a waiting referral, with an optional note. The referral source
 * gets the decision as a practice message, and an email that doesn't name the patient.
 */
export async function decideReferral(
  admin: { id: string; practiceId: string; practiceName: string },
  referralId: string,
  decision: "accepted" | "declined",
  note: string | null,
) {
  const [decided] = await db
    .update(referrals)
    .set({ status: decision, decidedAt: new Date(), decidedById: admin.id, decisionNote: note })
    .where(and(eq(referrals.id, referralId), eq(referrals.practiceId, admin.practiceId), eq(referrals.status, "pending")))
    .returning({ referrerId: referrals.referrerId, patientName: referrals.patientName, messageId: referrals.messageId });
  if (!decided) return { ok: false as const, message: "This referral isn't waiting any more. Please refresh the page." };

  const [account] = await db
    .select({ email: clinicians.email, status: clinicians.status })
    .from(clinicians)
    .where(eq(clinicians.id, decided.referrerId));
  const verb = decision === "accepted" ? "Accepted" : "Declined";
  await db.insert(patientMessages).values({
    practiceId: admin.practiceId,
    accountId: decided.referrerId,
    fromPatient: false,
    authorId: admin.id,
    body: [`${verb} your referral for ${decided.patientName}.`, note].filter(Boolean).join("\n"),
  });
  await markReadByPractice(admin.practiceId, decided.referrerId, "referrer");
  if (account?.status === "active") {
    const base = appUrl();
    const email = renderEmail({
      heading: `${admin.practiceName} ${decision} a referral`,
      intro: `${admin.practiceName} ${decision} one of your referrals in the Tiba referral portal. For privacy, the patient's name and any note are only in the portal.`,
      action: base ? { label: "See your referrals", url: `${base}/referral/sign-in` } : undefined,
    });
    await sendEmail({ to: account.email, subject: `${admin.practiceName} ${decision} your referral`, ...email }).catch(() => undefined);
  }
  return { ok: true as const };
}

export type ReferralSourceStats = {
  id: string;
  name: string;
  organisation: string | null;
  active: boolean;
  total: number;
  accepted: number;
  declined: number;
  pending: number;
};

/** Referrals sent in a period, per referral source, most referrals first. */
export async function referralAnalysis(practiceId: string, range: { start: Date; end: Date }) {
  const rows = await db
    .select({
      id: clinicians.id,
      name: clinicians.name,
      organisation: clinicians.organisation,
      accountStatus: clinicians.status,
      status: referrals.status,
      n: count(),
    })
    .from(referrals)
    .innerJoin(clinicians, eq(clinicians.id, referrals.referrerId))
    .where(and(eq(referrals.practiceId, practiceId), gte(referrals.createdAt, range.start), lt(referrals.createdAt, range.end)))
    .groupBy(clinicians.id, clinicians.name, clinicians.organisation, clinicians.status, referrals.status);
  const sources = new Map<string, ReferralSourceStats>();
  for (const r of rows) {
    const s = sources.get(r.id) ?? {
      id: r.id,
      name: r.name,
      organisation: r.organisation,
      active: r.accountStatus === "active",
      total: 0,
      accepted: 0,
      declined: 0,
      pending: 0,
    };
    const n = Number(r.n);
    s.total += n;
    s[r.status] += n;
    sources.set(r.id, s);
  }
  const list = [...sources.values()].sort((a, b) => b.total - a.total || b.accepted - a.accepted || a.name.localeCompare(b.name));
  const totals = list.reduce(
    (t, s) => ({ total: t.total + s.total, accepted: t.accepted + s.accepted, declined: t.declined + s.declined, pending: t.pending + s.pending }),
    { total: 0, accepted: 0, declined: 0, pending: 0 },
  );
  // Leaders only when there's something to lead; ties go to the first in the list.
  const mostReferrals = list[0] ?? null;
  const mostAccepted = [...list].sort((a, b) => b.accepted - a.accepted || b.total - a.total)[0];
  return { sources: list, totals, mostReferrals, mostAccepted: mostAccepted && mostAccepted.accepted > 0 ? mostAccepted : null };
}
