"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clinicians, contractMessages, contracts, practices } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { CONTRACT_LENGTHS, CONTRACT_TYPES } from "@/lib/contracts";
import { clearNotifications, notifyAccount } from "@/lib/notifications";
import { parseImageDataUrl } from "@/lib/practice-logo";
import { isSignatureImage } from "@/lib/signature";

const LETTERHEAD_IMAGE_MAX = 900_000;
type Result = { ok: true; id: string } | { ok: false; message: string };

const contractInput = z.object({
  id: z.uuid().optional(),
  clinicianId: z.string().min(1, "Pick the clinician."),
  type: z.enum(CONTRACT_TYPES, "Pick the type of contract."),
  terms: z.object({
    start: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
    length: z.enum(CONTRACT_LENGTHS),
    pay: z.string().trim().max(200),
    role: z.string().trim().max(200),
    extra: z.string().trim().max(3000),
  }),
  letterhead: z.object({
    address: z.string().trim().max(300),
    phone: z.string().trim().max(60),
    email: z.string().trim().max(200),
    // A data URL to set, null to remove, undefined to keep.
    image: z.string().nullable().optional(),
  }),
  mode: z.enum(["draft", "send"]),
  signature: z.string().nullable().optional(),
});

export type ContractInput = z.input<typeof contractInput>;

/**
 * New contract / Continue editing / Update and resend (spec v2 section 5c). "Save draft" keeps
 * it private; "Sign and send" needs the admin's signature, shares it with the clinician and
 * notifies them. The letterhead is saved for every contract and copied onto this one when sent.
 */
export async function saveContract(input: ContractInput): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = contractInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the contract." };
  const v = parsed.data;
  const sending = v.mode === "send";

  const [clinician] = await db
    .select({ id: clinicians.id, name: clinicians.name, status: clinicians.status })
    .from(clinicians)
    .where(and(eq(clinicians.id, v.clinicianId), eq(clinicians.practiceId, admin.practiceId), eq(clinicians.role, "clinician")));
  if (!clinician) return { ok: false, message: "Pick a clinician from your practice." };
  if (sending && clinician.status !== "active") return { ok: false, message: `${clinician.name} isn't active, so they can't sign yet.` };
  if (sending && !v.terms.start) return { ok: false, message: "Add the start date." };
  if (sending && v.type !== "Confidentiality agreement" && !v.terms.role) return { ok: false, message: "Add the role or services." };
  if (sending && !isSignatureImage(v.signature ?? "")) return { ok: false, message: "Sign the contract before you send it." };
  if (v.letterhead.email && !z.email().safeParse(v.letterhead.email).success) {
    return { ok: false, message: "The letterhead email doesn't look right. Check it, or leave it empty." };
  }
  if (v.letterhead.image && !parseImageDataUrl(v.letterhead.image, LETTERHEAD_IMAGE_MAX)) {
    return { ok: false, message: "We couldn't use that letterhead image. Try a PNG or JPG." };
  }

  let existing: typeof contracts.$inferSelect | undefined;
  if (v.id) {
    [existing] = await db.select().from(contracts).where(and(eq(contracts.id, v.id), eq(contracts.practiceId, admin.practiceId)));
    if (!existing) return { ok: false, message: "We couldn't find that contract. Please go back to Contracts." };
    if (existing.status === "signed") return { ok: false, message: "This contract is signed and locked." };
    if (!sending && existing.status !== "draft") return { ok: false, message: "A sent contract can only be updated and resent." };
  }

  const now = new Date();
  const id = await db.transaction(async (tx) => {
    // The letterhead is the practice's, saved for every contract.
    const [practice] = await tx
      .update(practices)
      .set({
        letterheadAddress: v.letterhead.address || null,
        letterheadPhone: v.letterhead.phone || null,
        letterheadEmail: v.letterhead.email || null,
        ...(v.letterhead.image !== undefined && { letterheadImage: v.letterhead.image }),
        ...(!existing && { lastContractNumber: sql`${practices.lastContractNumber} + 1` }),
      })
      .where(eq(practices.id, admin.practiceId))
      .returning({ number: practices.lastContractNumber, image: practices.letterheadImage });
    const snapshot = { address: v.letterhead.address, phone: v.letterhead.phone, email: v.letterhead.email, image: practice.image };
    const fields = {
      clinicianId: clinician.id,
      type: v.type,
      terms: v.terms,
      updatedAt: now,
      ...(sending
        ? {
            status: "sent" as const,
            sentAt: now,
            letterhead: snapshot,
            adminSignature: v.signature!,
            adminSignedName: admin.name,
            adminSignedAt: now,
            seenByAdminAt: now,
            seenByClinicianAt: null,
          }
        : {}),
    };
    if (existing) {
      await tx.update(contracts).set(fields).where(eq(contracts.id, existing.id));
      return existing.id;
    }
    const label = `CT-${now.getFullYear()}-${String(practice.number).padStart(2, "0")}`;
    const [created] = await tx
      .insert(contracts)
      .values({ practiceId: admin.practiceId, label, status: "draft", ...fields })
      .returning({ id: contracts.id });
    return created.id;
  });

  if (sending) {
    await clearNotifications(admin.practiceId, "contract", id);
    await notifyAccount(admin.practiceId, clinician.id, {
      type: "contract",
      refId: id,
      title: existing && existing.status !== "draft" ? `Updated contract to sign: ${v.type}` : `New contract to sign: ${v.type}`,
      detail: `From ${admin.name}`,
      href: `/contracts/${id}`,
    });
    revalidatePath("/contracts");
  }
  revalidatePath("/admin", "layout");
  return { ok: true, id };
}

