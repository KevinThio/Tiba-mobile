"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireReferrer } from "@/lib/auth";
import { ATTACHMENTS_MAX, documents, markReadByPatient, MESSAGE_MAX, sendFromPortal } from "@/lib/portal";
import { allow } from "@/lib/rate-limit";
import { isSelfPay, REFERRAL_LIMITS as L } from "@/lib/referral-status";
import { createReferral } from "@/lib/referrals";

const messageInput = z.object({
  body: z.string().trim().max(MESSAGE_MAX, "That message is too long. Please keep it under 2,000 characters."),
  attachmentIds: z.array(z.uuid()).max(ATTACHMENTS_MAX, `You can send up to ${ATTACHMENTS_MAX} documents in one message.`),
});

/**
 * A referral source writes to the practice, with the documents they uploaded for this message.
 * Only confirmed (active) accounts can send. A message with only documents says so as its text.
 */
export async function sendReferralMessage(body: string, attachmentIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const referrer = await requireReferrer();
  if (referrer.status !== "active") return { ok: false, message: "The practice needs to confirm your account before you can send messages." };
  const parsed = messageInput.safeParse({ body, attachmentIds: [...new Set(attachmentIds)] });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your message." };
  const { attachmentIds: ids } = parsed.data;
  const text = parsed.data.body || (ids.length ? `Sent ${documents(ids.length)}.` : "");
  if (!text) return { ok: false, message: "Write your message or attach a document first." };
  if (!allow(`portal-send:${referrer.id}`, 20, 10 * 60)) {
    return { ok: false, message: "You've sent a lot of messages in a short time. Please wait a few minutes." };
  }
  const sent = await sendFromPortal({ id: referrer.id, name: referrer.name, practiceId: referrer.practiceId }, text, "referrer", ids);
  if (!sent) return { ok: false, message: "We couldn't attach your documents. Please remove them, add them again and resend." };
  revalidatePath("/referrer");
  return { ok: true };
}

/** The referral source has the conversation on screen: the practice's replies are read. */
export async function markReferralPortalRead() {
  const referrer = await requireReferrer();
  if (referrer.status === "active") await markReadByPatient(referrer.id);
}

const referralInput = z
  .object({
    patientName: z.string().trim().min(1, "Add the patient's full name.").max(L.patientName, "Please shorten the patient's name."),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the patient's date of birth.")
      .refine((d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Pick the patient's date of birth."),
    insurer: z.string().trim().min(1, "Add the patient's insurance, or Self-pay.").max(L.insurer, "Please shorten the insurance name."),
    insuranceId: z.string().trim().max(L.insuranceId, "Please check the insurance ID: it's too long."),
    note: z.string().trim().max(L.note, "Please keep the note under 1,000 characters."),
    attachmentIds: z.array(z.uuid()).max(ATTACHMENTS_MAX, `You can send up to ${ATTACHMENTS_MAX} documents with one referral.`),
  })
  .refine((r) => r.insuranceId || isSelfPay(r.insurer), { message: "Add the insurance ID (member ID) from their card.", path: ["insuranceId"] });

export type ReferralField = "patientName" | "birthDate" | "insurer" | "insuranceId" | "note" | "form";

/** A referral source sends a referral: the patient's details, an optional note and documents. */
export async function sendReferral(input: {
  patientName: string;
  birthDate: string;
  insurer: string;
  insuranceId: string;
  note: string;
  attachmentIds: string[];
}): Promise<{ ok: true } | { ok: false; field: ReferralField; message: string }> {
  const referrer = await requireReferrer();
  if (referrer.status !== "active") return { ok: false, field: "form", message: "The practice needs to confirm your account before you can send referrals." };
  const parsed = referralInput.safeParse({ ...input, attachmentIds: [...new Set(input.attachmentIds)] });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "form");
    return {
      ok: false,
      field: (["patientName", "birthDate", "insurer", "insuranceId", "note"].includes(field) ? field : "form") as ReferralField,
      message: issue?.message ?? "Please check the referral.",
    };
  }
  if (!allow(`portal-send:${referrer.id}`, 20, 10 * 60)) {
    return { ok: false, field: "form", message: "You've sent a lot in a short time. Please wait a few minutes." };
  }
  const r = parsed.data;
  const sent = await createReferral(
    { id: referrer.id, name: referrer.name, practiceId: referrer.practiceId },
    { patientName: r.patientName, birthDate: r.birthDate, insurer: r.insurer, insuranceId: isSelfPay(r.insurer) ? r.insuranceId || null : r.insuranceId, note: r.note || null },
    r.attachmentIds,
  );
  if (!sent) return { ok: false, field: "form", message: "We couldn't attach your documents. Please remove them, add them again and resend." };
  revalidatePath("/referrer");
  return { ok: true };
}
