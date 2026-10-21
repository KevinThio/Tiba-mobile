import "server-only";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { clinicians, contractMessages, contracts, practices, type Letterhead } from "@/db/schema";
import { practiceLogoUrl } from "@/lib/practice-logo";

// Contract queries (spec v2 section 5c). Admin queries are scoped to the practice; clinician
// queries to their own contracts, and never show drafts.

/** The practice's saved letterhead, for new contracts. */
export async function practiceLetterhead(practiceId: string) {
  const [p] = await db
    .select({
      name: practices.name,
      address: practices.letterheadAddress,
      phone: practices.letterheadPhone,
      email: practices.letterheadEmail,
      image: practices.letterheadImage,
      hasLogo: isNotNull(practices.logo),
      updatedAt: practices.updatedAt,
    })
    .from(practices)
    .where(eq(practices.id, practiceId));
  return {
    practiceName: p?.name ?? "",
    logoUrl: p?.hasLogo ? practiceLogoUrl(p.updatedAt) : null,
    letterhead: { address: p?.address ?? "", phone: p?.phone ?? "", email: p?.email ?? "", image: p?.image ?? null } satisfies Letterhead,
  };
}

const listColumns = {
  id: contracts.id,
  label: contracts.label,
  type: contracts.type,
  status: contracts.status,
  sentAt: contracts.sentAt,
  createdAt: contracts.createdAt,
  clinicianSignedAt: contracts.clinicianSignedAt,
  seenByAdminAt: contracts.seenByAdminAt,
  seenByClinicianAt: contracts.seenByClinicianAt,
  clinicianId: contracts.clinicianId,
  clinicianName: clinicians.name,
};

/** Every contract in the practice, newest first. */
export function practiceContracts(practiceId: string) {
  return db
    .select(listColumns)
    .from(contracts)
    .innerJoin(clinicians, eq(clinicians.id, contracts.clinicianId))
    .where(eq(contracts.practiceId, practiceId))
    .orderBy(desc(contracts.updatedAt));
}

/** The clinician's contracts (never drafts), newest first. */
export async function clinicianContracts(clinicianId: string) {
  const rows = await db
    .select(listColumns)
    .from(contracts)
    .innerJoin(clinicians, eq(clinicians.id, contracts.clinicianId))
    .where(eq(contracts.clinicianId, clinicianId))
    .orderBy(desc(contracts.sentAt));
  return rows.filter((r) => r.status !== "draft");
}

/** One contract with its messages: the admin's (any in the practice) or the clinician's (their own, sent). */
export async function loadContract(id: string, scope: { practiceId: string } | { clinicianId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [k] = await db
    .select({ contract: contracts, clinicianName: clinicians.name, clinicianEmail: clinicians.email })
    .from(contracts)
    .innerJoin(clinicians, eq(clinicians.id, contracts.clinicianId))
    .where(
      and(
        eq(contracts.id, id),
        "practiceId" in scope ? eq(contracts.practiceId, scope.practiceId) : eq(contracts.clinicianId, scope.clinicianId),
      ),
    );
  if (!k) return null;
  if ("clinicianId" in scope && k.contract.status === "draft") return null;
  const messages = await db
    .select({ id: contractMessages.id, fromRole: contractMessages.fromRole, body: contractMessages.body, createdAt: contractMessages.createdAt, author: clinicians.name })
    .from(contractMessages)
    .leftJoin(clinicians, eq(clinicians.id, contractMessages.authorId))
    .where(eq(contractMessages.contractId, id))
    .orderBy(asc(contractMessages.createdAt));
  return { ...k, messages };
}

/** Counts for Overview and the menu badges. */
export async function contractCounts(scope: { practiceId: string } | { clinicianId: string }) {
  if ("practiceId" in scope) {
    const rows = await db
      .select({ status: contracts.status, seen: contracts.seenByAdminAt })
      .from(contracts)
      .where(eq(contracts.practiceId, scope.practiceId));
    return {
      // Replies the admin hasn't looked at yet (new signatures come through Notifications,
      // because a signed contract is locked and can't record being seen).
      unseen: rows.filter((r) => !r.seen && r.status === "feedback").length,
      waiting: rows.filter((r) => r.status === "sent").length,
    };
  }
  const rows = await db.select({ status: contracts.status }).from(contracts).where(eq(contracts.clinicianId, scope.clinicianId));
  return { unseen: 0, waiting: rows.filter((r) => r.status === "sent").length };
}
