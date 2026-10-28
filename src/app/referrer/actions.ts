"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireReferrer } from "@/lib/auth";
import { ATTACHMENTS_MAX, documents, markReadByPatient, MESSAGE_MAX, sendFromPortal } from "@/lib/portal";
import { allow } from "@/lib/rate-limit";

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