/** Reply in a contract's message thread; tells the clinician. */
export async function sendContractReply(input: { contractId: string; body: string }): Promise<Result> {
  const admin = await requireAdmin();
  const body = String(input.body ?? "").trim();
  if (!body) return { ok: false, message: "Write your reply first." };
  if (body.length > 2000) return { ok: false, message: "Keep your reply under 2,000 characters." };
  if (!z.uuid().safeParse(input.contractId).success) return { ok: false, message: "Something went wrong. Please refresh the page." };
  const [k] = await db
    .select({ id: contracts.id, label: contracts.label, status: contracts.status, clinicianId: contracts.clinicianId })
    .from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.practiceId, admin.practiceId)));
  if (!k || k.status === "draft") return { ok: false, message: "We couldn't find that contract. Please refresh the page." };
  await db.insert(contractMessages).values({ contractId: k.id, authorId: admin.id, fromRole: "admin", body });
  if (k.status !== "signed") await db.update(contracts).set({ seenByAdminAt: new Date() }).where(eq(contracts.id, k.id));
  await clearNotifications(admin.practiceId, "contract_message", k.id);
  await notifyAccount(admin.practiceId, k.clinicianId, {
    type: "contract",
    refId: k.id,
    title: `${admin.name} replied about ${k.label}`,
    detail: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    href: `/contracts/${k.id}`,
  });
  revalidatePath(`/admin/contracts/${k.id}`);
  revalidatePath("/admin", "layout");
  return { ok: true, id: k.id };
}

/** Opening a contract with a new reply or signature takes away its "New" badge. */
export async function markContractSeenByAdmin(contractId: string) {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(contractId).success) return;
  const [k] = await db
    .select({ status: contracts.status, seen: contracts.seenByAdminAt })
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.practiceId, admin.practiceId)));
  // Signed contracts are locked; their "seen" is tracked through the notification instead.
  if (k && !k.seen && k.status !== "signed") await db.update(contracts).set({ seenByAdminAt: new Date() }).where(eq(contracts.id, contractId));
  await clearNotifications(admin.practiceId, "contract_message", contractId);
  await clearNotifications(admin.practiceId, "contract_signed", contractId);
  revalidatePath("/admin", "layout");
}
