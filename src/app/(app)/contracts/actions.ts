"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { contractMessages, contracts } from "@/db/schema";
import { requireClinician } from "@/lib/auth";
import { clearNotifications, notifyAdmins } from "@/lib/notifications";
import { isSignatureImage } from "@/lib/signature";

type Result = { ok: true } | { ok: false; message: string };

/** The clinician's own contract, if it's been sent to them. */
async function ownContract(contractId: string, clinicianId: string) {
  if (!z.uuid().safeParse(contractId).success) return null;
  const [k] = await db
    .select({ id: contracts.id, label: contracts.label, type: contracts.type, status: contracts.status, practiceId: contracts.practiceId, seen: contracts.seenByClinicianAt })
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.clinicianId, clinicianId)));
  return k && k.status !== "draft" ? k : null;
}

/** Sign and send back (spec v2 section 5c): the contract is signed, locked and the admin is told. */
export async function signContract(input: { contractId: string; signature: string }): Promise<Result> {
  const clinician = await requireClinician();
  const k = await ownContract(input.contractId, clinician.id);
  if (!k) return { ok: false, message: "We couldn't find that contract. Please go back to Contracts." };
  if (k.status === "signed") return { ok: false, message: "You've already signed this contract." };
  if (k.status !== "sent") return { ok: false, message: "Your admin is updating this contract. You can sign once they send it again." };
  if (!isSignatureImage(String(input.signature ?? ""))) return { ok: false, message: "Add your signature to sign." };

  const now = new Date();
  const signed = await db
    .update(contracts)
    .set({ status: "signed", clinicianSignature: input.signature, clinicianSignedAt: now, seenByClinicianAt: now, updatedAt: now })
    .where(and(eq(contracts.id, k.id), inArray(contracts.status, ["sent"])))
    .returning({ id: contracts.id });
  if (!signed.length) return { ok: false, message: "This contract changed just now. Please refresh the page." };

  await clearNotifications(k.practiceId, "contract", k.id);
  await notifyAdmins(k.practiceId, {
    type: "contract_signed",
    refId: k.id,
    title: `${clinician.name} signed ${k.label}`,
    detail: k.type,
    href: `/admin/contracts/${k.id}`,
  });
  revalidatePath("/contracts");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Message admin: questions instead of signing. The contract waits for the admin (Message). */
export async function messageAdmin(input: { contractId: string; body: string }): Promise<Result> {
  const clinician = await requireClinician();
  const body = String(input.body ?? "").trim();
  if (!body) return { ok: false, message: "Write your message first." };
  if (body.length > 2000) return { ok: false, message: "Keep your message under 2,000 characters." };
  const k = await ownContract(input.contractId, clinician.id);
  if (!k) return { ok: false, message: "We couldn't find that contract. Please go back to Contracts." };

  await db.insert(contractMessages).values({ contractId: k.id, authorId: clinician.id, fromRole: "clinician", body });
  if (k.status === "sent" || k.status === "feedback") {
    await db.update(contracts).set({ status: "feedback", seenByAdminAt: null, updatedAt: new Date() }).where(eq(contracts.id, k.id));
  }
  await notifyAdmins(k.practiceId, {
    type: "contract_message",
    refId: k.id,
    title: `${clinician.name} sent a message about ${k.label}`,
    detail: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    href: `/admin/contracts/${k.id}`,
  });
  revalidatePath(`/contracts/${k.id}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Opening a contract marks it seen and clears its notifications. */
export async function markContractSeenByClinician(contractId: string) {
  const clinician = await requireClinician();
  const k = await ownContract(contractId, clinician.id);
  if (!k) return;
  if (!k.seen && k.status !== "signed") await db.update(contracts).set({ seenByClinicianAt: new Date() }).where(eq(contracts.id, k.id));
  await clearNotifications(k.practiceId, "contract", k.id);
  revalidatePath("/", "layout");
}
